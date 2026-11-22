import type { Case, Dossier, Outcome, Result, Run } from "@/lib/api";
import type { ZoneId } from "./demo-data";

export type OfficialEvidenceStatus =
  | "Supported"
  | "Unresolved"
  | "Contradictory"
  | "Insufficient Evidence";

export type EvidenceResult = Omit<Result, "claim"> & {
  claim: Result["claim"] & {
    facility?: string | null;
    location?: string | null;
    finding_id?: string | null;
  };
};

export const officialStatusColors: Record<OfficialEvidenceStatus, string> = {
  Supported: "#34d399",
  Unresolved: "#fbbf24",
  Contradictory: "#fb7185",
  "Insufficient Evidence": "#8b9bb4",
};

const locationAliases = new Map<string, ZoneId>([
  ["fabric storage", "storage"],
  ["cutting", "cutting"],
  ["fabric cutting", "cutting"],
  ["sewing", "sewing"],
  ["sewing line", "sewing"],
  ["finishing", "finishing"],
  ["quality control", "quality"],
  ["quality check", "quality"],
  ["packing", "packing"],
  ["packing and dispatch", "packing"],
]);

function normalizedLabel(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/\s*&\s*/gu, " and ")
    .replace(/\s+/gu, " ");
}

export function officialEvidenceStatus(
  outcome: Outcome,
): OfficialEvidenceStatus | null {
  switch (outcome) {
    case "supported":
      return "Supported";
    case "unresolved":
      return "Unresolved";
    case "contradicted":
      return "Contradictory";
    case "unsupported":
      return "Insufficient Evidence";
    default:
      return null;
  }
}

export function exactEvidenceZone(result: EvidenceResult): ZoneId | null {
  const location = result.claim.location;
  if (typeof location !== "string" || !location.trim()) return null;
  return locationAliases.get(normalizedLabel(location)) ?? null;
}

export function groupEvidenceByZone(results: EvidenceResult[]) {
  const byZone: Record<ZoneId, EvidenceResult[]> = {
    storage: [],
    cutting: [],
    sewing: [],
    finishing: [],
    quality: [],
    packing: [],
  };
  const unassigned: EvidenceResult[] = [];
  for (const result of results) {
    const zone = exactEvidenceZone(result);
    if (zone) byZone[zone].push(result);
    else unassigned.push(result);
  }
  return { byZone, unassigned };
}

export function evidenceStatusCounts(results: EvidenceResult[]) {
  const counts: Record<OfficialEvidenceStatus, number> = {
    Supported: 0,
    Unresolved: 0,
    Contradictory: 0,
    "Insufficient Evidence": 0,
  };
  let unclassified = 0;
  for (const result of results) {
    const status = officialEvidenceStatus(result.outcome);
    if (status) counts[status] += 1;
    else unclassified += 1;
  }
  return { counts, classified: results.length - unclassified, unclassified };
}

export function authorizedFactories(cases: Case[]) {
  return [...new Set(cases.map((item) => item.factory.trim()).filter(Boolean))];
}

export function casesForFactory(cases: Case[], factory: string) {
  return cases.filter((item) => item.factory === factory);
}

export function latestReadableRun(dossier: Dossier): Run | undefined {
  return dossier.runs.find((run) =>
    ["complete", "partial"].includes(run.status),
  );
}
