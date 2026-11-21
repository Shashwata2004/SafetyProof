import type { components } from "./schema";
export function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
  ) {
    return "http://127.0.0.1:8000";
  }
  throw new Error(
    "The public document library is available. Sign-in requires a hosted workspace connection.",
  );
}
type Schema = components["schemas"];
export type Case = Schema["CaseRecord"];
export type Ref = Schema["EvidenceRef"];
export type Review = Schema["ReviewEvent"];
export type Action = Schema["ReviewInput"]["action"];
export type Role = Schema["UploadInput"]["role"];
export type Config = {
  supabase_url: string;
  publishable_key: string;
  ai_configured: boolean;
  models: { llm: string; embedding: string };
};
export type Meta = {
  title: string;
  filename: string;
  role: Role;
  issued_on: string | null;
  period_start: string | null;
  period_end: string | null;
  issuer: string;
  scan?: boolean;
};
export type Catalog = {
  factory: string;
  title: string;
  programme: string;
  period_start: string;
  period_end: string;
  documents: Meta[];
};
export type Doc = { id: string; title: string; role: Role };
export type Version = Meta & {
  id: string;
  document_id: string;
  revision: number;
  status: string;
  page_count: number;
  readable_pages: number;
  error: string | null;
  duplicate_of?: string;
};
export type PageInfo = {
  id: string;
  page_no: number;
  quality: string;
  method: string;
  text: string;
};
export type Manifest = Meta & {
  id: string;
  document_id: string;
  revision: number;
  page_count: number;
  readable_pages: number;
  sha256: string;
};
export type Run = {
  id: string;
  created_at: string;
  status: string;
  manifest: Manifest[];
  config: {
    llm: string;
    embedding: string;
    pipeline: string;
    second_opinion: string;
  };
  usage: {
    claims?: number;
    unanchored_extractions?: number;
    uncertain_pages?: number;
    requests?: number;
  };
};
export type Job = {
  id: string;
  kind: string;
  version_id: string | null;
  run_id: string | null;
  state: string;
  stage: string;
  completed: number;
  total: number;
  error: string | null;
};
export type Dossier = {
  case: Case;
  role: "reviewer" | "viewer" | "manager";
  documents: Doc[];
  versions: Version[];
  runs: Run[];
  jobs: Job[];
};
export type Outcome = Schema["PublishedResult"]["outcome"];
export type Result = {
  id: string;
  outcome: Outcome;
  reason: string;
  claim: {
    source: Ref;
    kind: string;
    severity: string;
    asset?: string;
    start_date?: string;
    end_date?: string;
  };
  evidence: Ref[];
  checks: { secondary: string; scope: string };
  coverage: {
    documents: {
      version_id: string;
      document: string;
      pages: number;
      readable: number;
    }[];
    full_search: boolean;
    unreadable_pages: number;
  };
  reviews: Review[];
};

export type FollowUp = {
  id: string;
  run_id: string;
  source: Ref;
  event: Review;
};
export type CapAction = {
  id: string;
  source: Ref;
  action_ref: string | null;
  finding_refs: string[];
  asset: string | null;
  location: string | null;
  deadline: string | null;
  reported_status: string | null;
};
export type CapSuggestion = {
  finding_id: string;
  action_id: string;
  basis: "explicit_reference" | "same_asset";
  reason: string;
};
export type CapAnalysis = {
  actions: CapAction[];
  suggestions: CapSuggestion[];
  coverage: {
    complete: boolean;
    documents?: number;
    unreadable_pages?: number;
    unanchored_actions?: number;
  };
  error?: string;
};
export type CapReview = {
  id: string;
  finding_id: string;
  action_id: string;
  actor: string;
  decision: "confirm" | "dismiss";
  comment: string;
  created_at: string;
};

export async function api<T>(
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const resp = await fetch(apiBase() + path, {
    method,
    signal,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    const detail = Array.isArray(data.detail)
      ? data.detail.map((d: { msg: string }) => d.msg).join(" ")
      : data.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : "The request could not be completed.",
    );
  }
  return resp.json();
}
export const roles: Record<Role, string> = {
  inspection: "Inspection report",
  incident: "Incident register",
  sop: "Operating procedure",
  drill: "Drill record",
  maintenance: "Maintenance record",
  cap: "Corrective Action Plan (CAP)",
  other: "Supporting record",
};
export const outcomes: Record<Outcome, string> = {
  contradicted: "Contradiction",
  unsupported: "Unsupported claim",
  unresolved: "Missing closure",
  supported: "Supported",
  needs_review: "Needs review",
  not_assessed: "Not assessed",
};
export const dateText = (s?: string | null) =>
  s
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(s))
    : "Date unknown";
export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}
