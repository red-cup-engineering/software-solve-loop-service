# Source-qualified software requirement settlement

## Required relationship

A software owner gives the existing solve-loop service an original Requirement,
an identified run, an effectful candidate producer, a test runner, and optionally
an independently selected receiving provider. The service must preserve the
Requirement and every observed candidate, test, refusal, and receiving claim as
native SignCells. A local passing test is verification evidence. Acceptance
requires direct, measured, unopposed receiving evidence for every original
condition at the exact Requirement and candidate revisions.

The source Requirement is the existing Group record consumed by Specification
Engineering: `kind: requirement`, `id`, and nonempty `met-when` conditions with
unique `cell`, `target: held`, and `says`. This service does not derive, adopt,
or rewrite those requirements and does not implement Engineering's four-stage
closure. It consumes the conditions that their existing owner supplies.

## Carrier and ownership

All semantic computation uses SignCraft's selected `cell` and `knowledge-base`
interfaces. SignCell owns identity, admission, witness joins, and FOUR readings;
SignChain owns the telling log; SignGraph owns structural value projection;
SignCraft owns the resulting knowledge base and settlement. There is no second
event store or application-specific truth algebra.

The `evidence` export also directly re-exports the selected Cell owner's
`retainedCarrier`. A host retaining a receiver envelope before admission uses
that same owner; it must not pass private retained carriers through a different
installed copy or an older content-address codec.

Original Requirement, task, and operation observations enter through
`KnowledgeBase.fromRelationalValues` with resource/revision identity. Other
source-owned Cells enter through `KnowledgeBase.fromCells`. The output contains
the native source Cells and native settlement, with small derived control
projections. Schema.org and PROV-O identifiers name source-code, activity, and
provenance relationships; these links do not confer authorization or entail
customer acceptance.

The input `run` identifies an actual invocation and must be unique across
distinct invocations. The host supplies producer and receiver identities and
authenticates the receiving provider. A string comparison inside this library
cannot authenticate a principal. The service checks that the configured
receiver differs from the producer and that an envelope names that receiver.
It preserves the original witnessed Cells; it never creates acceptance
witnesses from a Boolean, a provider name, a log entry, or test output.

## Exact receiving contract

The host supplies `observeCandidate(workdir, context)` as the original source
observer. The loop observes the baseline, checks proposals and context for
unreported mutations, checks resolver selection before any following callback,
checks the applied candidate, and re-observes after tests
and receiving. Rollback requires both its reported success and an observation
equal to the exact pre-attempt baseline. A lost observation stops further writes.
`currentCandidate` names the last actually observed source; `lastAttemptedCandidate`
names the attempted code even after restoration. The `candidate` convenience
projection is populated only for verified or accepted current source.

The candidate writer returns `candidate: {resource, revision}` for the actual
changed source. Both fields must be nonempty strings. A test or receipt for
another candidate cannot be reused. The service gives the test runner and
receiver immutable candidate and Requirement coordinates.

The receiver returns `{resource, revision, receiver, candidate, requirement,
cells}`. `requirement` is the exact source coordinate supplied to the receiver.
Each condition has the native triple `(candidate, condition.cell, requirement)`.
The envelope's source identity and full body are retained alongside its Cells.
Only direct receipt Cells can supply positive receiving evidence. All admitted
opposition at that exact coordinate remains relevant. Written values that
differ from witness presence are refused at original-source admission. A
condition is held only when positive original witnesses exist and no negative
witness exists. Unknown, denial, and contradiction remain separate readings.

Receipts from a different receiver, source cut, or candidate are recorded as
refused observations and cannot grant acceptance. Source-domain validation
precedes adding any receipt Cells; refusal cannot partly mutate evidence.
Every embedded receiving Cell must name a declared condition at that envelope's
exact candidate and Requirement cut. Replayed receipt observations merge under
the upstream knowledge join. Complete canonical rejected envelopes and complete
structured test reports remain observations in the source graph; their embedded
claims do not gain receiving authority through structural projection.

## State and effect contract

1. Validate source, run, provider selection, bounds, and callbacks before effects.
2. Prefer an applicable existing deterministic resolver, then bounded generation,
   then the configured refinement provider. The loop does not spend money or
   authenticate external services; each callback owns its declared effects.
3. Apply a candidate, obtain its exact source identity, run tests, and record the
   result. An application exception may have changed source and stops the run.
4. A failing test requires a verified rollback before another candidate. Missing
   or failed rollback returns `needs-recovery` and stops every later producer.
5. A passing test without complete receiving evidence returns `verified` and
   preserves the candidate for the existing receiving owner. It is not solved.
   Known source opposition remains visible in its assessment. This status
   certifies only the observed local test result, including when receiving is
   unavailable or its envelope is refused.
6. Direct unopposed receiving of all conditions returns `accepted`. An explicit
   denial rolls back before a subsequent candidate; prior denials stay in the
   common graph but are bound to the prior revision. A contradiction stops as
   `contested` after rollback, requiring the owning source decision.
7. Exhausted proposals return `unresolved`. No state means installed, deployed,
   sold, or received outside the configured contract.

Provider exceptions during context construction, generation, and refinement are
retained and followed by source re-observation before returning `needs-recovery`.
After an application, a test or receipt containing inadmissible non-data values
cannot bypass recovery through a recording exception: the refusal is retained,
source is observed, and the original rollback is verified. Canonical reports
are retained whole; functions, getters, and other refused values are not turned
into purported source knowledge.

## Acceptance evidence

Native tests must distinguish passing tests from receiving; complete, incomplete,
denied and contested receipts; changed Requirement and candidate cuts; self
receiving; non-measured written values; competing sensor opposition; original
source witness retention; deterministic resolver use; and failed/restored
worktrees. A real local source-edit scenario must run through the native loop,
test runner, and separately selected fixture receiver. Such a fixture qualifies
the software protocol, not production customer acceptance.

## Source lineage

- Leader direction, 2026-10-26: all data as SignCells; source-qualified automatic
  alignment against derived market requirements.
- Engineering issue 137: original Requirements precede four incumbent closures;
  source, verification, installation, and independent receiving are distinct.
  https://github.com/red-cup-engineering/engineering-services-section/issues/137
- Original Requirement shape and exact condition preservation:
  https://github.com/red-cup-engineering/specification-engineering-services-section/pull/2
- PROV-O: https://www.w3.org/TR/prov-o/
- Schema.org source-code type: https://schema.org/SoftwareSourceCode
