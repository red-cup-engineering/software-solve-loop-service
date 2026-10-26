import test from "node:test";
import assert from "node:assert/strict";
import { cell, coincides, measured, semanticId } from "@red-cup-engineering/signcraft/cell";
import { settlementAdmits } from "@red-cup-engineering/signcraft/settle";
import { solveLoop } from "../src/solve-loop.mjs";
import { SolveEvidence, requirementCut } from "../src/evidence.mjs";

const requirement = {kind: "requirement", id: "market-reader", "met-when": [
  {cell: "market-reader:source", target: "held", says: "retain original source witnesses"},
  {cell: "market-reader:response", target: "held", says: "deliver the required response"},
]};
const source = requirementCut(requirement).source;
const candidate = {resource: "urn:test:reader", revision: "sha256:current"};
const witness = {resource: "urn:test:assay", revision: "sha256:observation", path: "original-case"};
const claims = (forSide = [witness], againstSide = [], at = candidate, cut = source) =>
  requirement["met-when"].map(c => cell(at, c.cell, cut, {for: forSide, against: againstSide}));
const receipt = (cells = claims(), extra = {}) => ({
  resource: witness.resource, revision: witness.revision, receiver: "fixture-receiver",
  candidate, requirement: source, cells, ...extra,
});
let sequence = 0;
const options = () => ({run: "urn:run:" + ++sequence, producer: "fixture-producer", requirement,
  task: {title: "original reader requirement"}, workdir: "/tmp/fixture", maxFreeRounds: 1,
  observeCandidate: () => candidate,
  generatePatch: () => ({patch: "candidate"}),
  applyPatch: () => ({ok: true, candidate, rollback: () => ({restored: true})}),
  runTests: () => ({passed: true, output: "bounded local tests passed"}),
});

test("passing tests produce native evidence and verification, never acceptance", async () => {
  const result = await solveLoop(options());
  assert.equal(result.status, "verified");
  assert.equal(result.assessment.state, "unknown");
  assert.equal(settlementAdmits(result.settlement).admitted, true);
  assert.ok(result.cells.length > 0);
  assert.ok(result.cells.every(measured));
  assert.equal(result.log, undefined, "the native graph replaces the opaque log");
});

test("all original direct measured receipt conditions permit acceptance", async () => {
  const result = await solveLoop({...options(), receiver: "fixture-receiver",
    receiveCandidate: () => receipt()});
  assert.equal(result.status, "accepted");
  assert.ok(result.assessment.conditions.every(c => c.reading === "held"));
  for (const condition of result.assessment.conditions)
    assert.deepEqual(condition.receivingCell.for, [witness]);
  assert.equal(settlementAdmits(result.settlement).admitted, true);
});

test("an incomplete receipt leaves the exact missing condition unknown", async () => {
  const result = await solveLoop({...options(), receiver: "fixture-receiver",
    receiveCandidate: () => receipt(claims().slice(0, 1))});
  assert.equal(result.status, "verified");
  assert.deepEqual(result.assessment.conditions.map(c => c.reading), ["held", "unknown"]);
});

test("old candidate, old Requirement, and wrong receiver cannot be accepted", async () => {
  const oldRequirement = {...requirement, "met-when": requirement["met-when"].map(c => ({...c, says: c.says + " revised"}))};
  assert.notDeepEqual(requirementCut(oldRequirement).source, source);
  for (const change of [
    {candidate: {...candidate, revision: "sha256:old"}},
    {requirement: requirementCut(oldRequirement).source},
    {receiver: "different-receiver"},
  ]) {
    const result = await solveLoop({...options(), receiver: "fixture-receiver",
      receiveCandidate: () => receipt(claims(), change)});
    assert.equal(result.status, "verified");
    assert.equal(result.assessment.state, "unknown");
    assert.equal(result.cells.some(c => c.predicate === "market-reader:source"), false,
      "refused envelopes cannot partially inject testimony");
  }
});

test("written positive values without evidence cannot become receiving testimony", async () => {
  const asserted = requirement["met-when"].map(c => cell(candidate, c.cell, source, {value: "potential"}));
  const result = await solveLoop({...options(), receiver: "fixture-receiver",
    receiveCandidate: () => receipt(asserted)});
  assert.equal(result.status, "verified");
  assert.equal(result.assessment.state, "unknown");
});

test("initial sensor support cannot masquerade as independent receiving", async () => {
  const result = await solveLoop({...options(), cells: claims(), receiver: "fixture-receiver",
    receiveCandidate: () => receipt([])});
  assert.equal(result.status, "verified");
  assert.equal(result.assessment.state, "unknown");
});

test("source opposition survives a positive receipt and halts as contested", async () => {
  let restores = 0;
  const counter = {resource: "urn:sensor:counterexample", revision: "v1"};
  const result = await solveLoop({...options(), cells: claims([], [counter]),
    receiver: "fixture-receiver", receiveCandidate: () => receipt(),
    applyPatch: () => ({ok: true, candidate, rollback: () => {restores++; return {restored: true};}})});
  assert.equal(result.status, "contested");
  assert.equal(restores, 1);
  assert.ok(result.assessment.conditions.every(c => c.reading === "contested"));
  assert.ok(result.assessment.conditions.every(c => coincides(c.sourceCell.against, [counter])));
});

test("denial is retained while a different candidate can be received", async () => {
  let restores = 0, applied = 0;
  let current = candidate;
  const result = await solveLoop({...options(), maxFreeRounds: 2,
    observeCandidate: () => current,
    applyPatch: () => {
      current = {...candidate, revision: "v" + ++applied};
      return {ok: true, candidate: current,
        rollback: () => {restores++; current = candidate; return {restored: true};}};
    },
    receiver: "fixture-receiver", receiveCandidate: ({candidate: at}) =>
      receipt(claims(applied === 1 ? [] : [witness], applied === 1 ? [witness] : [], at), {candidate: at})});
  assert.equal(result.status, "accepted");
  assert.equal(result.candidate.revision, "v2");
  assert.equal(restores, 1);
  assert.ok(result.cells.some(c => c.subject?.revision === "v1" && c.against.length));
  assert.equal(result.freeRounds, 2);
});

test("receipt replay is idempotent and source values are retained", () => {
  const state = new SolveEvidence({...options(), receiver: "fixture-receiver"});
  const input = receipt();
  const before = semanticId(input);
  state.receive(input, candidate);
  const first = semanticId(state.snapshot().cells);
  state.receive(input, candidate);
  assert.equal(semanticId(state.snapshot().cells), first);
  assert.equal(semanticId(input), before);
});

test("self receiving and missing original source fail before effects", async () => {
  let effects = 0;
  const base = {...options(), generatePatch: () => {effects++; return {patch: "bad"};}};
  await assert.rejects(solveLoop({...base, receiver: "fixture-producer", receiveCandidate: () => receipt()}), /independent/);
  await assert.rejects(solveLoop({...base, requirement: undefined}), /Requirement/);
  assert.equal(effects, 0);
});
