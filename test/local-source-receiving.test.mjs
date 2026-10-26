import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { cell } from "@red-cup-engineering/signcraft/cell";
import { solveLoop } from "../src/solve-loop.mjs";

test("a real changed module is tested, denied, restored, regenerated and independently received", async () => {
  const workdir = await mkdtemp(join(tmpdir(), "solve-loop-native-"));
  const path = join(workdir, "sum.mjs");
  const baseline = "export const sum = (a, b) => 0;\n";
  await writeFile(path, baseline);
  const requirement = {kind: "requirement", id: "signed-sum", "met-when": [
    {cell: "signed-sum:integers", target: "held", says: "add positive and negative integers"},
  ]};
  const observeCandidate = async () => ({resource: pathToFileURL(path).href,
    revision: "sha256:" + createHash("sha256").update(await readFile(path)).digest("hex")});
  const load = candidate => import(pathToFileURL(path).href + "?revision=" + encodeURIComponent(candidate.revision));
  let restores = 0;
  const seen = [];
  try {
    const result = await solveLoop({
      workdir, run: "urn:fixture:real-source", producer: "fixture-fabricator",
      receiver: "fixture-independent-assay", task: {title: "signed integer addition"},
      requirement, observeCandidate, maxFreeRounds: 2,
      generatePatch: async ({round}) => {
        seen.push(await readFile(path, "utf8"));
        return {patch: round === 1
          ? "export const sum = (a, b) => Math.abs(a) + Math.abs(b);\n"
          : "export const sum = (a, b) => a + b;\n"};
      },
      applyPatch: async (_workdir, patch) => {
        const previous = await readFile(path);
        await writeFile(path, patch);
        return {ok: true, candidate: await observeCandidate(), rollback: async () => {
          await writeFile(path, previous); restores++;
          return {restored: (await readFile(path)).equals(previous)};
        }};
      },
      runTests: async (_workdir, {candidate}) => {
        const actual = (await load(candidate)).sum(2, 3);
        return {passed: actual === 5, observation: {input: [2, 3], expected: 5, actual}};
      },
      receiveCandidate: async ({candidate, requirementSource}) => {
        const actual = (await load(candidate)).sum(-2, 3);
        const source = {resource: "urn:fixture:signed-integer-assay", revision: candidate.revision};
        return {...source, receiver: "fixture-independent-assay", candidate,
          requirement: requirementSource, observation: {input: [-2, 3], expected: 1, actual},
          cells: [cell(candidate, "signed-sum:integers", requirementSource,
            actual === 1 ? {for: [source]} : {against: [source]})]};
      },
    });
    assert.equal(result.status, "accepted");
    assert.equal(result.freeRounds, 2);
    assert.equal(restores, 1);
    assert.deepEqual(seen, [baseline, baseline]);
    assert.deepEqual(result.currentCandidate, await observeCandidate());
    assert.ok(result.cells.some(c => c.predicate === "signed-sum:integers" && c.against.length));
    assert.ok(result.cells.some(c => c.predicate === "signed-sum:integers" && c.for.length));
  } finally { await rm(workdir, {recursive: true, force: true}); }
});
