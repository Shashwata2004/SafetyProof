"use client";

import { FormEvent, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBase, dateText, message, outcomes } from "@/lib/api";
import type { Outcome } from "@/lib/api";
import type { Factory } from "./onboarding";
import { Busy, ErrorNote, Modal, Tag } from "./ui";

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
  case: { title: string; factory: string };
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
const organizations = [
  "BGMEA",
  "BKMEA",
  "Department of Inspection for Factories and Establishments (DIFE)",
  "RMG Sustainability Council (RSC)",
];

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
  const [assigneeId, setAssigneeId] = useState("");
  const [assignmentSaved, setAssignmentSaved] = useState(false);
  const [organization, setOrganization] = useState("");
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
    enabled: view === "reviewers" || view === "factory-assignments",
  });
  const managers = useQuery({
    queryKey: ["admin-applications", token],
    queryFn: () => api<Application[]>("/v1/admin/manager-applications", token),
    enabled: view === "manager-applications",
  });
  const assignees =
    reviewers.data?.filter((row) => row.status !== "deactivated") || [];
  const assignee = assignees.find((row) => row.id === assigneeId);
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
        {
          full_name: form.get("full_name"),
          email: form.get("email"),
          organization:
            (organization === "custom"
              ? String(form.get("custom_organization")).trim()
              : organization) || null,
          role_type: form.get("role_type") || null,
        },
      );
      setAdd(false);
      setCopied(false);
      setInvite(response.invite_url);
      await reviewers.refetch();
    });
  }

  async function saveAssignments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignee) return;
    const ids = new FormData(event.currentTarget).getAll("factory_ids");
    setAssignmentSaved(false);
    await perform(async () => {
      await api(`/v1/admin/reviewers/${assignee.id}/factories`, token, "POST", {
        factory_ids: ids,
      });
      setAssignmentSaved(true);
      await Promise.all([reviewers.refetch(), factories.refetch()]);
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
        {error && !add && !deactivate && <ErrorNote text={error} />}
        {view === "factories" && (
          <section className="panel">
            <div className="section-head">
              <h1>Factory safety overview</h1>
            </div>
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
                  setOrganization("");
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
                <div>
                  <strong>{row.full_name}</strong>
                  <small>
                    {row.email} · {row.role_type || "Role type unspecified"}
                    {row.organization && ` · ${row.organization}`}
                  </small>
                  <small>
                    {dateText(row.created_at)} ·{" "}
                    {row.reviewer_factories
                      .map((f) => names.get(f.factory_id))
                      .filter(Boolean)
                      .join(", ") || "No factory assignments"}
                  </small>
                </div>
                <div className="inline-actions">
                  <Tag tone={row.status === "active" ? "green" : "amber"}>
                    {status(row.status)}
                  </Tag>
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
                  {row.status !== "deactivated" && (
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
                <p>Choose a reviewer and the factories they can access.</p>
              </div>
            </div>
            <div className="panel-pad admin-form">
              {reviewers.isLoading && <Busy />}
              {reviewers.error && <ErrorNote text={message(reviewers.error)} />}
              {factories.error && <ErrorNote text={message(factories.error)} />}
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
                  <option value="">Choose a reviewer</option>
                  {assignees.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.full_name} · {row.email}
                    </option>
                  ))}
                </select>
              </label>
              {!reviewers.isLoading &&
                !reviewers.error &&
                !assignees.length && <p>Add a reviewer first.</p>}
              {assignee && factories.isSuccess && (
                <form
                  key={assignee.id}
                  className="admin-form"
                  onSubmit={saveAssignments}
                  onChange={() => setAssignmentSaved(false)}
                >
                  <fieldset disabled={busy}>
                    <legend>Factories</legend>
                    {factories.data.map((factory) => (
                      <label
                        className="inline-actions"
                        style={{ display: "flex" }}
                        key={factory.id}
                      >
                        <input
                          type="checkbox"
                          name="factory_ids"
                          value={factory.id}
                          defaultChecked={assignee.reviewer_factories.some(
                            (row) => row.factory_id === factory.id,
                          )}
                        />
                        {factory.name}
                      </label>
                    ))}
                  </fieldset>
                  <div>
                    <button className="primary" disabled={busy}>
                      Save assignments
                    </button>
                  </div>
                  {assignmentSaved && <p role="status">Assignments saved.</p>}
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
          <form className="admin-form" onSubmit={addReviewer}>
            <label>
              Full name
              <input name="full_name" maxLength={160} required />
            </label>
            <label>
              Email
              <input name="email" type="email" maxLength={254} required />
            </label>
            <label>
              <span>Organization (optional)</span>
              <select
                aria-label="Organization (optional)"
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
              >
                <option value="">Choose an organization</option>
                {organizations.map((name) => (
                  <option key={name}>{name}</option>
                ))}
                <option value="custom">Enter another organization</option>
              </select>
            </label>
            {organization === "custom" && (
              <label>
                Organization name
                <input
                  name="custom_organization"
                  maxLength={160}
                  required
                  pattern={String.raw`.*\S.*`}
                />
              </label>
            )}
            <label>
              Role type (optional)
              <select name="role_type">
                <option value="">Choose role type</option>
                {[
                  "Compliance Officer",
                  "Independent Auditor",
                  "Buyer Sustainability Team",
                ].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
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
