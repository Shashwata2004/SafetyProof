export type ZoneId =
  | "storage"
  | "cutting"
  | "sewing"
  | "finishing"
  | "quality"
  | "packing";

export type EvidenceCategory =
  | "Supported"
  | "Unresolved"
  | "Contradictory"
  | "Insufficient Evidence";

export const factoryZones: Array<{
  id: ZoneId;
  label: string;
  shortLabel: string;
  position: [number, number, number];
  camera: [number, number, number];
  accent: string;
  evidence: number;
  openFlags: number;
}> = [
  {
    id: "storage",
    label: "Fabric Storage",
    shortLabel: "Storage",
    position: [-5.25, 0.4, 2.8],
    camera: [-1.8, 6.8, 11.6],
    accent: "#38bdf8",
    evidence: 2,
    openFlags: 0,
  },
  {
    id: "cutting",
    label: "Fabric Cutting",
    shortLabel: "Cutting",
    position: [-5.2, 0.4, -2.2],
    camera: [-1.3, 7.2, 10.4],
    accent: "#22d3ee",
    evidence: 4,
    openFlags: 1,
  },
  {
    id: "sewing",
    label: "Sewing Line",
    shortLabel: "Sewing",
    position: [-0.5, 0.5, 0.3],
    camera: [3.2, 6.5, 10.8],
    accent: "#34d399",
    evidence: 6,
    openFlags: 1,
  },
  {
    id: "finishing",
    label: "Finishing",
    shortLabel: "Finishing",
    position: [4.7, 0.4, -2.6],
    camera: [7.9, 6.2, 8.1],
    accent: "#a78bfa",
    evidence: 3,
    openFlags: 0,
  },
  {
    id: "quality",
    label: "Quality Check",
    shortLabel: "Quality",
    position: [4.65, 0.4, 2.45],
    camera: [7.6, 6.4, 9.7],
    accent: "#fbbf24",
    evidence: 3,
    openFlags: 1,
  },
  {
    id: "packing",
    label: "Packing & Dispatch",
    shortLabel: "Packing",
    position: [0.35, 0.4, 3.15],
    camera: [4.7, 6.2, 11.4],
    accent: "#fb7185",
    evidence: 2,
    openFlags: 1,
  },
];

export const evidenceCategories: Array<{
  label: EvidenceCategory;
  value: number;
  color: string;
}> = [
  { label: "Supported", value: 12, color: "#34d399" },
  { label: "Unresolved", value: 3, color: "#fbbf24" },
  { label: "Contradictory", value: 1, color: "#fb7185" },
  { label: "Insufficient Evidence", value: 4, color: "#8b9bb4" },
];

export const reviewTrend = [42, 48, 46, 55, 61, 64, 72];

export const recentEvidence = [
  {
    title: "Emergency exit inspection",
    zone: "Finishing",
    status: "Supported" as EvidenceCategory,
    time: "10:24",
  },
  {
    title: "Machine guard photo set",
    zone: "Sewing",
    status: "Unresolved" as EvidenceCategory,
    time: "09:48",
  },
  {
    title: "Aisle clearance checklist",
    zone: "Packing",
    status: "Insufficient Evidence" as EvidenceCategory,
    time: "09:16",
  },
];

export const demoDisclaimer =
  "Illustrative design-preview data only. It is not a safety score, audit result, or compliance certification.";
