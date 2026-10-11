// Script-first deterministic resolver selection for the software solve loop.
// (MetroPlat-style determinism), and a model is spent only when no script matches. The RSI
// arc grows this registry — a task-class the model keeps solving becomes a new resolver, so
// model reliance shrinks over time.
//
// A resolver is: { name, match({task}) -> bool, attempt({task, workdir}) -> result }
//   result: { patch } (loop applies it) | { mutated: true } (already changed the tree) | null

import { runCommand } from "@red-cup-engineering/javascript-node-services-section/run-sandboxed-command";

// Try resolvers in order; return the first whose match() is true (regardless of whether its
// attempt succeeds — matching claims the class). Callers apply/test the returned attempt.
export function selectResolver(resolvers, task) {
  for (const r of resolvers || []) {
    try { if (r.match({ task })) return r; } catch { /* a resolver that throws on match is skipped */ }
  }
  return null;
}

// Example real resolver: run the repo's own autofix (formatter/linter) and let the change
// stand if it exists. Deterministic, no model. Demonstrates the script-first path.
export function autofixResolver({ name = "repo-autofix", command, matches = () => false } = {}) {
  return {
    name,
    match: ({ task }) => Boolean(matches(task)),
    attempt: ({ workdir }) => {
      if (!command) return null;
      const r = runCommand(command, { cwd: workdir });
      return r.code === 0 ? { mutated: true } : null;
    },
  };
}
