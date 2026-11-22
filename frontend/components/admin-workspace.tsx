"use client";

import { FormEvent, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBase, dateText, message, outcomes } from "@/lib/api";
import type { Outcome } from "@/lib/api";
import type { Factory } from "./onboarding";
import { Busy, ErrorNote, Modal, Tag } from "./ui";
import { ReviewerFields, reviewerDetails } from "./reviewer-fields";

type Reviewer = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  role_type: string | null;
  organization: string | null;
  reviewer_factories: { factory_id: string }[];
};
type Application = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  job_title: string;
  status: string;
  created_at: string;
  requested_factory_id: string | null;
  factory_id: string | null;
  reject_reason: string | null;
  has_id_card: boolean;
  card_cleanup_pending: boolean;
  id_card_number: string | null;
  membership_number: string | null;
  consent_at: string | null;
  id_card_deleted_at: string | null;
  requested_factory: Factory | null;
  active_manager_factory_ids: string[];
};
type FactorySummary = Factory & {
  managers: number;
  reviewers: number;
  cases: {
    id: string;
    title: string;
    findings: Record<Outcome, number>;
    open_tasks: number;
    archived: boolean;
  }[];
};
type CaseSummary = {
  case: {
    title: string;
    factory: string;
    reviewer_id: string | null;
    inspection_on: string | null;
  };
  run: { created_at: string } | null;
  results: {
    id: string;
    claim: { source: { quote: string } };
    outcome: Outcome;
    reason: string;
  }[];
  tasks: { id: string; title: string; due_on: string; status: string }[];
  documents: { id: string; title: string }[];
};
type View =
  | "factories"
  | "reviewers"
  | "factory-assignments"
  | "manager-applications";
function status(value: string) {
  return value.replaceAll("_", " ");
}

