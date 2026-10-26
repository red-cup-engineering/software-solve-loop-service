# software-solve-loop-service

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Bounded software repair against an original Group Requirement. Source knowledge
is native SignCell/SignChain/SignGraph through SignCraft. The host owns source
observation, writes, tests, rollback, and independently selected receiving.

## Result contract

| Status | Observed result |
| --- | --- |
| `accepted` | Tests pass at the observed revision; every original condition has direct measured, unopposed evidence from the selected receiver. |
| `verified` | Tests pass at the observed revision; complete receiving is absent, unknown, unavailable, or refused. The assessment retains any known opposition. |
| `contested` | A condition has both receiving support and source opposition; the candidate has been restored to its verified baseline. |
| `unresolved` | Available producers did not produce a candidate that passed the configured contract. |
| `needs-recovery` | Source observation, application, or restoration could not establish a clean source state; later producers did not run. |

Every result contains original native `cells`, their native `settlement`, the
last observed `currentCandidate`, and `lastAttemptedCandidate`. `candidate` is
populated only for the currently verified or accepted revision. Deployment,
customer receiving outside this contract, and revenue require their own sources.

## Use with the original owners

```js
import { solveLoop } from "@red-cup-engineering/software-solve-loop-service";

const result = await solveLoop({
  workdir,
  task,
  requirement, // original {kind, id, "met-when"}; preserve its source fields
  run,         // unique identity of this actual invocation
  producer,
  receiver,    // host-selected and authenticated; differs from producer
  cells,       // original measured sensor/source Cells, including opposition
  observeCandidate, // actual {resource, revision} of the whole affected source
  resolvers,
  buildContext,
  generatePatch,
  applyPatch,
  runTests,
  receiveCandidate,
  maxFreeRounds: 4,
});
```

`applyPatch` returns `{ok: true, candidate, rollback}`. Its rollback must restore
the whole affected source and return `{restored: true}`; a fresh observation
must independently match the pre-attempt baseline. A provider that already
mutated source returns `{mutated: true, candidate, rollback}`. Proposals and
context construction must leave source unchanged.

`runTests` returns `{passed, ...observations}`. The full canonical report is
retained as source Cells. `receiveCandidate` receives the exact candidate and
`requirementSource`, and returns this source-owned envelope:

```js
{
  resource, revision, receiver,
  candidate, requirement: requirementSource,
  cells, // each native Cell is (candidate, condition.cell, requirementSource)
  // other canonical observations are retained with their original structure
}
```

Receiving Cells must carry original positive and/or negative witnesses and must
match the declared source coordinates. Embedded claims in a rejected envelope
remain observations; structural projection does not grant them receiving
authority. Native FOUR distinguishes unknown, held, denied, and contested.
Only direct receiving supplies positive acceptance evidence. Opposition from
any admitted source at the same coordinate remains relevant.

Callback errors and rejected non-data observations stop or restore the affected
attempt with a newly observed source state. Source observation is part of the
host's trust boundary: a reported revision must describe the actual affected
source. An arbitrary label or passing Boolean cannot establish that binding.

## Migration from 0.0.1

The former `solved-*` statuses conflated local tests with fulfilled requirements.
Version 0.1.0 requires the original Requirement, run and producer identities, and
an actual source observer. Callers must handle the statuses above and consume
the native source evidence. `autofixResolver` requires source observation and
rollback before running its configured command. No requirement derivation,
provider authentication, persistent event store, or market-purchase policy is
introduced here; those remain with their original owners.

See [the source contract](specifications/requirement-settlement.md) and the
[real local source receiving scenario](test/local-source-receiving.test.mjs).
The [original Requirement source lineage](specifications/market-requirement-source-lineage.md)
records the existing upstream producers and the unresolved sensor/market
derivation and normative admission boundaries.
Run `npm test` against the declared native supplier closure.

The [Cell alignment implementation record](specifications/cell-alignment-implementation.md)
connects the original semantic owners, integrated foundation repairs, exact
source receiving and the remaining host and Requirement-production work.
