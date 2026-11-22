import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizedFactories,
  evidenceStatusCounts,
  exactEvidenceZone,
  groupEvidenceByZone,
  officialEvidenceStatus,
} from "../components/design-preview/evidence-intelligence.ts";

function result(outcome, location) {
  return {
    id: `${outcome}-${location ?? "none"}`,
    outcome,
    claim: { location },
    evidence: [],
    reviews: [],
  };
}

test("only exact explicit locations map to factory zones", () => {
  assert.equal(exactEvidenceZone(result("supported", "Sewing Line")), "sewing");
  assert.equal(exactEvidenceZone(result("supported", "Packing & Dispatch")), "packing");
  assert.equal(exactEvidenceZone(result("supported", "near the sewing line")), null);
  assert.equal(exactEvidenceZone(result("supported", null)), null);
});

test("missing and ambiguous locations remain unassigned", () => {
  const grouped = groupEvidenceByZone([
    result("supported", "Quality Control"),
    result("unsupported", "production floor"),
    result("unresolved", undefined),
  ]);
  assert.equal(grouped.byZone.quality.length, 1);
  assert.equal(grouped.unassigned.length, 2);
});

test("backend outcomes use only authoritative evidence categories", () => {
  assert.equal(officialEvidenceStatus("supported"), "Supported");
  assert.equal(officialEvidenceStatus("contradicted"), "Contradictory");
  assert.equal(officialEvidenceStatus("unresolved"), "Unresolved");
  assert.equal(officialEvidenceStatus("unsupported"), "Insufficient Evidence");
  assert.equal(officialEvidenceStatus("needs_review"), null);
  assert.equal(officialEvidenceStatus("not_assessed"), null);
});

test("status counts exclude outcomes without an official mapping", () => {
  const summary = evidenceStatusCounts([
    result("supported", "Sewing"),
    result("unsupported", "Cutting"),
    result("needs_review", "Finishing"),
  ]);
  assert.equal(summary.counts.Supported, 1);
  assert.equal(summary.counts["Insufficient Evidence"], 1);
  assert.equal(summary.classified, 2);
  assert.equal(summary.unclassified, 1);
});

test("factory choices come only from authorized cases", () => {
  assert.deepEqual(
    authorizedFactories([
      { factory: "Orion Garments", id: "1" },
      { factory: "Orion Garments", id: "2" },
      { factory: "Delta Textiles", id: "3" },
    ]),
    ["Orion Garments", "Delta Textiles"],
  );
});
