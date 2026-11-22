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
  LogOut,
  Menu,
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
import { Busy, DocIcon, ErrorNote, Modal, PasswordField, Tag } from "./ui";
import { Viewer, Preview } from "./viewer";
import { Documents, FactoryDocuments } from "./documents";
import { Analysis } from "./analysis";
import { CaseOverview } from "./case-overview";
import { RunHistory } from "./run-history";
import { CapReview } from "./cap-review";
import { AdminWorkspace } from "./admin-workspace";
import type { Factory } from "./onboarding";
import { AccountMenu } from "./account-menu";
import { CorrectiveWork } from "./corrective-work";
import { sampleCatalog } from "@/lib/samples";
import type { components } from "@/lib/schema";

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
  const [dialog, setDialog] = useState<"account" | null>(null),
    [preview, setPreview] = useState<Preview | null>(null);
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
  const identity = useQuery({
    queryKey: ["identity", token],
    queryFn: () =>
      api<components["schemas"]["AccountProfile"]>("/v1/me", token),
    enabled: !!token,
    retry: false,
    refetchOnWindowFocus: true,
  });
  const profile = identity.data;
  const role = profile?.role;
  const accountName =
    profile?.full_name?.trim() || session?.user.email || "Account";
  const isManager = role === "factory_manager";
  const assigned = useQuery({
    queryKey: ["assigned-factories", session?.user.id],
    queryFn: () =>
      api<{ factories: Factory }[]>("/v1/reviewer/factories", token),
    enabled: role === "reviewer",
  });
  const managerWork = useQuery({
    queryKey: ["manager-work", session?.user.id],
    queryFn: () =>
      api<{
        factory: Factory;
        inspections: {
          case_id: string;
          title: string;
          inspection_on: string;
          reviewer_name: string | null;
          organization: string | null;
        }[];
        tasks: {
          id: string;
          case_id: string;
          title: string;
          due_on: string;
          status: string;
        }[];
      }>("/v1/manager/work", token),
    enabled: isManager && !cid,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });
  const view = isManager
    ? cid
      ? requestedView === "documents"
        ? "documents"
        : "corrective"
      : "cases"
    : requestedView;
  const cases = useQuery({
    queryKey: ["cases", session?.user.id],
    queryFn: () => api<Case[]>("/v1/cases", token),
    enabled: !!role && role !== "admin",
  });
  const dossier = useQuery({
    queryKey: ["case", session?.user.id, cid],
    queryFn: () => api<Dossier>("/v1/cases/" + cid, token),
    enabled: !!role && role !== "admin" && !!cid,
    refetchOnWindowFocus: true,
    refetchInterval: (q) =>
      q.state.data?.jobs.some((j) => ["queued", "running"].includes(j.state)) ||
      (isManager && q.state.data?.versions.some((v) => v.status === "queued"))
        ? 1700
        : isManager && q.state.data?.case.inspection_on
          ? 15000
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
  }
  async function refresh() {
    await Promise.all([cases.refetch(), ...(cid ? [dossier.refetch()] : [])]);
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
  if (restoring || (token && identity.isPending))
    return (
      <main className="boot">
        <Busy />
      </main>
    );
  if (!session || identity.isError) {
    const signIn =
      params.get("sign-in") === "factory-manager"
        ? "factory_manager"
        : "reviewer";
    return (
      <main className="entry-page">
        <section className="panel entry-panel">
          <h1>Sign in to SafetyProof AI</h1>
          <AccountMenu current={signIn} />
          {signIn === "reviewer" && params.get("password") === "updated" && (
            <p>Your password is set. Sign in to continue.</p>
          )}
          <Login
            auth={auth}
            restoring={restoring}
            email={params.get("email") || ""}
            error={
              identity.error
                ? message(identity.error)
                : config.error
                  ? message(config.error)
                  : undefined
            }
            key={signIn}
            workspace={signIn}
          />
        </section>
      </main>
    );
  }
  if (role === "admin" && token) {
    const view =
      requestedView === "reviewers" ||
      requestedView === "manager-applications" ||
      requestedView === "factory-assignments" ||
      requestedView === "scheduled-inspections"
        ? requestedView
        : "factories";
    return (
      <AdminWorkspace
        token={token}
        view={view}
        signout={() => void signout()}
        changeView={(v) => go(v)}
      />
    );
  }
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
            {current.role === "manager" &&
              current.case.inspection_on &&
              nav("Documents", "documents", Files, cid)}
            {current.role !== "viewer" &&
              nav("Corrective work", "corrective", ClipboardCheck, cid)}
          </div>
        )}
        <div className="side-bottom">
          <div className="side-rule" />
          <button className="user-tile" onClick={() => setDialog("account")}>
            <span className="avatar">{accountName[0].toUpperCase()}</span>
            <span>
              <b title={accountName}>{accountName}</b>
              <small>Account settings</small>
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
          <button className="top-account" onClick={() => setDialog("account")}>
            <span className="online" />
            <span className="account-name" title={accountName}>
              {accountName}
            </span>
          </button>
        </header>
        <main className="content">
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
                      {current.case.inspection_on && (
                        <p>
                          Inspection scheduled for{" "}
                          {dateText(current.case.inspection_on)}
                        </p>
                      )}
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
                      ? [
                          ...(current.case.inspection_on
                            ? [["documents", "Documents"]]
                            : []),
                          ["corrective", "Corrective work"],
                        ]
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
                  {current.role === "manager" &&
                  current.case.inspection_on &&
                  view === "documents" ? (
                    <FactoryDocuments
                      key={cid}
                      dossier={current}
                      token={token}
                      preview={setPreview}
                      refresh={refresh}
                    />
                  ) : view === "corrective" || current.role === "manager" ? (
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
              </div>
              {isManager && (
                <section className="panel" aria-label="Inspection notices">
                  <div className="section-head">
                    <h2>Inspection notices</h2>
                    <Tag>{managerWork.data?.inspections?.length ?? 0}</Tag>
                  </div>
                  {managerWork.data?.inspections?.length === 0 && (
                    <p className="empty-text">
                      No inspections have been scheduled for your factory.
                    </p>
                  )}
                  {managerWork.data?.inspections?.map((inspection) => (
                    <button
                      key={inspection.case_id}
                      className="file-row"
                      onClick={() => go("documents", inspection.case_id)}
                    >
                      <span className="row-main">
                        <b>{inspection.title}</b>
                        <small>
                          {dateText(inspection.inspection_on)} ·{" "}
                          {inspection.organization ||
                            "Organization not recorded"}
                        </small>
                        {inspection.reviewer_name && (
                          <small>{inspection.reviewer_name}</small>
                        )}
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </section>
              )}
              {isManager && (
                <section className="panel">
                  <div className="section-head">
                    <div>
                      <h2>Corrective tasks</h2>
                      <p>
                        {managerWork.data?.factory.name ||
                          "Your assigned factory"}
                      </p>
                    </div>
                  </div>
                  {managerWork.isLoading && <Busy />}
                  {managerWork.error && (
                    <ErrorNote text={message(managerWork.error)} />
                  )}
                  {managerWork.data?.tasks.length === 0 && (
                    <p className="empty-text">
                      No corrective tasks assigned yet.
                    </p>
                  )}
                  {managerWork.data?.tasks.map((task) => (
                    <button
                      className="file-row"
                      key={task.id}
                      onClick={() => go("corrective", task.case_id)}
                    >
                      <span className="row-main">
                        <b>{task.title}</b>
                        <small>Due {dateText(task.due_on)}</small>
                      </span>
                      <Tag>{task.status.replaceAll("_", " ")}</Tag>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </section>
              )}
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
                          go(
                            isManager
                              ? c.inspection_on
                                ? "documents"
                                : "corrective"
                              : "overview",
                            c.id,
                          )
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
                        ? "Cases created for your factory will appear here."
                        : "No cases have been assigned to you yet."}
                    </p>
                  )}
                </section>
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
      {dialog === "account" && (
        <Modal title="Account settings" close={() => setDialog(null)}>
          <dl className="reviewer-fields account-details">
            <dt>Full name</dt>
            <dd>{accountName}</dd>
            <dt>Email</dt>
            <dd>{profile?.email || session.user.email}</dd>
            {role === "reviewer" && (
              <>
                <dt>Organization</dt>
                <dd>{profile?.organization || "Not recorded"}</dd>
                <dt>Reviewer type</dt>
                <dd>{profile?.role_type || "Not recorded"}</dd>
                <dt>Assigned factories</dt>
                <dd>
                  {assigned.isPending
                    ? "Loading…"
                    : assigned.isError
                      ? "Unavailable"
                      : assigned.data
                          ?.map(({ factories }) => factories.name)
                          .join(", ") || "No factory assignments"}
                </dd>
              </>
            )}
            {profile?.status && (
              <>
                <dt>Account status</dt>
                <dd className="account-status">
                  {profile.status.replaceAll("_", " ")}
                </dd>
              </>
            )}
            {profile?.created_at && (
              <>
                <dt>Member since</dt>
                <dd>{dateText(profile.created_at)}</dd>
              </>
            )}
          </dl>
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
  email,
  error,
  workspace,
}: {
  auth: SupabaseClient | null;
  restoring: boolean;
  email: string;
  error?: string;
  workspace: "factory_manager" | "reviewer";
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setErr("");
    try {
      const session = await api<{
        access_token: string;
        refresh_token: string;
      }>("/v1/login", undefined, "POST", {
        email: String(form.get("email")).trim(),
        password: String(form.get("password")),
        workspace,
      });
      const { error } = await auth.auth.setSession(session);
      if (error) throw error;
    } catch (error) {
      setErr(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form id="sign-in" method="post" autoComplete="on" onSubmit={submit}>
      {workspace === "reviewer" && (
        <p className="hint">Administrators sign in here too.</p>
      )}
      <label htmlFor="sign-in-email">
        Email
        <input
          id="sign-in-email"
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={email}
        />
      </label>
      <PasswordField id="sign-in-password" />
      {(err || error || (!auth && !restoring)) && (
        <ErrorNote
          text={err || error || "Workspace authentication is unavailable."}
        />
      )}
      <button className="primary" disabled={busy || !auth}>
        Sign in <ArrowRight size={15} />
      </button>
    </form>
  );
}
