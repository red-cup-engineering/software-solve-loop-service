import { KnowledgeBase } from "@red-cup-engineering/signcraft/knowledge-base";
import { admitCell, cell, cellSet, cellSetAddress, coincides, measured, retainedCarrier,
  sectionReading, selectCellSet, semanticId } from "@red-cup-engineering/signcraft/cell";

// Hosts retaining a receiving envelope must use this same selected Cell owner.
export { retainedCarrier };

export const vocabulary = Object.freeze({
  type: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  sourceCode: "https://schema.org/SoftwareSourceCode",
  associatedWith: "http://www.w3.org/ns/prov#wasAssociatedWith",
  derivedFrom: "http://www.w3.org/ns/prov#wasDerivedFrom",
  used: "http://www.w3.org/ns/prov#used",
});
const text = (value, role) => {
  if (typeof value !== "string" || !value.trim())
    throw new TypeError("solve-loop: " + role + " must be nonempty text");
  return value;
};

export function sourceCoordinate(value, role = "source") {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== 2)
    throw new TypeError("solve-loop: " + role + " requires only resource and revision");
  return retainedCarrier({resource: text(value.resource, role + ".resource"),
    revision: text(value.revision, role + ".revision")});
}

/** Consume the original Group Requirement, without interpreting its clauses. */
export function requirementCut(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("solve-loop: an original Requirement is required");
  const requirement = retainedCarrier(input);
  if (!requirement || requirement.kind !== "requirement" ||
      typeof requirement.id !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(requirement.id) ||
      !Array.isArray(requirement["met-when"]) || !requirement["met-when"].length)
    throw new TypeError("solve-loop: an original Requirement with met-when conditions is required");
  const ids = new Set();
  for (const condition of requirement["met-when"]) {
    if (!condition || typeof condition.cell !== "string" ||
        !condition.cell.startsWith(requirement.id + ":") || ids.has(condition.cell) ||
        condition.target !== "held" || typeof condition.says !== "string" || !condition.says.trim())
      throw new TypeError("solve-loop: conditions must have unique source-owned IDs and target held");
    ids.add(condition.cell);
  }
  return Object.freeze({requirement,
    source: sourceCoordinate({resource: requirement.id, revision: semanticId(requirement)})});
}

/** Ephemeral source knowledge. Durable custody remains with the host's chain. */
export class SolveEvidence {
  #cells = Object.freeze([]);
  #knowledge = new KnowledgeBase();
  #sequence = 0;
  #receipts = Object.freeze([]);
  #settlement;

  constructor({run, producer, receiver = null, requirement, task, cells = []}) {
    this.run = text(run, "run");
    this.producer = text(producer, "producer");
    this.receiver = receiver === null ? null : text(receiver, "receiver");
    if (this.receiver === this.producer)
      throw new TypeError("solve-loop: receiving provider must be independent of producer");
    const cut = requirementCut(requirement);
    this.requirement = cut.requirement;
    this.source = cut.source;
    this.add(cells);
    this.record(this.source, this.requirement);
    this.record({resource: this.run, revision: semanticId(task ?? {})}, task ?? {});
    this.add([cell(this.run, vocabulary.associatedWith, this.producer, {for: [this.run]}),
      cell(this.run, vocabulary.used, this.source, {for: [this.run]})]);
  }

  add(input) {
    const cells = [...input].map(admitCell);
    KnowledgeBase.fromCells(cells); // whole-cut admission before changing state
    const joined = cellSet([...this.#cells, ...cells]);
    if (cellSetAddress(joined) === cellSetAddress(this.#cells)) return;
    this.#knowledge = KnowledgeBase.fromCells(joined);
    this.#cells = joined;
    this.#settlement = undefined;
  }

  record(source, value) {
    // This constructor emits witnessed structural source cells. Its native log
    // is the source reading; settling it first would re-admit derived values.
    this.add(KnowledgeBase.fromRelationalValues([{value, ...source}]).log.cells());
  }

  note(name, data = {}) {
    const occurrence = {run: this.run, sequence: ++this.#sequence};
    const event = retainedCarrier({"@type": "https://schema.org/Action",
      name, agent: this.producer, occurrence, ...data});
    const source = {resource: semanticId(occurrence), revision: semanticId(event)};
    this.record(source, event);
    return source;
  }

  candidate(value) {
    const candidate = sourceCoordinate(value, "candidate");
    const occurrence = this.note("candidate-observed", {object: candidate});
    this.add([cell(candidate, vocabulary.type, vocabulary.sourceCode, {for: [occurrence]}),
      cell(candidate, vocabulary.derivedFrom, this.source, {for: [occurrence]})]);
    return candidate;
  }

  receive(raw, candidate) {
    const receipt = retainedCarrier(raw);
    // Receiving a canonical envelope is observable even when it is refused.
    // Structural projection never admits the embedded cells as testimony.
    this.record({resource: semanticId([this.run, "receipt-observed", receipt]),
      revision: semanticId(receipt)}, receipt);
    if (!this.receiver || !receipt || receipt.receiver !== this.receiver ||
        !coincides(receipt.candidate, candidate) ||
        !coincides(receipt.requirement, this.source) || !Array.isArray(receipt.cells))
      throw new TypeError("solve-loop: receipt must name selected receiver and exact candidate/Requirement cut");
    const source = sourceCoordinate({resource: receipt.resource, revision: receipt.revision}, "receipt");
    const cells = receipt.cells.map(admitCell);
    const conditionIds = new Set(this.requirement["met-when"].map(c => c.cell));
    if (cells.some(at => !coincides(at.subject, candidate) ||
        !coincides(at.object, this.source) || !conditionIds.has(at.predicate)))
      throw new TypeError("solve-loop: every receiving Cell must belong to this exact candidate, Requirement and condition");
    if (cells.some(at => !measured(at)))
      throw new TypeError("solve-loop: receiving Cells must carry measured original witnesses");
    KnowledgeBase.fromCells(cells);
    const envelope = KnowledgeBase.fromRelationalValues([{value: receipt, ...source}]);
    this.add([...envelope.log.cells(), ...cells]);
    this.#receipts = cellSet([...this.#receipts, ...cells]);
    return this.assess(candidate);
  }

  assess(candidate) {
    const conditions = this.requirement["met-when"].map(condition => {
      const query = {subject: candidate, predicate: condition.cell, object: this.source};
      const receipt = selectCellSet(this.#receipts, query)[0];
      const all = selectCellSet(this.#cells, query)[0];
      // Host policy selects eligible witness lanes; native FOUR reads them.
      const eligible = cell(candidate, condition.cell, this.source, {
        for: receipt?.for ?? [], against: all?.against ?? [],
      });
      const reading = sectionReading([eligible]).entries[0].reading;
      return Object.freeze({condition: condition.cell, target: condition.target, reading,
        receivingCell: receipt ?? null, sourceCell: all ?? null});
    });
    const state = conditions.some(c => c.reading === "contested") ? "contested" :
      conditions.some(c => c.reading === "denied") ? "denied" :
      conditions.every(c => c.reading === "held") ? "accepted" : "unknown";
    return Object.freeze({state, conditions: Object.freeze(conditions)});
  }

  snapshot({settle = true} = {}) {
    if (!settle) return Object.freeze({cells: this.#cells});
    this.#settlement ??= this.#knowledge.settle();
    return Object.freeze({cells: this.#cells, settlement: this.#settlement});
  }
}
