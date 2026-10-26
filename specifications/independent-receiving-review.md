# Independent source and receiving review — 2026-10-26

The raw historical reports and exact source hashes are retained in this
repository under `data/records/receiving-records/2026-10-26/independent/`.
The coordinator's selection counterexample and later native candidate run are
retained separately under the adjacent `coordinator/` directory. The receipt
index distinguishes these source cuts from installed-release receiving.

The reviewer changed no production code. The coordinator repaired six original receiving/source-custody defects, then the remaining callback exception paths. The same original eight independent cases passed on the first corrected source. The final narrow run passed the three callback exception cases and two malformed-observation cases. These are two qualified runs against the exact source cuts below; they are not claimed as one final installed-cohort run.

## Exact reviewed production

- `src/solve-loop.mjs` — SHA-256 `934938972e4c383b79bb27a60b8f04c2c78829442e317659f4a35d6427bf2983`
- `src/evidence.mjs` — SHA-256 `dfccf8e5cb6bd6327be75ada55316e54b0ebdd27f72360a21ebe1fcb3b9b3551`
- `src/resolvers.mjs` — SHA-256 `96cc2fd907c93ba4191b82ce693080dca91f4f0e62e3466a43417e88a685ea31`
- `specifications/requirement-settlement.md` — SHA-256 `e9d185e360ec20ad566021587d57d79fc20c0c4840a6e565c4505fa1466d76ff`
- `package.json` — SHA-256 `70fb7d5e39f973b518c78e3a07999ff964e811947fa3d59aa640c0bf09a9aec4`

## Native evidence

- First corrected eight cases: 8 enrolled, 8 passed, no failures/skips/cancellations, exit 0. Runtime Node v24.22.1. `solve-loop-independent-review/corrected-eight.tap`; exact code cut is `corrected-files.json` there.
- Final callback/observation cases: 5 enrolled, 5 passed, no failures/skips/cancellations, exit 0. `solve-loop-independent-review/final-boundaries.tap`; exact final source cut is `final-corrected-files.json` there.
- Counterexamples retained: initial source had 2 controls pass and 6 failures across `initial-evidence.tap`, `initial-effects.tap`, `initial-retention.tap`. First corrected source still failed all 3 mutating callback-exception cases in `corrected-exceptions.tap`; final source passes them.
- Tests executed against actual selected native suppliers: SignCraft 0.6.1-dev.471, SignCell 0.13.1-dev.163, SignChain 0.4.2-dev.1, SignGraph 0.7.1-dev.3, Metrologic 0.14.3-dev.4. No native semantics were mocked. Host callbacks are explicit source/effect fixtures.

## Permanent receiving enrollment

`test/receiving-boundaries.test.mjs` consolidates the same 8 + 3 + 2 behavioral cases with unchanged assertion bodies, static relative source imports, and the declared SignCraft Cell export. This is the reviewer's only package addition. `node --check` passes. The coordinator owns the final native cohort run and its separate receipt.

The cases distinguish cross-candidate receipt contamination, partial admission, original Requirement retention, test/receiver source drift, false restoration, rejected-envelope and structured-test source retention, provider exceptions, and noncanonical callback results. Source observation follows actual callback effects; original direct testimony supplies receiving credit; structural record projection alone does not.

## Limits

The independent source review found no remaining blocker within these contracts. Actual host authentication and correct original source observation remain selected-provider obligations. Local protocol fixtures do not establish production customer receiving, deployment, immutable package publication, or installed cohort selection. Final qualification against the issued Cell 185, Chain 64, Graph and Craft cohort is separately owned by the coordinator. The evidence module later adds a direct re-export of its already-selected retainedCarrier for the host; the historical source hash above describes the original review cut. No remote publication was performed by this reviewer.

## Artifact digests

- `receiving-boundaries.test.mjs` — SHA-256 `c80060d97221f41ade1f1e4349cd36742fadd6be83c42254d314a2fce144db27`
- `corrected-eight.tap` — SHA-256 `39947846ca9eed4cc274d68071f76c26f59f446eaad63b28e267e75ea751b27d`
- `final-boundaries.tap` — SHA-256 `a6c44662fcd9f24fe356a614e0ff45b717e411b5040f3377efb548eff9365537`

## Coordinator follow-through

A later coordinator counterexample found that a mutating resolver `match` could
let context construction or an attempted producer run before the source change
was observed. The enrolled case in `test/solve-loop.test.mjs` first failed with
one later callback actually invoked. An immediate source observation after
selection now stops all later callbacks for false, true, and throwing matches.
The same native selected case passes. The original 13 independent assertion
bodies remain unchanged; final installed-cohort receiving includes this case.

The independent reviewer subsequently read the coordinator selection guard and
its actual enrolled regression. Relative to the earlier reviewed source, the
only runtime change is the baseline capture, observation after selection and
recovery return before another callback. Review found no remaining defect in
this synchronous path; resolver ranking and the original 13 assertion bodies
remain unchanged.
