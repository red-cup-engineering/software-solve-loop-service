// Contracted software solve loop: resolver -> context -> inference -> verification.
// model rounds -> smaller-context typed market refinement. Every inference act is a proposal; customer-side
// application and testing retain mutation and acceptance. Records WHICH stage solved it, so the loop measures how
// often deterministic scripts suffice — the RSI signal that should trend model-reliance down.
//
// Every dependency is injectable so the policy is deterministically testable.
import { selectResolver } from "./resolvers.mjs";

export const DEFAULTS = { maxFreeRounds: 4 };

export async function solveLoop({
  workdir,
  task,
  resolvers = [],
  buildContext = null,
  generatePatch,
  applyPatch,
  runTests,
  refine = null,
  difficulty = null,
  maxFreeRounds = DEFAULTS.maxFreeRounds,
}) {
  const log = [];
  const context = { task, failures: [] };

  const applyAndTest = async (attempt, label) => {
    if (attempt?.mutated) return (await runTests(workdir)).passed; // resolver changed the tree
    if (!attempt?.patch) return false;
    const applied = await applyPatch(workdir, attempt.patch);
    if (!applied.ok) { context.failures.push({ stage: label, apply: applied.error }); return false; }
    const test = await runTests(workdir);
    if (!test.passed) context.failures.push({ stage: label, test: test.output });
    return test.passed;
  };

  const runRefinement = async (reason) => {
    log.push({ stage: "downward-refinement", reason });
    if (!refine) return finish("failed", log, { solvedBy: null });
    const candidate = await refine({ workdir, task, context, log, difficulty: Math.min(difficulty ?? 0.45, 0.45) });
    const passed = await applyAndTest(candidate, "market-refinement");
    log.push({ stage: "refinement-settled", provider: candidate?.provider || null, consideration: candidate?.consideration || null, passed });
    return finish(passed ? "solved-refined" : "failed", log, { solvedBy: passed ? (candidate.provider || "cheap-market-inference") : null });
  };

  // 0. Script-first: a deterministic resolver that claims this task-class.
  const resolver = selectResolver(resolvers, task);
  if (resolver) {
    log.push({ stage: "resolver", name: resolver.name });
    const attempt = await resolver.attempt({ task, workdir });
    if (await applyAndTest(attempt, `resolver:${resolver.name}`)) {
      return finish("solved-resolver", log, { solvedBy: `resolver:${resolver.name}` });
    }
    log.push({ stage: "resolver-miss", name: resolver.name });
  }

  // 1. Compile customer-owned context before any inference route, including hard work.
  const built = buildContext ? await buildContext({ task, workdir, failures: context.failures }) : { task };
  Object.assign(context, built);

  // 2. Reuse the same admitted context through cheap market rounds with failure feedback.
  const ctx = { ...built, failures: context.failures };
  for (let round = 1; round <= maxFreeRounds; round++) {
    const gen = await generatePatch({ ...ctx, round });
    if (!gen || !gen.patch) { log.push({ round, event: "no-patch" }); break; }
    const applied = await applyPatch(workdir, gen.patch);
    if (!applied.ok) { log.push({ round, event: "apply-failed", error: applied.error }); context.failures.push({ round, apply: applied.error }); continue; }
    const test = await runTests(workdir);
    log.push({ round, event: "tested", passed: test.passed });
    if (test.passed) return finish("solved-free", log, { solvedBy: "free-model", rounds: round });
    context.failures.push({ round, test: test.output });
  }

  // 3. Cheap rounds exhausted -> a smaller-output cheap market lot. Difficulty never rises.
  return runRefinement("cheap rounds exhausted; narrow the unresolved residue");
}

function finish(status, log, extra = {}) {
  return { status, log, freeRounds: log.filter((e) => e.event === "tested").length, ...extra };
}
