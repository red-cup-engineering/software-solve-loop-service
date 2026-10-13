import test from "node:test";
import assert from "node:assert/strict";
import { solveLoop } from "../src/solve-loop.mjs";
import { selectResolver, autofixResolver } from "../src/resolvers.mjs";

const task = { title: "compile an exact program" };

test("failed generated code is rolled back before the next generation reads its worktree", async () => {
  let state = "clean", rollbacks = 0, generated = [];
  const result = await solveLoop({
    workdir: "/tmp/isolated", task, maxFreeRounds: 3,
    generatePatch: ({ round }) => {
      generated.push({ round, state });
      return { patch: round === 1 ? "bad" : "good" };
    },
    applyPatch: async (_workdir, patch) => {
      state = patch;
      return { ok: true, rollback: async () => {
        state = "clean"; rollbacks++; return { restored: true };
      } };
    },
    runTests: async () => ({ passed: state === "good", output: "failed behavior test" }),
  });
  assert.equal(result.status, "solved-free");
  assert.equal(result.rounds, 2);
  assert.equal(result.freeRounds, 2);
  assert.deepEqual(generated, [{ round: 1, state: "clean" }, { round: 2, state: "clean" }]);
  assert.equal(rollbacks, 1);
  assert.equal(state, "good");
});

test("a failed test without rollback stops before further patches or expensive refinement", async () => {
  let generations = 0, refinementCalls = 0;
  const result = await solveLoop({
    workdir: "/tmp/isolated", task,
    generatePatch: () => { generations++; return { patch: "bad" }; },
    applyPatch: async () => ({ ok: true }),
    runTests: async () => ({ passed: false, output: "regression" }),
    refine: async () => { refinementCalls++; return { patch: "should-not-run" }; },
  });
  assert.equal(result.status, "failed");
  assert.equal(result.worktreeNeedsRecovery, true);
  assert.equal(result.stoppedAt, "model:1");
  assert.equal(generations, 1);
  assert.equal(refinementCalls, 0);
});

test("throwing or partially refused appliers cannot cascade potentially dirty source", async () => {
  for (const applyPatch of [
    async () => { throw new Error("writer threw after source mutation"); },
    async () => ({ ok: false, error: "write failed midway" }),
  ]) {
    let calls = 0;
    const result = await solveLoop({
      workdir: "/tmp/isolated", task, maxFreeRounds: 5,
      generatePatch: () => { calls++; return { patch: "mutating proposal" }; },
      applyPatch,
      runTests: async () => { throw new Error("must not run tests for failed apply"); },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.worktreeNeedsRecovery, true);
    assert.equal(calls, 1);
  }
});

test("cleanly refused source edit remains a valid retry opportunity", async () => {
  let calls = 0;
  const result = await solveLoop({
    workdir: "/tmp/isolated", task, maxFreeRounds: 3,
    generatePatch: () => ({ patch: ++calls === 1 ? "ambiguous" : "exact" }),
    applyPatch: async (_workdir, patch) => patch === "ambiguous"
      ? { ok: false, unchanged: true, error: "ambiguous source" } : { ok: true },
    runTests: async () => ({ passed: true }),
  });
  assert.equal(result.status, "solved-free");
  assert.equal(result.rounds, 2);
  assert.equal(result.freeRounds, 1);
});

test("dirty scripted resolver does not trigger model inference when its test fails", async () => {
  let calls = 0;
  const result = await solveLoop({
    workdir: "/tmp/isolated", task,
    resolvers: [{
      name: "script-first", match: () => true,
      attempt: async () => ({ mutated: true }),
    }],
    generatePatch: async () => { calls++; return { patch: "should-not-run" }; },
    runTests: async () => ({ passed: false, output: "syntax failure" }),
  });
  assert.equal(result.status, "failed");
  assert.equal(result.worktreeNeedsRecovery, true);
  assert.equal(result.stoppedAt, "resolver:script-first");
  assert.equal(calls, 0);
});

test("script-first success does not spend inference and selection is dependency-free", async () => {
  const resolver = { name: "read-only-resolution", match: () => true,
    attempt: async () => ({ mutated: true }) };
  assert.equal(selectResolver([resolver], task), resolver);
  const optional = autofixResolver();
  assert.equal(await optional.attempt({ workdir: "/tmp/unused" }), null);
  let calls = 0;
  const result = await solveLoop({
    workdir: "/tmp/isolated", task, resolvers: [resolver],
    runTests: async () => ({ passed: true }),
    generatePatch: async () => { calls++; return { patch: "no" }; },
  });
  assert.equal(result.status, "solved-resolver");
  assert.equal(result.solvedBy, "resolver:read-only-resolution");
  assert.equal(calls, 0);
});

test("test-runner errors still require a verified rollback before retry", async () => {
  let attempts = 0, rollbacks = 0;
  const result = await solveLoop({
    workdir: "/tmp/isolated", task, maxFreeRounds: 2,
    generatePatch: () => ({ patch: ++attempts }),
    applyPatch: async () => ({ ok: true,
      rollback: async () => { rollbacks++; return { restored: true }; } }),
    runTests: async () => attempts === 1 ? Promise.reject(new Error("runner died")) : { passed:true },
  });
  assert.equal(result.status, "solved-free");
  assert.equal(rollbacks, 1);
  assert.equal(attempts, 2);
});

test("market refinement receives a clean workspace and the budget stays bounded", async () => {
  let observedDifficulty;
  const result = await solveLoop({
    workdir: "/tmp/isolated", task, maxFreeRounds: 0, difficulty: 0.95,
    refine: async ({ difficulty }) => {
      observedDifficulty = difficulty; return { patch: "narrow", provider: "existing-market" };
    },
    applyPatch: async () => ({ ok: true }),
    runTests: async () => ({ passed: true }),
  });
  assert.equal(observedDifficulty, 0.45);
  assert.equal(result.status, "solved-refined");
  assert.equal(result.solvedBy, "existing-market");
  await assert.rejects(() => solveLoop({task,maxFreeRounds:17}),/maxFreeRounds/);
  await assert.rejects(() => solveLoop({task,maxFreeRounds:-1}),/maxFreeRounds/);
});
