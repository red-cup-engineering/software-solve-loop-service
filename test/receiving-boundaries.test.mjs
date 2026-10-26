// Independent receiving oracles: preserved after review, native owners only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SolveEvidence, requirementCut } from '../src/evidence.mjs';
import { solveLoop } from '../src/solve-loop.mjs';
import { cell, coincides, semanticId } from '@red-cup-engineering/signcraft/cell';

const requirement = Object.freeze({kind: 'requirement', id: 'r', 'met-when': [
  Object.freeze({cell: 'r:c', target: 'held', says: 'exact behavior'}),
]});
const source = requirementCut(requirement).source;
const coordinate = revision => ({resource: 'code', revision});
const candidateA = coordinate('a');
const candidateB = coordinate('b');
const witness = Object.freeze({resource: 'assay', revision: 'w'});
const claim = (candidate, positive = true, negative = false) =>
  cell(candidate, 'r:c', source, {for: positive ? [witness] : [], against: negative ? [witness] : []});
const receipt = (candidate, cells = [claim(candidate)]) => ({
  resource: 'receipt', revision: semanticId([candidate, cells]),
  receiver: 'receiver', candidate, requirement: source, cells,
});
let sequence = 0;
const state = () => new SolveEvidence({run: `review:${++sequence}`,
  producer: 'producer', receiver: 'receiver', requirement, task: {}});

test('an envelope for candidate A cannot deposit receiving credit for candidate B', () => {
  const evidence = state();
  const crossScoped = receipt(candidateA, [claim(candidateA, false, true), claim(candidateB)]);
  try { evidence.receive(crossScoped, candidateA); } catch (error) {
    assert.ok(error instanceof TypeError, 'invalid receipt scope is an admission refusal');
  }
  const beforeB = evidence.assess(candidateB);
  assert.notEqual(beforeB.state, 'accepted', 'foreign envelope must not pre-authorize another candidate');
  const emptyB = evidence.receive(receipt(candidateB, []), candidateB);
  assert.notEqual(emptyB.state, 'accepted', 'an empty B receipt cannot reuse unscoped A testimony');
});

test('a mixed valid and non-measured receipt is rejected without partially adding its valid support', () => {
  const evidence = state();
  const unwitnessed = cell(candidateA, 'r:c', source, {value: 'potential'});
  assert.throws(() => evidence.receive(receipt(candidateA, [claim(candidateA), unwitnessed]), candidateA));
  assert.equal(evidence.assess(candidateA).state, 'unknown');
});

test('Requirement source retention preserves additional clauses and resists later caller mutation', () => {
  const input = {kind: 'requirement', id: 'r', why: {source: ['original', 'purpose']},
    'met-when': [{cell: 'r:c', target: 'held', says: 'old behavior', trace: {claim: 'market-evidence'}}]};
  const expected = structuredClone(input);
  const evidence = new SolveEvidence({run: `review:${++sequence}`, producer: 'producer', requirement: input, task: {}});
  input.why.source[0] = 'replacement';
  input['met-when'][0].says = 'new behavior';
  assert.deepEqual(evidence.requirement, expected);
  assert.equal(evidence.source.revision, semanticId(expected));
  assert.equal(coincides(evidence.source, requirementCut(input).source), false);
});

function scenario({testDrift = false, receivingDrift = false, wrongRollback = false} = {}) {
  let current = coordinate('original');
  let proposals = 0;
  let receives = 0;
  const options = {
    workdir: '/tmp/reviewer-owned-fixture', run: `review:${++sequence}`,
    producer: 'producer', receiver: 'receiver', requirement, task: {}, maxFreeRounds: wrongRollback ? 2 : 1,
    observeCandidate: () => ({...current}),
    generatePatch: () => ({patch: `proposal:${++proposals}`}),
    applyPatch: () => {
      current = candidateA;
      return {ok: true, candidate: {...current}, rollback: () => {
        current = coordinate(wrongRollback ? 'wrong-restoration' : 'original');
        return {restored: true, candidate: {...current}};
      }};
    },
    runTests: () => {
      if (testDrift) current = candidateB;
      return {passed: !wrongRollback, output: wrongRollback ? 'counterexample' : 'passed'};
    },
    receiveCandidate: ({candidate}) => {
      receives++;
      if (receivingDrift) current = candidateB;
      return receipt(candidate);
    },
  };
  return {options, observed: () => ({current, proposals, receives})};
}

test('a test runner changing the candidate cut cannot verify or accept the earlier candidate', async () => {
  const fixture = scenario({testDrift: true});
  const result = await solveLoop(fixture.options);
  assert.ok(!['accepted', 'verified'].includes(result.status), `stale cut became ${result.status}`);
  assert.equal(fixture.observed().receives, 0, 'receiver must not be offered the stale test cut');
});

test('receiving cannot accept a candidate changed during the receiving operation', async () => {
  const fixture = scenario({receivingDrift: true});
  const result = await solveLoop(fixture.options);
  assert.ok(!['accepted', 'verified'].includes(result.status), `stale received cut became ${result.status}`);
});

