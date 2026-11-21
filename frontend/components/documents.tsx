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
  const byDoc = new Map<string, Version>();
  for (const v of versions.filter(processed)) {
    if ((byDoc.get(v.document_id)?.revision || 0) < v.revision)
      byDoc.set(v.document_id, v);
  }
  return [...byDoc.values()].map((v) => v.id);
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
  const versionKey = d.versions.map((v) => v.id + v.status).join(",");
  useEffect(() => {
    if (!custom) setSelected(latest(d.versions));
  }, [versionKey, custom, d.versions]);
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
  const sel = d.versions.filter((v) => selected.includes(v.id)),
    count = sel.reduce((a, v) => a + v.readable_pages, 0),
    pages = sel.reduce((a, v) => a + v.page_count, 0);
  const hasInspection = sel.some(
    (v) =>
      d.documents.find((doc) => doc.id === v.document_id)?.role ===
      "inspection",
  );
  const valid = sel.length >= 2 && hasInspection;
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
              <p>Select the versions to include in this review.</p>
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
                Upload an inspection report and the records you want to compare.
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
              Select an inspection and at least one other document.
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
  const q = useQuery({
    queryKey: ["pages", v.id],
    queryFn: () =>
      api<PageInfo[]>("/v1/document-versions/" + v.id + "/pages", token),
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
  const [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [title, setTitle] = useState(""),
    [role, setRole] = useState<Role>("inspection");
  const [doc, setDoc] = useState(""),
    [stage, setStage] = useState(""),
    [attempt, setAttempt] = useState(() => crypto.randomUUID());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setErr("");
    const form = new FormData(e.currentTarget);
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Choose a PDF smaller than 10 MB.");
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
          issuer: form.get("issuer"),
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
            Digital PDF or printed scan · 10 MB and 20 pages maximum
          </small>
          <input
            type="file"
            accept=".pdf,application/pdf"
            required
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              setAttempt(crypto.randomUUID());
              if (f)
                setTitle(f.name.replace(/\.pdf$/i, "").replaceAll("-", " "));
            }}
          />
        </label>
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
              {Object.entries(roles).map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Issuer
            <select name="issuer">
              <option value="unknown">Unknown</option>
              <option value="factory">Factory</option>
              <option value="external">External reviewer</option>
            </select>
          </label>
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
          Issue date
          <input name="issued_on" type="date" />
        </label>
        <div className="field-pair">
          <label>
            Period starts
            <input name="period_start" type="date" />
          </label>
          <label>
            Period ends
            <input name="period_end" type="date" />
          </label>
        </div>
        <label className="checkline">
          <input type="checkbox" required />I confirm this permitted, synthetic
          document belongs to {d.case.factory}.
        </label>
        {err && <ErrorNote text={err} />}
        <div className="form-actions">
          <button type="button" disabled={busy} onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy || !file}>
            {busy ? stage : "Upload document"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
