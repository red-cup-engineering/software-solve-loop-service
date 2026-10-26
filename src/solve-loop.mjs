// Effects belong to the host. Source knowledge and settlement use SignCraft.
import { coincides } from "@red-cup-engineering/signcraft/cell";
import { selectResolver } from "./resolvers.mjs";
import { SolveEvidence, sourceCoordinate } from "./evidence.mjs";

export const DEFAULTS = Object.freeze({maxFreeRounds: 4});
const explanation = error => error instanceof Error ? error.message : String(error);

export async function solveLoop({
  workdir, task, requirement, run, producer, receiver = null, cells = [],
  resolvers = [], buildContext = null, generatePatch, applyPatch, runTests,
  observeCandidate, receiveCandidate = null, refine = null, difficulty = null,
  maxFreeRounds = DEFAULTS.maxFreeRounds,
}) {
  if (!Number.isSafeInteger(maxFreeRounds) || maxFreeRounds < 0 || maxFreeRounds > 16)
    throw new RangeError("maxFreeRounds must be an integer from 0 through 16");
  if (typeof runTests !== "function" || typeof observeCandidate !== "function")
    throw new TypeError("solve-loop: runTests and observeCandidate are required");
  if (receiveCandidate !== null && (typeof receiveCandidate !== "function" || !receiver))
    throw new TypeError("solve-loop: receiving requires a selected provider and callback");
  const evidence = new SolveEvidence({run, producer, receiver, requirement, task, cells});
  let testedRounds = 0, lastAssessment = null, lastCandidate = null, currentCandidate = null;
  const context = () => Object.freeze({
    task, requirement: evidence.requirement, requirementSource: evidence.source,
    evidence: evidence.snapshot({settle: false}), assessment: lastAssessment,
  });
  const finish = (status, extra = {}) => Object.freeze({
    status, freeRounds: testedRounds, currentCandidate, lastAttemptedCandidate: lastCandidate,
    candidate: ["accepted", "verified"].includes(status) ? currentCandidate : null,
    requirement: evidence.source, assessment: lastAssessment, ...extra, ...evidence.snapshot(),
  });
  const stopUnclean = stage => finish("needs-recovery", {
    worktreeNeedsRecovery: true, stoppedAt: stage,
  });
  const observe = async stage => {
    try {
      currentCandidate = sourceCoordinate(await observeCandidate(workdir, context()), "observed candidate");
      evidence.note("source-observed", {stage, candidate: currentCandidate});
      return currentCandidate;
    } catch (error) {
      currentCandidate = null;
      evidence.note("source-observation-failed", {stage, error: explanation(error)});
      return null;
    }
  };
  const unchanged = async (expected, stage) => {
    const observed = await observe(stage);
    const same = observed !== null && coincides(observed, expected);
    if (!same) evidence.note("source-cut-changed", {stage, expected, observed});
    return same;
  };
  const restore = async (applied, stage, baseline) => {
    if (typeof applied?.rollback !== "function") {
      evidence.note("rollback-unavailable", {stage});
      return false;
    }
    let reported = false;
    try {
      const result = await applied.rollback();
      reported = result?.restored === true;
      evidence.note("rollback-observed", {stage, result: result ?? null});
    } catch (error) {
      evidence.note("rollback-error", {stage, error: explanation(error)});
    }
    const same = await unchanged(baseline, stage + ":restored");
    return reported && same;
  };

  if (await observe("initial") === null) return stopUnclean("initial");

  const applyAndTest = async (attempt, stage, baseline) => {
    if (!attempt?.mutated && !attempt?.patch)
      return {clean: await unchanged(baseline, stage + ":no-candidate")};
    let applied;
    if (attempt.mutated) applied = {ok: true, rollback: attempt.rollback, candidate: attempt.candidate};
    else {
      if (!await unchanged(baseline, stage + ":before-apply")) return {clean: false};
      if (typeof applyPatch !== "function") throw new TypeError("solve-loop: applyPatch is required for a patch");
      try { applied = await applyPatch(workdir, attempt.patch, context()); }
      catch (error) {
        evidence.note("application-error", {stage, error: explanation(error)});
        await observe(stage + ":application-error");
        return {clean: false};
      }
    }
    if (!applied?.ok) {
      evidence.note("application-refused", {stage, error: String(applied?.error ?? "patch refused")});
      const clean = applied?.unchanged === true
        ? await unchanged(baseline, stage + ":refused")
        : await restore(applied, stage, baseline);
      return {clean};
    }
    let candidate;
    try { candidate = evidence.candidate(applied.candidate); }
    catch (error) {
      evidence.note("candidate-identity-refused", {stage, error: explanation(error)});
      return {clean: await restore(applied, stage, baseline)};
    }
    lastCandidate = candidate;
    lastAssessment = evidence.assess(candidate);
    if (!await unchanged(candidate, stage + ":applied"))
      return {clean: await restore(applied, stage, baseline)};
    let tested;
    try { tested = await runTests(workdir, {...context(), candidate}); }
    catch (error) { tested = {passed: false, error: explanation(error)}; }
    try { evidence.note("tests-observed", {stage, candidate, result: tested ?? null}); }
    catch (error) {
      evidence.note("tests-observation-refused", {stage, candidate, error: explanation(error)});
      await observe(stage + ":tests-observation-refused");
      return {clean: await restore(applied, stage, baseline)};
    }
    if (stage.startsWith("model:")) testedRounds++;
    if (!await unchanged(candidate, stage + ":tested") || tested?.passed !== true)
      return {clean: await restore(applied, stage, baseline)};

    if (receiveCandidate === null) return {clean: true, status: "verified"};
    let receipt;
    try { receipt = await receiveCandidate({workdir, ...context(), candidate}); }
    catch (error) {
      evidence.note("receiving-error", {stage, candidate, error: explanation(error)});
      if (!await unchanged(candidate, stage + ":receiving-error"))
        return {clean: await restore(applied, stage, baseline)};
      return {clean: true, status: "verified"};
    }
    // Retain the observation even if the host changed the code while receiving.
    try { evidence.note("receiving-observed", {stage, candidate, receipt: receipt ?? null}); }
    catch (error) {
      evidence.note("receiving-observation-refused", {stage, candidate, error: explanation(error)});
      await observe(stage + ":receiving-observation-refused");
      return {clean: await restore(applied, stage, baseline)};
    }
    if (!await unchanged(candidate, stage + ":received"))
      return {clean: await restore(applied, stage, baseline)};
    try { lastAssessment = evidence.receive(receipt, candidate); }
    catch (error) {
      evidence.note("receiving-refused", {stage, candidate, error: explanation(error)});
      return {clean: true, status: "verified"};
    }
    if (lastAssessment.state === "accepted") return {clean: true, status: "accepted"};
    if (lastAssessment.state === "unknown") return {clean: true, status: "verified"};
    const clean = await restore(applied, stage, baseline);
    return {clean, ...(lastAssessment.state === "contested" ? {status: "contested"} : {})};
  };
  const conclude = (outcome, stage, provider, extra = {}) => {
    if (!outcome.clean) return stopUnclean(stage);
    return outcome.status ? finish(outcome.status, {provider, ...extra}) : null;
  };
  const beforeSelection = currentCandidate;
  const resolver = selectResolver(resolvers, task);
  if (!await unchanged(beforeSelection, "resolver-selection"))
    return stopUnclean("resolver-selection");
  if (resolver) {
    const stage = "resolver:" + resolver.name, baseline = currentCandidate;
    evidence.note("resolver-selected", {stage});
    let attempt;
    try { attempt = await resolver.attempt({workdir, ...context()}); }
    catch (error) {
      evidence.note("resolver-error", {stage, error: explanation(error)});
      await observe(stage + ":error");
      return stopUnclean(stage);
    }
    const result = conclude(await applyAndTest(attempt, stage, baseline), stage, resolver.name);
    if (result) return result;
  }

  const beforeContext = currentCandidate;
  let built;
  try { built = buildContext ? await buildContext({workdir, ...context()}) : {}; }
  catch (error) {
    evidence.note("context-error", {error: explanation(error)});
    await observe("context:error");
    return stopUnclean("context");
  }
  if (!await unchanged(beforeContext, "context")) return stopUnclean("context");
  for (let round = 1; round <= maxFreeRounds; round++) {
    if (typeof generatePatch !== "function") break;
    const baseline = currentCandidate;
    let candidate;
    try { candidate = await generatePatch({...built, ...context(), round}); }
    catch (error) {
      evidence.note("proposal-error", {round, error: explanation(error)});
      await observe("model:" + round + ":error");
      return stopUnclean("model:" + round);
    }
    if (!await unchanged(baseline, "model:" + round + ":proposal")) return stopUnclean("model:" + round);
    if (!candidate?.patch) { evidence.note("no-proposal", {round}); break; }
    const stage = "model:" + round;
    const result = conclude(await applyAndTest(candidate, stage, baseline), stage,
      candidate.provider ?? "configured-generator", {rounds: round});
    if (result) return result;
  }
  if (refine) {
    evidence.note("refinement-selected");
    const baseline = currentCandidate;
    let candidate;
    try { candidate = await refine({workdir, ...context(), difficulty: Math.min(difficulty ?? 0.45, 0.45)}); }
    catch (error) {
      evidence.note("refinement-error", {error: explanation(error)});
      await observe("refinement:error");
      return stopUnclean("market-refinement");
    }
    if (!candidate?.mutated && !await unchanged(baseline, "refinement:proposal"))
      return stopUnclean("market-refinement");
    const result = conclude(await applyAndTest(candidate, "market-refinement", baseline),
      "market-refinement", candidate?.provider ?? "configured-refiner");
    if (result) return result;
  }
  return finish("unresolved");
}
