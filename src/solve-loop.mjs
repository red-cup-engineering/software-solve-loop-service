// Contracted software solve loop: resolver -> context -> source proposal ->
// behavior tests -> further proposals. Never retry against a dirty workspace.
import { selectResolver } from "./resolvers.mjs";

export const DEFAULTS = { maxFreeRounds: 4 };
const explanation = error => error instanceof Error ? error.message : String(error);

export async function solveLoop({
  workdir, task, resolvers = [], buildContext = null,
  generatePatch, applyPatch, runTests, refine = null, difficulty = null,
  maxFreeRounds = DEFAULTS.maxFreeRounds,
}) {
  if (!Number.isSafeInteger(maxFreeRounds) || maxFreeRounds < 0 || maxFreeRounds > 16)
    throw new RangeError("maxFreeRounds must be an integer from 0 through 16");

  const log = [];
  const context = { task, failures: [] };
  const stopUnclean = stage => finish("failed", log, {
    solvedBy: null, worktreeNeedsRecovery: true, stoppedAt: stage,
  });

  const restore = async (applied, stage) => {
    if (typeof applied?.rollback !== "function") {
      context.failures.push({ stage, rollback: "not provided" });
      return false;
    }
    try {
      const result = await applied.rollback();
      if (result?.restored === true) return true;
      context.failures.push({ stage, rollback: "not verified restored" });
    } catch (error) {
      context.failures.push({ stage, rollback: explanation(error) });
    }
    return false;
  };

  const applyAndTest = async (attempt, stage) => {
    if (!attempt?.mutated && !attempt?.patch)
      return { passed: false, clean: true, tested: false };

    let applied;
    if (attempt.mutated) {
      applied = { ok: true, rollback: attempt.rollback };
    } else {
      try { applied = await applyPatch(workdir, attempt.patch); }
      catch (error) {
        context.failures.push({ stage, apply: explanation(error) });
        // A thrown write may already have changed part of the worktree.
        return { passed: false, clean: false, tested: false };
      }
    }

    if (!applied?.ok) {
      context.failures.push({ stage, apply: applied?.error ?? "patch refused" });
      const clean = applied?.unchanged === true || await restore(applied, stage);
      return { passed: false, clean, tested: false };
    }

    let tested;
    try { tested = await runTests(workdir); }
    catch (error) { tested = { passed: false, output: explanation(error) }; }
    if (tested?.passed === true)
      return { passed: true, clean: true, tested: true };
    context.failures.push({ stage, test: tested?.output ?? "tests did not pass" });
    const clean = await restore(applied, stage);
    return { passed: false, clean, tested: true };
  };

  const runRefinement = async reason => {
    log.push({ stage: "downward-refinement", reason });
    if (!refine) return finish("failed", log, { solvedBy: null });
    const candidate = await refine({ workdir, task, context, log,
      difficulty: Math.min(difficulty ?? 0.45, 0.45) });
    const result = await applyAndTest(candidate, "market-refinement");
    log.push({ stage: "refinement-settled", provider: candidate?.provider ?? null,
      consideration: candidate?.consideration ?? null, passed: result.passed });
    if (!result.clean) return stopUnclean("market-refinement");
    return finish(result.passed ? "solved-refined" : "failed", log, {
      solvedBy: result.passed ? (candidate.provider || "cheap-market-inference") : null,
    });
  };

  const resolver = selectResolver(resolvers, task);
  if (resolver) {
    log.push({ stage: "resolver", name: resolver.name });
    let attempt;
    try { attempt = await resolver.attempt({ task, workdir }); }
    catch (error) {
      context.failures.push({ stage: "resolver:" + resolver.name, apply: explanation(error) });
      return stopUnclean("resolver:" + resolver.name);
    }
    const outcome = await applyAndTest(attempt, "resolver:" + resolver.name);
    if (outcome.passed)
      return finish("solved-resolver", log, { solvedBy: "resolver:" + resolver.name });
    log.push({ stage: "resolver-miss", name: resolver.name });
    if (!outcome.clean) return stopUnclean("resolver:" + resolver.name);
  }

  const built = buildContext ? await buildContext({
    task, workdir, failures: context.failures,
  }) : { task };
  Object.assign(context, built);
  const ctx = { ...built, failures: context.failures };

  for (let round = 1; round <= maxFreeRounds; round++) {
    const gen = await generatePatch({ ...ctx, round });
    if (!gen?.patch) { log.push({ round, event: "no-patch" }); break; }
    const outcome = await applyAndTest(gen, "model:" + round);
    log.push({ round, event: outcome.tested ? "tested" : "apply-failed",
      passed: outcome.passed });
    if (outcome.passed)
      return finish("solved-free", log, { solvedBy: "free-model", rounds: round });
    if (!outcome.clean) return stopUnclean("model:" + round);
  }

  return runRefinement("cheap rounds exhausted; narrow the unresolved residue");
}

function finish(status, log, extra = {}) {
  return { status, log, freeRounds: log.filter(entry => entry.event === "tested").length, ...extra };
}