export function AdminWorkspace({
  token,
  signout,
  view,
  changeView,
}: {
  token: string;
  signout: () => void;
  view: View;
  changeView: (view: View) => void;
}) {
  const cache = useQueryClient();
  const [add, setAdd] = useState(false);
  const [addingFactory, setAddingFactory] = useState(false);
  const [factoryName, setFactoryName] = useState("");
  const [factoryAddress, setFactoryAddress] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [assignmentFactoryId, setAssignmentFactoryId] = useState("");
  const [assignmentSaved, setAssignmentSaved] = useState(false);
  const [selected, setSelected] = useState("");
  const [caseId, setCaseId] = useState("");
  const details = useQuery({
    queryKey: ["admin-case", caseId, token],
    queryFn: () => api<CaseSummary>(`/v1/admin/cases/${caseId}`, token),
    enabled: !!caseId,
  });
  const [invite, setInvite] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deactivate, setDeactivate] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const factories = useQuery({
    queryKey: ["admin-factories", token],
    queryFn: () => api<FactorySummary[]>("/v1/admin/factories", token),
  });
  const reviewers = useQuery({
    queryKey: ["admin-reviewers", token],
    queryFn: () => api<Reviewer[]>("/v1/admin/reviewers", token),
    enabled: view !== "manager-applications",
  });
  const managers = useQuery({
    queryKey: ["admin-applications", token],
    queryFn: () => api<Application[]>("/v1/admin/manager-applications", token),
    enabled: view === "manager-applications",
  });
  const assignees =
    reviewers.data?.filter((row) => row.status === "active") || [];
  const assignee = assignees.find((row) => row.id === assigneeId);
  const assignmentFactory = factories.data?.find(
    (row) => row.id === assignmentFactoryId,
  );
  const hasAssignment = Boolean(
    assignee?.reviewer_factories.some(
      (row) => row.factory_id === assignmentFactoryId,
    ),
  );
  const names = new Map(factories.data?.map((f) => [f.id, f.name]));

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  async function addReviewer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(async () => {
      const response = await api<{ invite_url: string }>(
        "/v1/admin/reviewers",
        token,
        "POST",
        reviewerDetails(form),
      );
      setAdd(false);
      setCopied(false);
      setInvite(response.invite_url);
      await reviewers.refetch();
    });
  }

  async function decideRequest(id: string, choice: "approve" | "reject") {
    await perform(async () => {
      const next = await api<{ invite_url?: string }>(
        `/v1/admin/reviewer-requests/${id}/${choice}`,
        token,
        "POST",
      );
      if (next.invite_url) {
        setCopied(false);
        setInvite(next.invite_url);
      }
      await reviewers.refetch();
    });
  }

  async function saveFactory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = factoryName.trim();
    const address = factoryAddress.trim();
    if (!name || !address) {
      setError("Enter the factory name and address.");
      return;
    }
    setAssignmentSaved(false);
    await perform(async () => {
      await api("/v1/admin/factories", token, "POST", {
        name,
        address,
      });
      setFactoryName("");
      setFactoryAddress("");
      setAddingFactory(false);
      await factories.refetch();
    });
  }

  async function toggleAssignment() {
    if (!assignee || !assignmentFactory) return;
    const current = new Set(
      assignee.reviewer_factories.map((row) => row.factory_id),
    );
    if (current.has(assignmentFactory.id)) current.delete(assignmentFactory.id);
    else current.add(assignmentFactory.id);
    setAssignmentSaved(false);
    await perform(async () => {
      await api(`/v1/admin/reviewers/${assignee.id}/factories`, token, "POST", {
        factory_ids: Array.from(current),
      });
      setAssignmentSaved(true);
      await reviewers.refetch();
    });
  }

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignmentFactory || !assignee || !hasAssignment) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    await perform(async () => {
      const created = await api<{ id: string }>(
        "/v1/admin/cases",
        token,
        "POST",
        {
          ...fields,
          factory: assignmentFactory.name,
          reviewer_id: assignee.id,
          programme: fields.programme || null,
        },
      );
      setCaseId(created.id);
      await factories.refetch();
    });
  }

  return (
    <>
      <header className="topbar">
        <strong>SafetyProof AI · Admin</strong>
        <button onClick={signout}>Sign out</button>
      </header>
      <main className="admin-content">
        <nav className="tabs" aria-label="Admin pages">
          {(
            [
              ["factories", "Factories"],
              ["reviewers", "Reviewers"],
              ["factory-assignments", "Factory assignments"],
              ["manager-applications", "Manager applications"],
            ] as const
          ).map(([id, label]) => (
            <button
              className={view === id ? "sel" : ""}
              key={id}
              onClick={() => {
                setError("");
                setSelected("");
                setCaseId("");
                changeView(id);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        {error && !add && !deactivate && !addingFactory && (
          <ErrorNote text={error} />
        )}
        {view === "factories" && (
          <section className="panel">
            <div className="section-head">
              <h1>Factory safety overview</h1>
              <div className="inline-actions">
                <button
                  onClick={() => {
                    setError("");
                    setAddingFactory((open) => !open);
                  }}
                >
                  {addingFactory ? "Cancel" : "Add factory"}
                </button>
              </div>
            </div>
            {addingFactory && (
              <form className="panel-pad admin-form" onSubmit={saveFactory}>
                <h2>Add factory</h2>
                <label>
                  Factory name
                  <input
                    required
                    maxLength={200}
                    value={factoryName}
                    onChange={(event) => setFactoryName(event.target.value)}
                  />
                </label>
                <label>
                  Factory address
                  <textarea
                    required
                    maxLength={500}
                    rows={3}
                    value={factoryAddress}
                    onChange={(event) => setFactoryAddress(event.target.value)}
                  />
                </label>
                {error && <ErrorNote text={error} />}
                <button className="primary" disabled={busy}>
                  Save factory
                </button>
              </form>
            )}
            {factories.isLoading && <Busy />}
            {factories.error && <ErrorNote text={message(factories.error)} />}
            {factories.data?.map((factory) => (
              <div className="admin-row" key={factory.id}>
                <div>
                  <strong>{factory.name}</strong>
                  <small>{factory.address}</small>
                  <small>
                    {factory.managers} active managers · {factory.reviewers}{" "}
                    active reviewers
                  </small>
                </div>
                {factory.cases.length ? (
                  <ul>
                    {factory.cases.map((item) => (
                      <li key={item.id}>
                        <button onClick={() => setCaseId(item.id)}>
                          {item.title}
                          {item.archived ? " · Archived" : ""}
                        </button>
                        <small>{item.open_tasks} open corrective tasks</small>
                        <small>
                          {Object.entries(item.findings)
                            .map(
                              ([key, count]) =>
                                `${count} ${outcomes[key as Outcome] || key}`,
                            )
                            .join(" · ") || "No published assessments"}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hint">No review cases yet</p>
                )}
              </div>
            ))}
          </section>
        )}
        {view === "reviewers" && (
          <section className="panel">
            <div className="section-head">
              <h1>Reviewers</h1>
              <button
                className="primary"
                onClick={() => {
                  setError("");
                  setAdd(true);
                }}
              >
                Add reviewer
              </button>
            </div>
            {reviewers.isLoading && <Busy />}
            {reviewers.error && <ErrorNote text={message(reviewers.error)} />}
            {reviewers.data?.map((row) => (
              <div className="admin-row" key={row.id}>
                <div className="reviewer-profile">
                  <strong>{row.full_name}</strong>
                  <dl className="reviewer-fields">
                    <dt>Email</dt>
                    <dd>{row.email}</dd>
                    <dt>Role type</dt>
                    <dd>{row.role_type || "Unspecified"}</dd>
                    <dt>Organization</dt>
                    <dd>{row.organization || "Unspecified"}</dd>
                    <dt>Created</dt>
                    <dd>{dateText(row.created_at)}</dd>
                    <dt>Factories</dt>
                    <dd>
                      {row.reviewer_factories
                        .map((f) => names.get(f.factory_id))
                        .filter(Boolean)
                        .join(", ") || "No factory assignments"}
                    </dd>
                  </dl>
                </div>
                <div className="inline-actions">
                  <Tag tone={row.status === "active" ? "green" : "amber"}>
                    {row.status === "pending_approval"
                      ? "Access requested"
                      : status(row.status)}
                  </Tag>
                  {row.status === "pending_approval" && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => void decideRequest(row.id, "approve")}
                      >
                        Approve and create invite
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void decideRequest(row.id, "reject")}
                      >
                        Reject request
                      </button>
                    </>
                  )}
                  {row.status === "pending" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void perform(async () => {
                          const next = await api<{ invite_url: string }>(
                            `/v1/admin/reviewers/${row.id}/resend-invite`,
                            token,
                            "POST",
                          );
                          setCopied(false);
                          setInvite(next.invite_url);
                        })
                      }
                    >
                      Resend invite
                    </button>
                  )}
                  {["pending", "active"].includes(row.status) && (
                    <>
                      <button
                        onClick={() => {
                          setError("");
                          setDeactivate({ id: row.id, name: row.full_name });
                        }}
                      >
                        Deactivate
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}
        {view === "factory-assignments" && (
          <section className="panel">
            <div className="section-head">
              <div>
                <h1>Factory assignments</h1>
                <p>
                  Manage factory access and schedule inspections with an active
                  reviewer.
                </p>
              </div>
            </div>
            <div className="panel-pad admin-form">
              {reviewers.isLoading && <Busy />}
              {reviewers.error && <ErrorNote text={message(reviewers.error)} />}
              {factories.error && <ErrorNote text={message(factories.error)} />}
              <label>
                Factory
                <select
                  value={assignmentFactoryId}
                  disabled={busy || !factories.data?.length}
                  onChange={(event) => {
                    setAssignmentFactoryId(event.target.value);
                    setAssigneeId("");
                    setAssignmentSaved(false);
                    setError("");
                  }}
                >
                  <option value="">Choose a factory</option>
                  {factories.data?.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              {!factories.isLoading &&
                !factories.error &&
                !factories.data?.length && (
                  <p>
                    No factories available. Add a factory in the Factories page
                    first.
                  </p>
                )}
              {assignmentFactory && (
                <>
                  <label>
                    Reviewer
                    <select
                      value={assigneeId}
                      disabled={busy || !assignees.length}
                      onChange={(event) => {
                        setAssigneeId(event.target.value);
                        setAssignmentSaved(false);
                        setError("");
                      }}
                    >
                      <option value="">Choose an active reviewer</option>
                      {assignees.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.full_name} · {row.email}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {!reviewers.isLoading &&
                !reviewers.error &&
                assignmentFactory &&
                !assignees.length && <p>No active reviewers available.</p>}
              {assignmentFactory && assignee && (
                <div className="admin-form">
                  <p>
                    {assignee.full_name} is{" "}
                    {hasAssignment ? "assigned to" : "not assigned to"}{" "}
                    {assignmentFactory.name}.
                  </p>
                  <button
                    className={hasAssignment ? undefined : "primary"}
                    disabled={busy}
                    onClick={() => void toggleAssignment()}
                  >
                    {hasAssignment ? "Remove assignment" : "Assign reviewer"}
                  </button>
                  {assignmentSaved && <p role="status">Assignment updated.</p>}
                </div>
              )}
              {assignmentFactory && assignee && (
                <form className="admin-form" onSubmit={createCase}>
                  <h2>Schedule inspection</h2>
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
                  <label>
                    Inspection date
                    <input name="inspection_on" type="date" required />
                  </label>
                  <p className="hint">
                    Scheduling creates the review case and adds a notice with
                    this date to the factory manager’s dashboard.
                  </p>
                  {!hasAssignment && (
                    <p className="hint">
                      Assign this reviewer to the selected factory before
                      scheduling the inspection.
                    </p>
                  )}
                  <button
                    className="primary"
                    disabled={busy || !hasAssignment}
                  >
                    {busy ? "Scheduling…" : "Assign case and notify factory"}
                  </button>
                </form>
              )}
            </div>
          </section>
        )}
        {view === "manager-applications" && (
          <>
            <section className="panel">
              <div className="section-head">
                <h1>Manager applications</h1>
              </div>
              {managers.isLoading && <Busy />}
              {managers.error && <ErrorNote text={message(managers.error)} />}
              {managers.data?.length === 0 && (
                <p className="panel-pad">No applications yet.</p>
              )}
              {managers.data?.map((row) => (
                <div className="admin-row" key={row.id}>
                  <div>
                    <strong>{row.full_name}</strong>
                    <small>
                      {row.email}
                      {row.phone && ` · ${row.phone}`}
                    </small>
                    <small>
                      {names.get(
                        row.requested_factory_id || row.factory_id || "",
                      ) || "Factory unavailable"}{" "}
                      · {dateText(row.created_at)}
                    </small>
                  </div>
                  <Tag tone={row.status === "active" ? "green" : "amber"}>
                    {status(row.status)}
                  </Tag>
                  <button onClick={() => setSelected(row.id)}>
                    View application
                  </button>
                </div>
              ))}
            </section>
            {selected && (
              <ManagerDetail
                key={selected}
                id={selected}
                token={token}
                factories={factories.data || []}
                close={() => setSelected("")}
                changed={async () => {
                  await Promise.all([
                    managers.refetch(),
                    factories.refetch(),
                    cache.invalidateQueries({
                      queryKey: ["admin-application"],
                    }),
                  ]);
                }}
              />
            )}
          </>
        )}
      </main>
      {caseId && (
        <Modal title="Case conditions" close={() => setCaseId("")}>
          {details.isLoading && <Busy />}
          {details.error && <ErrorNote text={message(details.error)} />}
          {details.data && (
            <div className="admin-form">
              <h2>
                {details.data.case.title} · {details.data.case.factory}
              </h2>
              {details.data.case.inspection_on && (
                <p>
                  Inspection date · {dateText(details.data.case.inspection_on)}
                </p>
              )}
              <p>
                Assigned reviewer:{" "}
                {reviewers.data?.find(
                  (row) => row.id === details.data.case.reviewer_id,
                )?.full_name ||
                  (reviewers.isPending ? "Loading…" : "Unassigned")}
              </p>
              <p>
                {details.data.run
                  ? `Latest published run · ${dateText(details.data.run.created_at)}`
                  : "No published verification run."}
              </p>
              {details.data.results.map((row) => (
                <article key={row.id}>
                  <Tag>{outcomes[row.outcome]}</Tag>
                  <p>{row.claim.source.quote}</p>
                  <p className="hint">{row.reason}</p>
                </article>
              ))}
              <h3>Corrective tasks</h3>
              {details.data.tasks.length ? (
                <ul>
                  {details.data.tasks.map((task) => (
                    <li key={task.id}>
                      {task.title} · {status(task.status)} · Due{" "}
                      {dateText(task.due_on)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No corrective tasks.</p>
              )}
              <h3>Case documents</h3>
              {details.data.documents.length ? (
                <ul>
                  {details.data.documents.map((doc) => (
                    <li key={doc.id}>{doc.title}</li>
                  ))}
                </ul>
              ) : (
                <p>No case documents.</p>
              )}
            </div>
          )}
        </Modal>
      )}
      {add && (
        <Modal title="Add reviewer" close={() => setAdd(false)}>
          <form className="admin-form" method="post" onSubmit={addReviewer}>
            <ReviewerFields />
            {error && <ErrorNote text={error} />}
            <button className="primary" disabled={busy}>
              Create reviewer
            </button>
          </form>
        </Modal>
      )}
      {invite && (
        <Modal title="One-time reviewer invite" close={() => setInvite("")}>
          <p>
            Copy and share this link with the reviewer. It expires in 48 hours
            and is shown only here.
          </p>
          <label>
            Invite link
            <input
              readOnly
              value={invite}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <button
            className="primary"
            onClick={() =>
              void navigator.clipboard
                .writeText(invite)
                .then(() => setCopied(true))
                .catch(() => setError("Select and copy the link manually."))
            }
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          {error && <ErrorNote text={error} />}
        </Modal>
      )}
      {deactivate && (
        <Modal title="Deactivate reviewer" close={() => setDeactivate(null)}>
          <p>{deactivate.name} will lose workspace access.</p>
          {error && <ErrorNote text={error} />}
          <button
            className="danger"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                await api(
                  `/v1/admin/accounts/${deactivate.id}/deactivate`,
                  token,
                  "POST",
                  {},
                );
                setDeactivate(null);
                await Promise.all([reviewers.refetch(), factories.refetch()]);
              })
            }
          >
            Deactivate
          </button>
        </Modal>
      )}
    </>
  );
}

function ManagerDetail({
  id,
  token,
  factories,
  close,
  changed,
}: {
  id: string;
  token: string;
  factories: Factory[];
  close: () => void;
  changed: () => Promise<void>;
}) {
  const query = useQuery({
    queryKey: ["admin-application", id, token],
    queryFn: () =>
      api<Application>(`/v1/admin/manager-applications/${id}`, token),
  });
  const [factory, setFactory] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<Blob | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!preview) {
      setUrl("");
      return;
    }
    const url = URL.createObjectURL(preview);
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);
  const row = query.data;
  const selected = factory ?? row?.requested_factory_id ?? "";
  async function action(choice: string) {
    setBusy(true);
    setError("");
    try {
      if (choice === "preview") {
        const response = await fetch(
          apiBase() + `/v1/admin/manager-applications/${id}/id-card`,
          { headers: { Authorization: "Bearer " + token }, cache: "no-store" },
        );
        if (!response.ok) throw new Error("The office ID card is unavailable.");
        setPreview(await response.blob());
      } else if (choice === "cleanup") {
        await api(
          `/v1/admin/manager-applications/${id}/id-card`,
          token,
          "DELETE",
        );
        await changed();
      } else {
        await api(`/v1/admin/accounts/${id}/${choice}`, token, "POST", {
          factory_id: selected || null,
          reason: reason || null,
        });
        setPreview(null);
        await changed();
      }
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Manager application" close={close}>
      {query.isLoading && <Busy />}
      {query.error && <ErrorNote text={message(query.error)} />}
      {row && (
        <div className="admin-form">
          <div>
            <strong>{row.full_name}</strong>
            <p>
              {row.email} · {row.phone || "Phone unavailable"}
            </p>
            <p>
              {row.job_title || "Factory Manager"} · {status(row.status)}
            </p>
          </div>
          <p>
            Submitted {dateText(row.created_at)}.{" "}
            {row.consent_at ? "Office ID consent recorded." : ""}
          </p>
          {row.requested_factory && (
            <p>
              Requested factory: {row.requested_factory.name} ·{" "}
              {row.requested_factory.address}
            </p>
          )}
          {row.factory_id && (
            <p>
              Assigned factory:{" "}
              {factories.find((f) => f.id === row.factory_id)?.name}
            </p>
          )}
          {row.id_card_number && (
            <p>Office ID card number: {row.id_card_number}</p>
          )}
          {row.membership_number && (
            <p>License or membership: {row.membership_number}</p>
          )}
          {row.reject_reason && <p>Rejection reason: {row.reject_reason}</p>}
          {row.card_cleanup_pending && (
            <button disabled={busy} onClick={() => void action("cleanup")}>
              Retry office ID deletion
            </button>
          )}
          {row.id_card_deleted_at && (
            <p>Office ID deleted {dateText(row.id_card_deleted_at)}.</p>
          )}
          {row.has_id_card && !preview && (
            <button disabled={busy} onClick={() => void action("preview")}>
              View office ID card
            </button>
          )}
          {row.has_id_card &&
            url &&
            (preview?.type === "application/pdf" ? (
              <object
                data={url}
                type="application/pdf"
                title="Office ID PDF"
                className="admin-card-preview"
                style={{ height: 400 }}
              >
                <a href={url} target="_blank" rel="noreferrer">
                  Open office ID PDF
                </a>
              </object>
            ) : (
              <img
                src={url}
                alt="Submitted office ID card"
                className="admin-card-preview"
              />
            ))}
          {row.status === "pending_approval" && (
            <>
              <label>
                Factory to approve
                <select
                  value={selected}
                  onChange={(e) => setFactory(e.target.value)}
                >
                  <option value="">Choose factory</option>
                  {factories.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              {row.active_manager_factory_ids.includes(selected) && (
                <p className="notice" role="status">
                  This factory already has an active manager.
                </p>
              )}
              <label>
                Rejection reason
                <textarea
                  maxLength={1500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className="inline-actions">
                <button
                  className="primary"
                  disabled={busy || !selected}
                  onClick={() => void action("approve")}
                >
                  Approve
                </button>
                <button
                  className="danger"
                  disabled={busy || !reason.trim()}
                  onClick={() => void action("reject")}
                >
                  Reject
                </button>
              </div>
            </>
          )}
          {row.status === "active" && (
            <button
              className="danger"
              disabled={busy}
              onClick={() => void action("deactivate")}
            >
              Deactivate manager
            </button>
          )}
        </div>
      )}
      {error && <ErrorNote text={error} />}
    </Modal>
  );
}