test('a rollback success flag cannot substitute for the original source revision', async () => {
  const fixture = scenario({wrongRollback: true});
  const result = await solveLoop(fixture.options);
  assert.equal(result.status, 'needs-recovery');
  assert.equal(fixture.observed().proposals, 1, 'wrong restoration must stop every later producer');
});

test('a refused envelope remains a structural source observation without condition credit', async () => {
  const fixture = scenario();
  const marker = 'review:untrusted-inbound-observation';
  fixture.options.receiveCandidate = ({candidate}) => ({...receipt(candidate),
    receiver: 'unselected-receiver', observation: {case: marker}});
  const result = await solveLoop(fixture.options);
  assert.notEqual(result.status, 'accepted');
  assert.equal(result.assessment.state, 'unknown');
  assert.ok(result.cells.some(at => at.predicate === 'relational-value:lexical' && at.object === marker),
    'refusal must retain the original canonical envelope, not only its error message');
  assert.equal(result.cells.some(at => at.predicate === 'r:c'), false,
    'retaining a rejected envelope is not direct admission of its embedded claims');
});

test('test observations retain original structured evidence beyond the passed flag and text', async () => {
  const fixture = scenario();
  const marker = 'review:exact-test-case-observation';
  fixture.options.receiveCandidate = null;
  fixture.options.runTests = () => ({passed: true, output: 'summary',
    source: {resource: 'suite', revision: 'test-source-v1'},
    observation: {case: marker, expected: 42, actual: 42}});
  const result = await solveLoop(fixture.options);
  assert.equal(result.status, 'verified');
  assert.ok(result.cells.some(at => at.predicate === 'relational-value:lexical' && at.object === marker),
    'the original structured test evidence must survive its control projection');
});

for (const stage of ['buildContext', 'generatePatch', 'refine']) {
  test(`a mutating ${stage} exception preserves observed recovery state and stops producers`, async () => {
    let revision = 'original', laterProducers = 0;
    const options = {
      workdir: '/tmp/independent-exception-fixture', run: `review:exception:${stage}`,
      producer: 'producer', requirement: {kind: 'requirement', id: 'r',
        'met-when': [{cell: 'r:c', target: 'held', says: 'exact behavior'}]},
      task: {}, maxFreeRounds: stage === 'refine' ? 0 : 1,
      observeCandidate: () => ({resource: 'code', revision}),
      generatePatch: () => { laterProducers++; return null; },
      refine: () => { laterProducers++; return null; },
      runTests: () => { throw new Error('there is no admitted candidate to test'); },
    };
    options[stage] = () => {
      revision = 'unreported-mutation';
      throw new Error(`provider failed after ${stage} mutation`);
    };
    const result = await solveLoop(options);
    assert.equal(result.status, 'needs-recovery');
    assert.equal(result.worktreeNeedsRecovery, true);
    assert.deepEqual(result.currentCandidate, {resource: 'code', revision: 'unreported-mutation'});
    assert.equal(laterProducers, 0);
    assert.ok(result.cells.some(at => at.predicate === 'relational-value:lexical' &&
      at.object === `provider failed after ${stage} mutation`),
    'failure observation must survive in the native source graph');
  });
}

for (const source of ['tests', 'receiving']) {
  test(`noncanonical ${source} output is refused through actual source restoration`, async () => {
    let revision = 'original', restores = 0, received = 0;
    const options = {
      workdir: '/tmp/independent-observation-fixture', run: `review:noncanonical:${source}`,
      producer: 'producer', receiver: 'receiver', task: {}, maxFreeRounds: 1,
      requirement: {kind: 'requirement', id: 'r',
        'met-when': [{cell: 'r:c', target: 'held', says: 'exact behavior'}]},
      observeCandidate: () => ({resource: 'code', revision}),
      generatePatch: () => ({patch: 'change'}),
      applyPatch: () => {
        revision = 'candidate';
        return {ok: true, candidate: {resource: 'code', revision}, rollback: () => {
          revision = 'original'; restores++;
          return {restored: true};
        }};
      },
      runTests: () => source === 'tests'
        ? {passed: true, unexpectedProcedure: () => 42} : {passed: true},
      receiveCandidate: ({candidate, requirementSource}) => {
        received++;
        return {resource: 'receipt', revision: 'r1', receiver: 'receiver',
          candidate, requirement: requirementSource, cells: [], unexpectedProcedure: () => 42};
      },
    };
    const result = await solveLoop(options);
    assert.equal(result.status, 'unresolved');
    assert.equal(restores, 1);
    assert.equal(revision, 'original');
    assert.deepEqual(result.currentCandidate, {resource: 'code', revision: 'original'});
    assert.deepEqual(result.lastAttemptedCandidate, {resource: 'code', revision: 'candidate'});
    assert.equal(result.candidate, null);
    assert.equal(received, source === 'tests' ? 0 : 1);
    assert.ok(result.cells.some(at => at.predicate === 'relational-value:lexical' &&
      at.object === `${source}-observation-refused`));
    assert.equal(result.cells.some(at => at.predicate === 'r:c'), false);
  });
}
