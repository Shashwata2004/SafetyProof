"use client";
import { FormEvent, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  ChevronRight,
  FileSearch,
  History,
  Play,
  Plus,
  RefreshCw,
  ScanLine,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  api,
  dateText,
  Dossier,
  Job,
  PageInfo,
  Role,
  Version,
  message,
  roles,
} from "@/lib/api";
import type { components } from "@/lib/schema";
import { Busy, DocIcon, ErrorNote, Modal, Tag } from "./ui";
import { Preview } from "./viewer";
import { sampleCatalog } from "@/lib/samples";
import {
  documentsForMonth,
  inspectionMonths,
  latestReadyVersions,
} from "@/lib/verification-month";

type Props = {
  dossier: Dossier;
  token: string;
  configured: boolean;
  preview: (p: Preview) => void;
  refresh: () => Promise<void>;
  openedRun: (id: string) => void;
  onRemoved: () => void;
  owner: boolean;
};
const processed = (v: Version) =>
  v.status === "ready" || v.status === "partial";
function latest(versions: Version[]) {
  return latestReadyVersions(versions).map((v) => v.id);
}

export function Documents({
  dossier: d,
  token,
  configured,
  preview,
  refresh,
  openedRun,
  onRemoved,
  owner,
}: Props) {
  const writable =
    d.role === "reviewer" && !d.case.archived && !d.case.deleting;
  const [upload, setUpload] = useState(false),
    [inspect, setInspect] = useState<Version | null>(null),
    [remove, setRemove] = useState(false);
  const [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>(() => latest(d.versions)),
    [custom, setCustom] = useState(false);
  const [month, setMonth] = useState("");
  const [selectionOpen, setSelectionOpen] = useState(false);
  const versionKey = d.versions.map((v) => v.id + v.status).join(",");
  useEffect(() => {
    if (!custom)
      setSelected(
        month
          ? documentsForMonth(
              d.documents,
              d.versions,
              month,
              d.case.inspection_on,
            )
          : latest(d.versions),
      );
  }, [
    versionKey,
    custom,
    month,
    d.documents,
    d.versions,
    d.case.inspection_on,
  ]);
  function toggle(v: Version) {
    setCustom(true);
    setSelected((prev) =>
      prev.includes(v.id)
        ? prev.filter((id) => id !== v.id)
        : [
            ...prev.filter(
              (id) =>
                d.versions.find((x) => x.id === id)?.document_id !==
                v.document_id,
            ),
            v.id,
          ],
    );
  }
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function chooseMonth(value: string) {
    setMonth(value);
    setCustom(false);
    setSelectionOpen(true);
    setBusy(true);
    setErr("");
    try {
      await refresh();
    } catch (error) {
      setErr(message(error));
    } finally {
      setBusy(false);
    }
  }
  const sel = d.versions.filter((v) => selected.includes(v.id)),
    count = sel.reduce((a, v) => a + v.readable_pages, 0),
    pages = sel.reduce((a, v) => a + v.page_count, 0);
  const hasInspection = sel.some(
    (v) =>
      d.documents.find((doc) => doc.id === v.document_id)?.role ===
      "inspection",
  );
  const hasMonthInspection =
    !month ||
    sel.some((v) => {
      if (
        d.documents.find((doc) => doc.id === v.document_id)?.role !==
        "inspection"
      )
        return false;
      const from = (v.period_start || v.period_end || v.issued_on)?.slice(0, 7);
      const to = (v.period_end || v.period_start || v.issued_on)?.slice(0, 7);
      return !!from && !!to && from <= month && to >= month;
    });
  const valid =
    sel.length >= 2 && sel.length <= 10 && hasInspection && hasMonthInspection;
  const availableIds = new Set(latest(d.versions));
  const months = inspectionMonths(d.documents, d.versions);
  const choices = d.versions.filter(
    (v) => selected.includes(v.id) || availableIds.has(v.id),
  );
  async function run() {
    await act(async () => {
      const r = await api<components["schemas"]["RunTicket"]>(
        "/v1/cases/" + d.case.id + "/runs",
        token,
        "POST",
        { version_ids: selected, request_key: crypto.randomUUID() },
      );
      openedRun(r.run_id);
    });
  }
  return (
    <>
      <div className="work-grid">
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Case documents</h2>
              <p>
                {d.case.inspection_on
                  ? "Upload the inspection report here. The factory manager submits CAPs, incident records and other factory evidence."
                  : "Select the versions to include in this review."}
              </p>
            </div>
            {writable && (
              <button onClick={() => setUpload(true)}>
                <Plus size={15} />
                Add PDF
              </button>
            )}
          </div>
          {d.versions.length === 0 ? (
            <div className="blank">
              <div className="large-icon">
                <UploadCloud />
              </div>
              <h3>Add your first documents</h3>
              <p>
                {d.case.inspection_on
                  ? "Upload your inspection report to make it available to the factory manager."
                  : "Upload an inspection report and the records you want to compare."}
              </p>
              {writable && (
                <button onClick={() => setUpload(true)}>Choose PDF</button>
              )}
            </div>
          ) : (
            d.versions.map((v) => {
              const doc = d.documents.find((x) => x.id === v.document_id)!;
              return (
                <div className="version-row" key={v.id}>
                  <input
                    type="checkbox"
                    aria-label={
                      "Include " + doc.title + " revision " + v.revision
                    }
                    disabled={!writable || !processed(v)}
                    checked={selected.includes(v.id)}
                    onChange={() => toggle(v)}
                  />
                  <DocIcon role={doc.role} />
                  <div className="row-main">
                    <b>{doc.title}</b>
                    <small>
                      {roles[doc.role]} · Revision {v.revision} · {v.filename}
                    </small>
                    <small>Factory · {d.case.factory}</small>
                    <div className="row-meta">
                      <Tag
                        tone={
                          v.status === "ready"
                            ? "green"
                            : v.status === "partial"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {v.status.replaceAll("_", " ")}
                      </Tag>
                      {processed(v) && (
                        <small>
                          {v.readable_pages}/{v.page_count} readable pages
                        </small>
                      )}
                    </div>
                    {v.error && <small className="error-text">{v.error}</small>}
                  </div>
                  {processed(v) && (
                    <button
                      className="icon-button"
                      aria-label={"Inspect " + doc.title}
                      onClick={() => setInspect(v)}
                    >
                      <FileSearch size={18} />
                    </button>
                  )}
                </div>
              );
            })
          )}
          {writable &&
            !d.case.inspection_on &&
            d.case.factory === sampleCatalog.factory &&
            d.documents.length < sampleCatalog.documents.length && (
              <div className="panel-pad">
                <button
                  disabled={busy}
                  onClick={() =>
                    void act(() =>
                      api("/v1/cases/" + d.case.id + "/samples", token, "POST"),
                    )
                  }
                >
                  Load sample documents
                </button>
              </div>
            )}
        </section>
        <aside className="panel run-card">
          <span className="large-icon">
            <ScanLine />
          </span>
          <h2>Verify evidence</h2>
          <p>
            Compare the selected records and review the source passage behind
            each flag.
          </p>
          <div className="verification-month">
            <label htmlFor="verification-month">Verification month</label>
            <select
              id="verification-month"
              value={month}
              disabled={!writable || busy || months.length === 0}
              onChange={(event) => void chooseMonth(event.target.value)}
            >
              <option value="">
                {months.length
                  ? "Choose inspection month"
                  : "No inspection months available"}
              </option>
              {months.map((value) => (
                <option key={value} value={value}>
                  {new Intl.DateTimeFormat("en", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${value}-01T00:00:00Z`))}
                </option>
              ))}
            </select>
          </div>
          <p className="hint">
            Only months covered by a processed inspection report are available.
          </p>
          {month && (
            <p className="hint">
              Includes this month’s records, the previous inspection, CAPs and
              procedures available by month-end. Check for any missing drill or
              follow-up records and adjust the selection below.
            </p>
          )}
          <details
            className="verification-selection"
            open={selectionOpen}
            onToggle={(event) => setSelectionOpen(event.currentTarget.open)}
          >
            <summary>
              Documents to verify ({sel.length}){custom ? " · adjusted" : ""}
            </summary>
            <div className="verification-choices">
              {choices.length ? (
                choices.map((v) => {
                  const doc = d.documents.find(
                    (item) => item.id === v.document_id,
                  )!;
                  return (
                    <label key={v.id} className="verification-choice">
                      <input
                        type="checkbox"
                        aria-label={`Verify ${doc.title} revision ${v.revision}`}
                        checked={selected.includes(v.id)}
                        disabled={!writable || busy}
                        onChange={() => toggle(v)}
                      />
                      <span>
                        <b>{doc.title}</b>
                        <small>
                          {roles[doc.role]} · Revision {v.revision}
                        </small>
                        <small>
                          {v.period_start || v.issued_on || "Date not provided"}
                          {v.period_end && v.period_end !== v.period_start
                            ? ` – ${v.period_end}`
                            : ""}
                        </small>
                      </span>
                    </label>
                  );
                })
              ) : (
                <p>No processed documents are available yet.</p>
              )}
            </div>
            {month && (
              <button
                disabled={!writable || busy}
                onClick={() => void chooseMonth(month)}
              >
                {custom ? "Restore month selection" : "Refresh month selection"}
              </button>
            )}
          </details>
          <dl>
            <div>
              <dt>Selected documents</dt>
              <dd>{sel.length}</dd>
            </div>
            <div>
              <dt>Readable pages</dt>
              <dd>
                {count} / {pages}
              </dd>
            </div>
          </dl>
          {pages > count && (
            <p className="callout">
              Coverage is incomplete. Missing-evidence checks may require
              review.
            </p>
          )}
          {!configured && (
            <p className="callout">
              Hosted verification is waiting for the server’s Gemini key.
            </p>
          )}
          {!valid && (
            <p className="hint">
              {!hasMonthInspection
                ? "Add or select an inspection report covering this month."
                : sel.length > 10
                  ? "Select up to 10 documents for one verification run."
                  : "Select an inspection and at least one other document."}
            </p>
          )}
          {writable && (
            <button
              className="primary block"
              disabled={!configured || !valid || busy}
              onClick={run}
            >
              <Play size={15} />
              Run verification
            </button>
          )}
        </aside>
      </div>
      {err && <ErrorNote text={err} />}
      {d.jobs.some((j) => j.state !== "done") && (
        <section className="panel">
          <div className="section-head">
            <h2>Processing activity</h2>
          </div>
          {d.jobs
            .filter((j) => j.state !== "done")
            .map((j) => (
              <JobRow
                key={j.id}
                job={j}
                retry={
                  writable
                    ? () =>
                        void act(() =>
                          api("/v1/jobs/" + j.id + "/retry", token, "POST"),
                        )
                    : undefined
                }
              />
            ))}
        </section>
      )}
      {owner && (
        <details className="case-options">
          <summary>Case settings</summary>
          <div>
            <button
              disabled={busy}
              onClick={() =>
                void act(() =>
                  api("/v1/cases/" + d.case.id, token, "PATCH", {
                    archived: !d.case.archived,
                  }),
                )
              }
            >
              <Archive size={15} />
              {d.case.archived ? "Restore case" : "Archive case"}
            </button>
            <button onClick={() => setRemove(true)}>
              <Trash2 size={15} />
              Delete case
            </button>
          </div>
        </details>
      )}
      {remove && (
        <Modal title="Delete this case?" close={() => setRemove(false)}>
          <p>
            All original files, extractions, runs and review decisions in{" "}
            {d.case.title} will be permanently removed.
          </p>
          {err && <ErrorNote text={err} />}
          <div className="form-actions">
            <button onClick={() => setRemove(false)}>Keep case</button>
            <button
              className="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/v1/cases/" + d.case.id, token, "DELETE");
                  onRemoved();
                } catch (e) {
                  setErr(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete case
            </button>
          </div>
        </Modal>
      )}
      {upload && (
        <Upload
          dossier={d}
          token={token}
          close={() => setUpload(false)}
          done={async () => {
            setUpload(false);
            await refresh();
          }}
        />
      )}
      {inspect && (
        <Inspect
          version={inspect}
          token={token}
          title={
            d.documents.find((x) => x.id === inspect.document_id)?.title ||
            inspect.filename
          }
          close={() => setInspect(null)}
          preview={preview}
        />
      )}
    </>
  );
}

export function JobRow({ job: j, retry }: { job: Job; retry?: () => void }) {
  return (
    <div className="file-row">
      <span className="doc-icon other">
        <History size={17} />
      </span>
      <span className="row-main">
        <b>{j.stage}</b>
        <small>
          {j.error || j.kind}{" "}
          {j.total > 0 && " · " + j.completed + "/" + j.total}
        </small>
      </span>
      <Tag tone={["failed", "paused"].includes(j.state) ? "amber" : ""}>
        {j.state}
      </Tag>
      {retry && ["failed", "paused"].includes(j.state) && (
        <button onClick={retry}>
          <RefreshCw size={13} />
          Retry
        </button>
      )}
    </div>
  );
}

function Inspect({
  version: v,
  title,
  token,
  close,
  preview,
}: {
  version: Version;
  title: string;
  token: string;
  close: () => void;
  preview: (p: Preview) => void;
}) {
  const [pageOffset, setPageOffset] = useState(0);
  const pageBatch = 8;
  const q = useQuery({
    queryKey: ["pages", v.id, pageOffset],
    queryFn: () =>
      api<PageInfo[]>(
        `/v1/document-versions/${v.id}/pages?offset=${pageOffset}&limit=${pageBatch}`,
        token,
      ),
  });
  return (
    <Modal title={title} close={close}>
      <div className="inline-actions">
        <Tag>Revision {v.revision}</Tag>
        <button
          onClick={() => {
            close();
            preview({ version: v.id, title });
          }}
        >
          Open original PDF <ChevronRight size={14} />
        </button>
      </div>
      {v.page_count > pageBatch && (
        <div className="inline-actions">
          <button
            disabled={pageOffset === 0}
            onClick={() => setPageOffset(pageOffset - pageBatch)}
          >
            Previous pages
          </button>
          <span aria-live="polite">
            Pages {pageOffset + 1}–
            {Math.min(pageOffset + pageBatch, v.page_count)} of {v.page_count}
          </span>
          <button
            disabled={pageOffset + pageBatch >= v.page_count}
            onClick={() => setPageOffset(pageOffset + pageBatch)}
          >
            Next pages
          </button>
        </div>
      )}
      {q.isLoading ? (
        <Busy />
      ) : q.error ? (
        <ErrorNote text={message(q.error)} />
      ) : (
        q.data?.map((p) => (
          <details className="page-text" key={p.id} open={q.data.length === 1}>
            <summary>
              Page {p.page_no} · {p.method === "ocr" ? "OCR" : "Digital text"} ·{" "}
              {p.quality}
            </summary>
            <pre>{p.text || "No readable text."}</pre>
          </details>
        ))
      )}
    </Modal>
  );
}

export function FactoryDocuments({
  dossier: d,
  token,
  preview,
  refresh,
}: {
  dossier: Dossier;
  token: string;
  preview: (item: Preview) => void;
  refresh: () => Promise<void>;
}) {
  const [upload, setUpload] = useState(false);
  const reports = d.versions.filter((version) =>
    d.documents.some(
      (doc) => doc.id === version.document_id && doc.role === "inspection",
    ),
  );
  const ready = reports.some(processed);
  const canUpload = ready && !d.case.archived && !d.case.deleting;
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Inspection and factory documents</h2>
          <p>
            {ready
              ? "Read the inspection report before preparing the CAP and supporting records."
              : "The reviewer’s report will appear here when it is ready."}
          </p>
        </div>
        {canUpload && (
          <button className="primary" onClick={() => setUpload(true)}>
            <Plus size={16} /> Submit factory PDF
          </button>
        )}
      </div>
      {d.versions.map((version) => {
        const doc = d.documents.find((item) => item.id === version.document_id);
        if (!doc) return null;
        return (
          <div className="admin-row" key={version.id}>
            <div>
              <strong>{doc.title}</strong>
              <small>
                {roles[doc.role]} ·{" "}
                {version.issued_on
                  ? dateText(version.issued_on)
                  : "Date not entered"}{" "}
                · Revision {version.revision}
              </small>
              <small>
                {doc.role === "inspection" ? "From reviewer" : "From factory"}
              </small>
              {version.error && (
                <small className="error-text">{version.error}</small>
              )}
            </div>
            {processed(version) ? (
              <button
                onClick={() =>
                  preview({ title: doc.title, version: version.id })
                }
              >
                Open PDF
              </button>
            ) : (
              <Tag>{version.status.replaceAll("_", " ")}</Tag>
            )}
          </div>
        );
      })}
      {upload && (
        <Upload
          dossier={d}
          token={token}
          close={() => setUpload(false)}
          done={async () => {
            setUpload(false);
            await refresh();
          }}
        />
      )}
    </section>
  );
}

function Upload({
  dossier: d,
  token,
  close,
  done,
}: {
  dossier: Dossier;
  token: string;
  close: () => void;
  done: () => Promise<void>;
}) {
  type ExtractedMetadata = {
    title: string | null;
    role: Role;
    issued_on: string | null;
    inspection_date: string | null;
    period_start: string | null;
    period_end: string | null;
    issuer: string;
    warnings: string[];
    pages_checked: number;
    readable_pages: number;
    content_check:
      | "valid"
      | "invalid"
      | "uncertain"
      | "unavailable"
      | "not_configured"
      | "unreadable"
      | "not_applicable";
    content_reason: string | null;
    content_indicators: string[];
    content_model: string | null;
  };
  const [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [title, setTitle] = useState(""),
    [issuer, setIssuer] = useState("unknown"),
    [issuedOn, setIssuedOn] = useState(""),
    [periodStart, setPeriodStart] = useState(""),
    [periodEnd, setPeriodEnd] = useState(""),
    [extracting, setExtracting] = useState(false),
    [extractError, setExtractError] = useState(""),
    [extracted, setExtracted] = useState<ExtractedMetadata | null>(null),
    [role, setRole] = useState<Role>(
      d.role === "manager" ? "cap" : "inspection",
    );
  const [doc, setDoc] = useState(""),
    [stage, setStage] = useState(""),
    [attempt, setAttempt] = useState(() => crypto.randomUUID());
  const scheduled = !!d.case.inspection_on;
  const inspection = scheduled && d.role === "reviewer";
  const semanticCheckRan =
    !!extracted &&
    ["valid", "invalid", "uncertain", "unavailable"].includes(
      extracted.content_check,
    );
  const invalidInspectionPdf =
    inspection &&
    !!extracted &&
    (semanticCheckRan
      ? extracted.content_check !== "valid"
      : extracted.readable_pages > 0 && extracted.role !== "inspection");
  const semanticFailureMessage =
    extracted?.content_check === "unavailable"
      ? "Gemini could not complete the content check. Check the server configuration and retry."
      : extracted?.content_check === "uncertain"
        ? `The report content could not be confirmed: ${extracted.content_reason || "the text is too ambiguous or incomplete."} Choose a clearer inspection report PDF.`
        : `Invalid document: ${extracted?.content_reason || "the content is not an inspection report."} Choose a relevant inspection report PDF.`;
  const invalidInspectionMessage = !extracted
    ? ""
    : semanticCheckRan
      ? semanticFailureMessage
      : extracted.role === "other"
        ? "Invalid document: the readable PDF could not be identified as an inspection report. Choose an inspection report PDF."
        : `Invalid document: this PDF was identified as “${roles[extracted.role]}”. Reviewers can upload inspection reports only.`;
  const permitted = Object.entries(roles).filter(
    ([key]) =>
      !scheduled ||
      (d.role === "manager" ? key !== "inspection" : key === "inspection"),
  );
  const month = d.case.inspection_on?.slice(0, 7);
  const [year, monthNumber] = (month || "").split("-").map(Number);
  const monthEnd = month
    ? new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10)
    : undefined;
  const bounds = inspection ? { min: `${month}-01`, max: monthEnd } : {};
  async function readPdf(selected: File | null) {
    setFile(selected);
    setExtractError("");
    setExtracted(null);
    setIssuedOn("");
    setPeriodStart("");
    setPeriodEnd("");
    setDoc("");
    setAttempt(crypto.randomUUID());
    if (!selected) {
      setTitle("");
      return;
    }
    setTitle(selected.name.replace(/\.pdf$/i, "").replaceAll("-", " "));
    setExtracting(true);
    try {
      const body = new FormData();
      body.append("file", selected);
      const result = await api<ExtractedMetadata>(
        `/v1/cases/${d.case.id}/inspect-upload`,
        token,
        "POST",
        body,
      );
      if (result.title) setTitle(result.title);
      setIssuedOn(
        (inspection && result.inspection_date) || result.issued_on || "",
      );
      // If the PDF gives a single inspection date but no reporting-period
      // start, use that dated visit as the start. Never invent a period end.
      setPeriodStart(
        result.period_start ||
          (inspection ? result.inspection_date || "" : ""),
      );
      setPeriodEnd(result.period_end || "");
      if (!scheduled && result.issuer) setIssuer(result.issuer);
      const inferredRole = permitted.some(([key]) => key === result.role)
        ? result.role
        : null;
      const warnings = [...result.warnings];
      if (!inferredRole && !(inspection && result.role !== "inspection")) {
        warnings.push(
          `OCR identified this as “${roles[result.role]}”, which is not allowed ` +
            "for this case. Check the PDF and enter the permitted document " +
            "details manually.",
        );
      }
      setExtracted({ ...result, warnings });
      if (inferredRole) setRole(inferredRole);
      const matched = d.documents.find(
        (item) =>
          item.role === (inferredRole || role) &&
          item.title.trim().toLowerCase() ===
            (result.title || "").trim().toLowerCase(),
      );
      if (matched) setDoc(matched.id);
    } catch (error) {
      setExtractError(message(error));
    } finally {
      setExtracting(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || invalidInspectionPdf) return;
    setBusy(true);
    setErr("");
    const form = new FormData(e.currentTarget);
    try {
      setStage("Reserving private upload…");
      const res = await api<components["schemas"]["UploadTicket"]>(
        "/v1/cases/" + d.case.id + "/uploads",
        token,
        "POST",
        {
          request_key: attempt,
          filename: file.name,
          title,
          role,
          document_id: doc || null,
          issued_on: form.get("issued_on") || null,
          period_start: form.get("period_start") || null,
          period_end: form.get("period_end") || null,
          issuer: inspection
            ? "external"
            : d.role === "manager"
              ? "factory"
              : form.get("issuer"),
          confirmed_factory: d.case.factory,
        },
      );
      if (res.upload_url) {
        setStage("Uploading original PDF…");
        const remote = await fetch(res.upload_url, {
          method: "PUT",
          headers: { "Content-Type": "application/pdf", "x-upsert": "false" },
          body: file,
        });
        if (!remote.ok) {
          const info = await remote.json().catch(() => ({}));
          if (
            remote.status !== 409 &&
            !/already exists|duplicate/i.test(info.message || "")
          )
            throw new Error(
              info.message || "The PDF upload failed. Retry this upload.",
            );
        }
      }
      setStage("Queuing text extraction…");
      await api(
        "/v1/document-versions/" + res.version_id + "/finalize",
        token,
        "POST",
      );
      await done();
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Add a document"
      close={() => {
        if (!busy) close();
      }}
    >
      <form onSubmit={submit}>
        <label className="upload-box">
          <UploadCloud size={25} />
          <strong>{file?.name || "Choose a PDF"}</strong>
          <small>
            Digital PDF or printed scan · Large reports process in batches
          </small>
          <input
            type="file"
            accept=".pdf,application/pdf"
            required
            onChange={(e) => void readPdf(e.target.files?.[0] || null)}
          />
        </label>
        {extracting && (
          <p className="hint" role="status">
            Reading the first pages and filling in fields from the PDF…
          </p>
        )}
        {extractError && (
          <p className="callout" role="status">
            Automatic reading could not fill the fields. Enter them manually.
            {` ${extractError}`}
          </p>
        )}
        {extracted && !extractError && (
          <p className="hint" role="status">
            Check the extracted fields before uploading; missing fields can be
            entered manually.
          </p>
        )}
        {inspection && extracted?.content_check === "valid" && (
          <p className="hint" role="status">
            Content check passed: {extracted.content_reason} This checks the
            document type, not whether its claims are true.
          </p>
        )}
        {inspection && extracted?.content_check === "not_configured" && (
          <p className="callout" role="status">
            Gemini content screening is not configured. Only basic OCR document
            type checks are active.
          </p>
        )}
        {inspection && extracted?.content_check === "unreadable" && (
          <p className="callout" role="status">
            The PDF text could not be read, so its content could not be checked.
            Enter the fields manually and make sure this is the inspection
            report.
          </p>
        )}
        {extracted?.warnings.map((warning) => (
          <p className="callout" role="alert" key={warning}>
            {warning}
          </p>
        ))}
        {invalidInspectionPdf && (
          <p className="callout" role="alert">
            {invalidInspectionMessage}
          </p>
        )}
        <label>
          Document title
          <input
            required
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="field-pair">
          <label>
            Document role
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as Role);
                setDoc("");
              }}
            >
              {permitted.map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {!scheduled && (
            <label>
              Issuer
              <select
                name="issuer"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
              >
                <option value="unknown">Unknown</option>
                <option value="factory">Factory</option>
                <option value="external">External reviewer</option>
              </select>
            </label>
          )}
        </div>
        <label>
          Document relationship
          <select value={doc} onChange={(e) => setDoc(e.target.value)}>
            <option value="">New, separate record</option>
            {d.documents
              .filter((v) => v.role === role)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  Revision of {v.title}
                </option>
              ))}
          </select>
        </label>
        <label>
          {inspection ? "Inspection date on the PDF" : "Issue date"}
          <input
            name="issued_on"
            type="date"
            required={inspection}
            value={issuedOn}
            onChange={(e) => setIssuedOn(e.target.value)}
          />
        </label>
        {inspection && (
          <p className="hint">
            Include a readable “Inspection date: YYYY-MM-DD” near the start of
            the PDF. It must match the entered date and fall in {month}.
          </p>
        )}
        <div className="field-pair">
          <label>
            Period starts
            <input
              name="period_start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              {...bounds}
            />
          </label>
          <label>
            Period ends
            <input
              name="period_end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              {...bounds}
            />
          </label>
        </div>
        {inspection &&
          extracted?.inspection_date &&
          !extracted.period_start && (
            <p className="hint">
              The PDF has an inspection date but no separate period start. The
              inspection date was filled as the start; the end date stays blank
              unless the PDF states one.
            </p>
          )}
        <label className="checkline">
          <input type="checkbox" required />I confirm I have permission to
          upload this document and it belongs to {d.case.factory}.
        </label>
        {err && <ErrorNote text={err} />}
        <div className="form-actions">
          <button type="button" disabled={busy} onClick={close}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={busy || extracting || !file || invalidInspectionPdf}
          >
            {busy ? stage : "Upload document"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
