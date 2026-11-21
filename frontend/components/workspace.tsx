"use client";
import { useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  Files,
  FolderOpen,
  History,
  Layers3,
  LayoutDashboard,
  LibraryBig,
  Link2,
  LogIn,
  LogOut,
  Menu,
  Plus,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import {
  api,
  Case,
  Catalog,
  Config,
  Dossier,
  dateText,
  message,
  roles,
} from "@/lib/api";
import { Busy, DocIcon, ErrorNote, Modal, Tag } from "./ui";
import { Viewer, Preview } from "./viewer";
import { Documents } from "./documents";
import { Analysis } from "./analysis";
import { CaseOverview } from "./case-overview";
import { RunHistory } from "./run-history";
import { CapReview } from "./cap-review";
import { CorrectiveWork } from "./corrective-work";
import { sampleCatalog } from "@/lib/samples";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
export function Workspace() {
  return (
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>
  );
}

function App() {
  const router = useRouter(),
    params = useSearchParams(),
    cache = useQueryClient();
  const cid = params.get("case") || "",
    requestedView = params.get("view") || (cid ? "overview" : "cases");
  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => api<Config>("/v1/config"),
  });
  const [auth, setAuth] = useState<SupabaseClient | null>(null),
    [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true),
    [mobile, setMobile] = useState(false);
  const [dialog, setDialog] = useState<"login" | "case" | "account" | null>(
      null,
    ),
    [preview, setPreview] = useState<Preview | null>(null);
  const [err, setErr] = useState(""),
    [working, setWorking] = useState(false);
  useEffect(() => {
    if (!config.data?.publishable_key) {
      if (!config.isLoading) setRestoring(false);
      return;
    }
    const client = createClient(
      config.data.supabase_url,
      config.data.publishable_key,
    );
    setAuth(client);
    const { data } = client.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setRestoring(false);
    });
    return () => data.subscription.unsubscribe();
  }, [config.data, config.isLoading]);
  const token = session?.access_token;
  const isManager =
    session?.user.app_metadata.workspace_role === "factory_manager";
  const view = isManager && cid ? "corrective" : requestedView;
  const cases = useQuery({
    queryKey: ["cases", session?.user.id],
    queryFn: () => api<Case[]>("/v1/cases", token),
    enabled: !!token,
  });
  const dossier = useQuery({
    queryKey: ["case", session?.user.id, cid],
    queryFn: () => api<Dossier>("/v1/cases/" + cid, token),
    enabled: !!token && !!cid,
    refetchInterval: (q) =>
      q.state.data?.jobs.some((j) => ["queued", "running"].includes(j.state))
        ? 1700
        : false,
  });
  function go(v: string, id = "", run = "", item = "") {
    const p = new URLSearchParams();
    if (id) p.set("case", id);
    if (v !== "cases") p.set("view", v);
    if (run) p.set("run", run);
    if (item) p.set("item", item);
    router.push("/" + (p.size ? "?" + p : ""));
    setMobile(false);
    setErr("");
  }
  async function refresh() {
    await Promise.all([cases.refetch(), ...(cid ? [dossier.refetch()] : [])]);
  }
  async function create(data: Record<string, unknown>, demo = false) {
    setWorking(true);
    setErr("");
    try {
      const c = await api<Case>("/v1/cases", token, "POST", data);
      go("documents", c.id);
      setDialog(null);
      if (demo) await api("/v1/cases/" + c.id + "/samples", token, "POST");
      await cache.invalidateQueries({ queryKey: ["cases"] });
      await cache.invalidateQueries({ queryKey: ["case"] });
    } catch (e) {
      setErr(message(e));
    } finally {
      setWorking(false);
    }
  }
  async function signout() {
    await auth?.auth.signOut({ scope: "local" });
    cache.removeQueries({
      predicate: (q) => !["config"].includes(String(q.queryKey[0])),
    });
    setDialog(null);
    go("cases");
  }
  const sample = sampleCatalog;
  const current = token && cid ? dossier.data : undefined;
  const title =
    view === "library"
      ? "Document library"
      : current
        ? current.case.title
        : isManager
          ? "Factory cases"
          : "Review cases";
  const nav = (label: string, v: string, Icon: typeof Files, id = "") => (
    <button
      className={"nav-link " + (view === v ? "active" : "")}
      onClick={() => go(v, id)}
    >
      <Icon size={19} />
      {label}
    </button>
  );
  return (
    <div className="shell">
      {mobile && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <button className="brand" onClick={() => go("cases")}>
          <span className="brand-mark">
            <FileCheck2 size={25} strokeWidth={1.8} />
          </span>
          <span>
            SafetyProof <small>AI</small>
          </span>
        </button>
        <div className="nav-block">
          <div className="nav-caption">Workspace</div>
          {nav(
            isManager ? "Factory cases" : "Review cases",
            "cases",
            FolderOpen,
          )}
          {!isManager && nav("Document library", "library", LibraryBig)}
        </div>
        {current && (
          <div className="nav-block">
            <div className="nav-caption">Current case</div>
            {current.role !== "manager" && (
              <>
                {nav("Overview", "overview", LayoutDashboard, cid)}
                {nav("Documents", "documents", Files, cid)}
                {nav("Review queue", "review", ClipboardCheck, cid)}
                {nav("CAP matching", "cap", Link2, cid)}
                {nav("Run history", "history", History, cid)}
              </>
            )}
            {current.role !== "viewer" &&
              nav("Corrective work", "corrective", ClipboardCheck, cid)}
          </div>
        )}
        <div className="side-bottom">
          <div className="side-rule" />
          <button
            className="user-tile"
            onClick={() => setDialog(session ? "account" : "login")}
          >
            <span className="avatar">
              {session ? (
                (session.user.email || "R")[0].toUpperCase()
              ) : (
                <ShieldCheck size={19} />
              )}
            </span>
            <span>
              <b>
                {session
                  ? session.user.email?.split("@")[0]
                  : "Guest workspace"}
              </b>
              <small>
                {session ? "Account settings" : "Sign in for case access"}
              </small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      <div className="maincol">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            <Layers3 size={16} />
            <button onClick={() => go("cases")}>Workspace</button>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <button
            className="top-account"
            onClick={() => setDialog(session ? "account" : "login")}
          >
            {session ? (
              <>
                <span className="online" />
                {session.user.email?.split("@")[0]}
              </>
            ) : (
              <>
                <LogIn size={15} />
                Sign in
              </>
            )}
          </button>
        </header>
        <main className="content">
          {err && <ErrorNote text={err} />}
          {view === "library" ? (
            <>
              <div className="page-head">
                <div>
                  <span className="eyebrow">
                    <LibraryBig size={15} /> Source materials
                  </span>
                  <h1>Document library</h1>
                  <p>
                    Open the original files from the fictional factory case.
                  </p>
                </div>
              </div>
              <SampleFiles sample={sample} preview={setPreview} />
            </>
          ) : cid && token ? (
            <>
              {current ? (
                <>
                  <div className="page-head case-head">
                    <div>
                      <button className="backlink" onClick={() => go("cases")}>
                        {isManager ? "Factory cases" : "Review cases"}{" "}
                        <ChevronRight size={13} />
                      </button>
                      <h1>{current.case.title}</h1>
                      <p>
                        {current.case.factory} <span className="middot">·</span>{" "}
                        {dateText(current.case.period_start)} –{" "}
                        {dateText(current.case.period_end)}
                      </p>
                    </div>
                    <Tag tone={current.case.archived ? "" : "green"}>
                      {current.case.archived
                        ? "Archived"
                        : current.role === "reviewer"
                          ? "Reviewer access"
                          : current.role === "manager"
                            ? "Factory Manager"
                            : "View only"}
                    </Tag>
                  </div>
                  <div
                    className="tabs"
                    role="navigation"
                    aria-label="Case navigation"
                  >
                    {(current.role === "manager"
                      ? [["corrective", "Corrective work"]]
                      : [
                          ["overview", "Overview"],
                          ["documents", "Documents"],
                          ["review", "Review queue"],
                          ["cap", "CAP matching"],
                          ["history", "Run history"],
                          ...(current.role === "reviewer"
                            ? [["corrective", "Corrective work"]]
                            : []),
                        ]
                    ).map(([key, text]) => (
                      <button
                        key={key}
                        className={view === key ? "sel" : ""}
                        onClick={() => go(key, cid)}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                  {view === "corrective" || current.role === "manager" ? (
                    <CorrectiveWork
                      key={cid}
                      dossier={current}
                      token={token}
                      preview={setPreview}
                      refresh={refresh}
                    />
                  ) : view === "overview" ? (
                    <CaseOverview
                      dossier={current}
                      token={token}
                      open={(v, r, i) => go(v, cid, r, i)}
                    />
                  ) : view === "history" ? (
                    <RunHistory
                      key={cid}
                      runs={current.runs}
                      token={token}
                      open={(r, i) => go("review", cid, r, i)}
                    />
                  ) : view === "cap" ? (
                    <CapReview
                      key={cid}
                      dossier={current}
                      token={token}
                      preview={setPreview}
                      documents={() => go("documents", cid)}
                      review={(r, i) => go("review", cid, r, i)}
                    />
                  ) : view === "review" ? (
                    <Analysis
                      dossier={current}
                      token={token}
                      runId={params.get("run")}
                      itemId={params.get("item")}
                      go={(r, i) => go("review", cid, r, i)}
                      preview={setPreview}
                      refresh={refresh}
                    />
                  ) : (
                    <Documents
                      dossier={current}
                      token={token}
                      configured={!!config.data?.ai_configured}
                      preview={setPreview}
                      refresh={refresh}
                      openedRun={(id) => go("review", cid, id)}
                      onRemoved={() => go("cases")}
                      owner={session?.user.id === current.case.created_by}
                    />
                  )}
                </>
              ) : dossier.error ? (
                <ErrorNote text={message(dossier.error)} />
              ) : (
                <Busy text="Opening review case…" />
              )}
            </>
          ) : (
            <>
              <div className="page-head">
                <div>
                  <span className="eyebrow">
                    <FolderOpen size={15} />{" "}
                    {isManager
                      ? "Factory Manager workspace"
                      : "Reviewer workspace"}
                  </span>
                  <h1>{isManager ? "Factory cases" : "Review cases"}</h1>
                  <p>
                    {isManager
                      ? "See the cases shared with your factory and submit corrective evidence."
                      : "Cross-check factory safety reports against their own evidence."}
                  </p>
                </div>
                {!isManager && (
                  <button
                    className="primary"
                    onClick={() => setDialog(session ? "case" : "login")}
                  >
                    <Plus size={17} />
                    New case
                  </button>
                )}
              </div>
              {session && (
                <section className="panel cases-panel">
                  <div className="section-head">
                    <h2>Your cases</h2>
                    <Tag>{cases.data?.length ?? 0}</Tag>
                  </div>
                  {cases.isLoading ? (
                    <Busy />
                  ) : cases.error ? (
                    <ErrorNote text={message(cases.error)} />
                  ) : cases.data?.length ? (
                    cases.data.map((c) => (
                      <button
                        className="file-row"
                        key={c.id}
                        onClick={() =>
                          go(isManager ? "corrective" : "overview", c.id)
                        }
                      >
                        <span className="doc-icon inspection">
                          <FolderOpen size={21} />
                        </span>
                        <span className="row-main">
                          <b>{c.title}</b>
                          <small>{c.factory}</small>
                        </span>
                        <span className="muted">
                          {c.archived ? "Archived" : dateText(c.created_at)}
                        </span>
                        <ChevronRight size={17} />
                      </button>
                    ))
                  ) : (
                    <p className="empty-text">
                      {isManager
                        ? "An auditor can share a case with your Factory Manager account."
                        : "Create your first review case or load the sample documents below."}
                    </p>
                  )}
                </section>
              )}
              {!isManager && (
                <>
                  <section className="feature">
                    <div className="feature-copy">
                      <span className="feature-label">
                        <span /> Sample case
                      </span>
                      <h2>April safety review</h2>
                      <p>
                        Read an inspection report alongside a Bangla incident
                        register, a fire procedure, and an earlier finding.
                      </p>
                      <button
                        className="feature-cta"
                        disabled={working}
                        onClick={() =>
                          session
                            ? void create(
                                {
                                  factory: sample.factory,
                                  title: sample.title,
                                  programme: sample.programme,
                                  period_start: sample.period_start,
                                  period_end: sample.period_end,
                                },
                                true,
                              )
                            : go("library")
                        }
                      >
                        {working
                          ? "Preparing case…"
                          : session
                            ? "Load sample case"
                            : "Explore sample documents"}{" "}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="paper-art" aria-hidden="true">
                      <div className="art-sheet rear">
                        <div className="art-line" />
                        <small>INSPECTION REPORT</small>
                        <strong>April review</strong>
                        <i />
                        <i />
                        <i />
                      </div>
                      <div className="art-sheet front">
                        <div className="art-fold" />
                        <ScanLine size={22} />
                        <small>INCIDENT REGISTER</small>
                        <strong lang="bn">ঘটনার বিবরণ</strong>
                        <span lang="bn">
                          ১৫ এপ্রিল কাটিং মেশিনে একজন শ্রমিক আহত হন।
                        </span>
                        <i />
                        <i />
                      </div>
                    </div>
                  </section>
                  <SampleFiles sample={sample} preview={setPreview} compact />
                </>
              )}
            </>
          )}
        </main>
        <footer className="app-foot">
          <span>
            <ShieldCheck size={14} />
            SafetyProof AI
          </span>
          <span>Documentary evidence review</span>
        </footer>
      </div>
      {preview && (
        <Viewer item={preview} token={token} close={() => setPreview(null)} />
      )}
      {dialog === "login" && (
        <Login
          auth={auth}
          restoring={restoring}
          error={config.error ? message(config.error) : undefined}
          close={() => setDialog(null)}
        />
      )}
      {dialog === "case" && (
        <NewCase
          close={() => setDialog(null)}
          create={create}
          busy={working}
          error={err}
        />
      )}
      {dialog === "account" && (
        <Modal title="Account" close={() => setDialog(null)}>
          <p className="muted">{session?.user.email}</p>
          <button onClick={signout}>
            <LogOut size={16} />
            Sign out
          </button>
        </Modal>
      )}
    </div>
  );
}

function SampleFiles({
  sample,
  preview,
  compact = false,
}: {
  sample: Catalog;
  preview: (p: Preview) => void;
  compact?: boolean;
}) {
  return (
    <section className="panel library-panel">
      <div className="section-head">
        <div>
          <h2>{compact ? "Factory documents" : sample.title}</h2>
          <p>Synthetic records</p>
        </div>
        <span className="file-count">
          <Files size={15} />
          {sample.documents.length} files
        </span>
      </div>
      <div className="file-table-head">
        <span>Document</span>
        <span className="factory-heading">Factory</span>
        <span>Source format</span>
        <span className="issued-heading">Issued</span>
        <span />
      </div>
      {sample.documents.map((d) => (
        <button
          key={d.filename}
          className="doc-row"
          onClick={() => preview({ title: d.title, sample: d.filename })}
        >
          <span className="file-title">
            <DocIcon role={d.role} />
            <span>
              <b>{d.title}</b>
              <small>{roles[d.role]}</small>
            </span>
          </span>
          <span className="file-factory">
            <span className="file-factory-label">Factory · </span>
            {sample.factory}
          </span>
          <span className="file-format">
            {d.scan ? "Bangla scan" : "Digital PDF"}
          </span>
          <span className="file-date">{dateText(d.issued_on)}</span>
          <ArrowUpRight size={16} />
        </button>
      ))}
    </section>
  );
}

function Login({
  auth,
  restoring,
  error,
  close,
}: {
  auth: SupabaseClient | null;
  restoring: boolean;
  error?: string;
  close: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const f = new FormData(e.currentTarget);
      if (!auth) throw new Error("Workspace authentication is unavailable.");
      const { error } = await auth.auth.signInWithPassword({
        email: String(f.get("email")).trim(),
        password: String(f.get("password")),
      });
      if (error) throw error;
      close();
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Sign in to your workspace" close={close}>
      <form onSubmit={submit}>
        <p className="form-intro">
          Use the reviewer or viewer account issued for this workspace.
        </p>
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            autoFocus
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
          />
        </label>
        {(err || error || (!auth && !restoring)) && (
          <ErrorNote
            text={err || error || "Workspace authentication is unavailable."}
          />
        )}
        <div className="form-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy || !auth}>
            Sign in <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NewCase({
  close,
  create,
  busy,
  error,
}: {
  close: () => void;
  create: (b: Record<string, unknown>) => Promise<void>;
  busy: boolean;
  error: string;
}) {
  return (
    <Modal title="New review case" close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const raw = Object.fromEntries(new FormData(e.currentTarget));
          void create(
            Object.fromEntries(
              Object.entries(raw).map(([k, v]) => [k, v || null]),
            ),
          );
        }}
      >
        <label>
          Factory name
          <input
            name="factory"
            autoFocus
            maxLength={160}
            required
            placeholder="Factory named in the documents"
          />
        </label>
        <label>
          Case title
          <input
            name="title"
            maxLength={160}
            required
            placeholder="e.g. April safety review"
          />
        </label>
        <label>
          Inspection programme <small>Optional</small>
          <input name="programme" maxLength={120} />
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
        {error && <ErrorNote text={error} />}
        <div className="form-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Creating…" : "Create case"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
