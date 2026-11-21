import asyncio
import json
from contextlib import asynccontextmanager, suppress
from uuid import UUID, uuid4, uuid5
from datetime import date
from typing import Literal
import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict, Field
from .ai import Gemini
from .config import settings, JOB_FIELDS
from .models import (
    CaseInput,
    CaseRecord,
    CapReviewInput,
    UploadInput,
    RunInput,
    ReviewInput,
    UploadTicket,
    RunTicket,
    PublishedResult,
)
from .platform import Platform, PlatformError
from .worker import loop

cfg = settings()
bearer = HTTPBearer(auto_error=False)


@asynccontextmanager
async def lifespan(app):
    async with httpx.AsyncClient(timeout=35) as client:
        app.state.db = Platform(cfg, client)
        app.state.ai = Gemini(cfg)
        app.state.wake = asyncio.Event()
        task = (
            asyncio.create_task(loop(app.state.db, app.state.ai, cfg, app.state.wake))
            if cfg.worker_enabled and cfg.supabase_service_role_key
            else None
        )
        try:
            yield
        finally:
            if task:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
            if app.state.ai.client:
                await app.state.ai.client.aio.aclose()


app = FastAPI(title="SafetyProof AI", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[s.strip() for s in cfg.cors_origins.split(",")],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def protect_authenticated_responses(request: Request, call_next):
    response = await call_next(request)
    if request.headers.get("authorization"):
        response.headers["Cache-Control"] = "private, no-store"
    return response


@app.exception_handler(PlatformError)
async def platform_error(_, error):
    return JSONResponse(
        {"detail": str(error)},
        status_code=error.status if 400 <= error.status < 600 else 502,
    )


class User(BaseModel):
    id: str
    token: str
    factory_manager: bool = False


async def user(
    request: Request, auth: HTTPAuthorizationCredentials | None = Depends(bearer)
):
    if not auth:
        raise HTTPException(401, "Sign in to open this workspace.")
    db = request.app.state.db
    try:
        identity = await db.call("GET", "/auth/v1/user", token=auth.credentials)
    except PlatformError as e:
        if e.status in (400, 401, 403):
            raise HTTPException(401, "Your sign-in has expired.") from e
        raise
    return User(
        id=identity["id"],
        token=auth.credentials,
        factory_manager=identity.get("app_metadata", {}).get("workspace_role")
        == "factory_manager",
    )


def db(request: Request):
    return request.app.state.db


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/v1/config")
def public_config():
    return {
        "supabase_url": cfg.supabase_url,
        "publishable_key": cfg.supabase_anon_key,
        "ai_configured": bool(cfg.gemini_api_key),
        "models": cfg.provenance(),
        "limits": {
            "file_mb": 10,
            "file_pages": 20,
            "case_documents": 10,
            "case_pages": 100,
        },
    }


def samples():
    return json.loads((cfg.sample_dir / "manifest.json").read_text())


@app.get("/v1/samples")
def sample_list():
    return samples()


@app.get("/v1/samples/{filename}")
def sample_pdf(filename: str):
    if filename not in {d["filename"] for d in samples()["documents"]}:
        raise HTTPException(404, "Unknown sample.")
    return FileResponse(
        cfg.sample_dir / filename,
        media_type="application/pdf",
        filename=filename,
        content_disposition_type="inline",
    )


@app.get("/v1/cases", response_model=list[CaseRecord])
async def list_cases(u: User = Depends(user), d=Depends(db)):
    return await d.rows("cases", token=u.token, order="created_at.desc")


@app.post("/v1/cases", response_model=CaseRecord, status_code=201)
async def create_case(body: CaseInput, u: User = Depends(user), d=Depends(db)):
    if u.factory_manager:
        raise HTTPException(403, "A reviewer creates and shares the case.")
    return await d.rpc("create_case", actor_id=u.id, data=body.model_dump(mode="json"))


@app.get("/v1/cases/{cid}")
async def get_case(cid: UUID, u: User = Depends(user), d=Depends(db)):
    c = await d.one("cases", cid, token=u.token)
    f = {"case_id": "eq." + str(cid)}
    members, docs, versions, runs, jobs = await asyncio.gather(
        d.rows("case_members", token=u.token, filters=f),
        d.rows("documents", token=u.token, filters=f),
        d.rows("document_versions", token=u.token, filters=f, order="created_at"),
        d.rows(
            "verification_runs",
            token=u.token,
            fields="id,created_at,status,manifest,config,usage",
            filters=f,
            order="created_at.desc,id.desc",
        ),
        d.rows(
            "jobs", token=u.token, fields=JOB_FIELDS, filters=f, order="created_at.desc"
        ),
    )
    return {
        "case": c,
        "role": members[0]["role"],
        "documents": docs,
        "versions": versions,
        "runs": runs,
        "jobs": jobs,
    }


@app.get("/v1/cases/{cid}/followups")
async def evidence_followups(cid: UUID, u: User = Depends(user), d=Depends(db)):
    await d.one("cases", cid, token=u.token)
    case_filter = {"case_id": "eq." + str(cid)}
    events = await d.rows(
        "review_events",
        token=u.token,
        filters={**case_filter, "action": "neq.comment"},
        order="created_at.desc,id.desc",
    )
    decisions = {}
    for event in events:
        decisions.setdefault(event["result_id"], event)
    pending = {
        rid: event
        for rid, event in decisions.items()
        if event["action"] == "request_evidence"
    }
    if not pending:
        return []
    records = await d.rows(
        "results", token=u.token, fields="id,run_id,claim", filters=case_filter
    )
    findings = {result["id"]: result for result in records if result["id"] in pending}
    return [
        {
            "id": rid,
            "run_id": findings[rid]["run_id"],
            "source": findings[rid]["claim"]["source"],
            "event": event,
        }
        for rid, event in pending.items()
        if rid in findings
    ]


class Archive(BaseModel):
    archived: bool


@app.patch("/v1/cases/{cid}")
async def archive_case(
    cid: UUID, body: Archive, u: User = Depends(user), d=Depends(db)
):
    c = await d.one("cases", cid, token=u.token)
    if c["created_by"] != u.id:
        raise HTTPException(403, "Only the case owner can archive this case.")
    await d.call(
        "PATCH",
        "/rest/v1/cases",
        admin=True,
        params={"id": "eq." + str(cid)},
        data={"archived": body.archived},
    )
    return {"archived": body.archived}


@app.delete("/v1/cases/{cid}", status_code=200)
async def delete_case(cid: UUID, u: User = Depends(user), d=Depends(db)):
    c = await d.one("cases", cid, token=u.token)
    if c["created_by"] != u.id:
        raise HTTPException(403, "Only the case owner can delete this case.")
    # The tombstone prevents new jobs and reservations while cleanup is retried.
    await d.call(
        "PATCH",
        "/rest/v1/cases",
        admin=True,
        params={"id": "eq." + str(cid)},
        data={"deleting": True, "archived": True},
    )
    versions = await d.rows(
        "document_versions", fields="object_key", filters={"case_id": "eq." + str(cid)}
    )
    submissions = await d.rows(
        "corrective_evidence",
        fields="object_key",
        filters={"case_id": "eq." + str(cid)},
    )
    await d.remove(sorted({row["object_key"] for row in versions + submissions}))
    await d.call(
        "DELETE",
        "/rest/v1/cases",
        admin=True,
        params={"id": "eq." + str(cid), "created_by": "eq." + u.id},
    )
    return {"deleted": True}


@app.post("/v1/cases/{cid}/uploads", response_model=UploadTicket)
async def reserve_upload(
    cid: UUID, body: UploadInput, u: User = Depends(user), d=Depends(db)
):
    await d.one("cases", cid, token=u.token)
    version = await d.rpc(
        "reserve", cid=str(cid), actor_id=u.id, data=body.model_dump(mode="json")
    )
    url = (
        await d.signed(version["object_key"], upload=True)
        if version["status"] == "awaiting_upload"
        else None
    )
    return {"version_id": version["id"], "upload_url": url, "status": version["status"]}


@app.post("/v1/document-versions/{vid}/finalize", status_code=202)
async def finalize(vid: UUID, request: Request, u: User = Depends(user), d=Depends(db)):
    v = await d.one("document_versions", vid, token=u.token)
    jid = await d.rpc("ingest", cid=v["case_id"], actor_id=u.id, vid=str(vid))
    request.app.state.wake.set()
    return {"job_id": jid}


@app.get("/v1/document-versions/{vid}/pages")
async def pages(vid: UUID, u: User = Depends(user), d=Depends(db)):
    await d.one("document_versions", vid, token=u.token)
    return await d.rows(
        "pages",
        token=u.token,
        filters={"version_id": "eq." + str(vid)},
        order="page_no",
    )


@app.get("/v1/document-versions/{vid}/source")
async def source(vid: UUID, u: User = Depends(user), d=Depends(db)):
    v = await d.one("document_versions", vid, token=u.token)
    if v["status"] not in ("ready", "partial"):
        raise HTTPException(409, "This document is not ready for preview.")
    return {"url": await d.signed(v["object_key"]), "expires_in": 300}


@app.post("/v1/cases/{cid}/samples", status_code=202)
async def add_samples(
    cid: UUID, request: Request, u: User = Depends(user), d=Depends(db)
):
    c = await d.one("cases", cid, token=u.token)
    catalog = samples()
    if c["factory"] != catalog["factory"]:
        raise HTTPException(
            409, "These sample documents belong to the factory listed in the document library."
        )
    for meta in catalog["documents"]:
        v = await d.rpc(
            "reserve",
            cid=str(cid),
            actor_id=u.id,
            data={
                **meta,
                "request_key": str(uuid5(cid, meta["filename"])),
                "confirmed_factory": c["factory"],
            },
        )
        if v["status"] == "awaiting_upload":
            try:
                await d.put(
                    v["object_key"], (cfg.sample_dir / meta["filename"]).read_bytes()
                )
            except PlatformError as exc:
                if (
                    "already exists" not in str(exc).lower()
                    and "duplicate" not in str(exc).lower()
                ):
                    raise
        await d.rpc("ingest", cid=str(cid), actor_id=u.id, vid=v["id"])
    request.app.state.wake.set()
    return {"documents": len(catalog["documents"])}


@app.post("/v1/cases/{cid}/runs", response_model=RunTicket, status_code=202)
async def new_run(
    cid: UUID, body: RunInput, request: Request, u: User = Depends(user), d=Depends(db)
):
    await d.one("cases", cid, token=u.token)
    if not cfg.gemini_api_key:
        raise HTTPException(
            503, "The service needs a Gemini API key to run verification."
        )
    ticket = await d.rpc(
        "run",
        cid=str(cid),
        actor_id=u.id,
        vids=[str(v) for v in body.version_ids],
        request_id=str(body.request_key),
        configuration=cfg.provenance(),
    )
    request.app.state.wake.set()
    return ticket


@app.get("/v1/jobs/{jid}")
async def job(jid: UUID, u: User = Depends(user), d=Depends(db)):
    return await d.one("jobs", jid, fields=JOB_FIELDS, token=u.token)


@app.post("/v1/jobs/{jid}/retry", status_code=202)
async def retry(jid: UUID, request: Request, u: User = Depends(user), d=Depends(db)):
    j = await d.one("jobs", jid, fields=JOB_FIELDS, token=u.token)
    await d.rpc("retry", cid=j["case_id"], actor_id=u.id, jid=str(jid))
    request.app.state.wake.set()
    return {"job_id": str(jid)}


@app.get("/v1/runs/{rid}")
async def get_run(rid: UUID, u: User = Depends(user), d=Depends(db)):
    return await d.one("verification_runs", rid, token=u.token)


async def ranked_results(run, u, d):
    rows = await d.rows("results", token=u.token, filters={"run_id": "eq." + run["id"]})
    notes = await d.rows(
        "review_events",
        token=u.token,
        filters={"case_id": "eq." + run["case_id"]},
        order="created_at,id",
    )
    by_result = {}
    for note in notes:
        by_result.setdefault(note["result_id"], []).append(note)
    for row in rows:
        row["reviews"] = by_result.get(row["id"], [])
    severity = {"high": 0, "medium": 1, "low": 2, "unknown": 3}
    outcome_order = {
        "contradicted": 0,
        "unresolved": 1,
        "unsupported": 2,
        "needs_review": 3,
        "not_assessed": 4,
        "supported": 5,
    }
    return sorted(
        rows,
        key=lambda r: (
            severity.get(r["claim"].get("severity"), 3),
            outcome_order[r["outcome"]],
            r["claim"]["source"]["page"],
            r["id"],
        ),
    )


@app.get("/v1/runs/{rid}/results", response_model=list[PublishedResult])
async def results(rid: UUID, u: User = Depends(user), d=Depends(db)):
    return await ranked_results(
        await d.one("verification_runs", rid, token=u.token), u, d
    )


@app.post("/v1/results/{rid}/reviews", status_code=201)
async def review(rid: UUID, body: ReviewInput, u: User = Depends(user), d=Depends(db)):
    result = await d.one("results", rid, token=u.token)
    eid = await d.rpc(
        "review",
        cid=result["case_id"],
        actor_id=u.id,
        rid=str(rid),
        data=body.model_dump(),
    )
    return {"event_id": eid}


@app.get("/v1/runs/{rid}/report")
async def report(rid: UUID, u: User = Depends(user), d=Depends(db)):
    run = await d.one("verification_runs", rid, token=u.token)
    if run["status"] not in ("complete", "partial"):
        raise HTTPException(409, "This analysis is still incomplete.")
    return {
        "case": await d.one("cases", run["case_id"], token=u.token),
        "run": run,
        "results": await ranked_results(run, u, d),
        "cap_reviews": await cap_events(run["id"], u, d)
        if run["cap_analysis"] is not None
        else [],
    }


async def cap_events(rid, u, d):
    return await d.rows(
        "cap_review_events",
        token=u.token,
        filters={"run_id": "eq." + str(rid)},
        order="created_at,id",
    )


@app.get("/v1/runs/{rid}/cap")
async def cap_report(rid: UUID, u: User = Depends(user), d=Depends(db)):
    run = await d.one("verification_runs", rid, token=u.token)
    if run["status"] not in ("complete", "partial"):
        raise HTTPException(409, "This analysis is still incomplete.")
    return {"analysis": run["cap_analysis"], "reviews": await cap_events(rid, u, d)}


@app.post("/v1/runs/{rid}/cap/reviews", status_code=201)
async def review_cap(
    rid: UUID, body: CapReviewInput, u: User = Depends(user), d=Depends(db)
):
    await d.one("verification_runs", rid, token=u.token)
    event = await d.rpc(
        "cap_review",
        rid=str(rid),
        actor_id=u.id,
        finding=str(body.finding_id),
        cap_action=str(body.action_id),
        choice=body.decision,
        note=body.comment.strip(),
    )
    return {"event_id": event}


@app.get("/v1/runs/{rid}/retrieval")
async def retrieval(rid: UUID, u: User = Depends(user), d=Depends(db)):
    """Expose ranked source passages for evaluation and inspection within the same case."""
    run = await d.one("verification_runs", rid, token=u.token)
    records = await d.rows(
        "results",
        token=u.token,
        fields="id,coverage",
        filters={"run_id": "eq." + run["id"]},
    )
    ids = {key for row in records for key in row["coverage"]["retrieved"]}
    by_id = {}
    ordered = sorted(ids)
    for i in range(0, len(ordered), 60):
        chunk_ids = ordered[i : i + 60]
        batch = await d.rows(
            "chunks",
            token=u.token,
            fields="id,version_id,page_no,text",
            filters={
                "case_id": "eq." + run["case_id"],
                "id": "in.(" + ",".join(chunk_ids) + ")",
            },
        )
        by_id.update({c["id"]: c for c in batch})
    return {
        r["id"]: [by_id[key] for key in r["coverage"]["retrieved"] if key in by_id]
        for r in records
    }


class ManagerShare(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class TaskInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=160)
    detail: str = Field(default="", max_length=3000)
    assignee: str = Field(min_length=1, max_length=120)
    due_on: date


class TaskDecision(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    action: Literal["started", "return", "accept"]
    note: str = Field(default="", max_length=3000)


async def corrective_role(d, u, cid):
    membership = await d.rows(
        "case_members",
        token=u.token,
        fields="role",
        filters={"case_id": "eq." + str(cid)},
    )
    if not membership or membership[0]["role"] not in ("reviewer", "manager"):
        raise HTTPException(404, "Corrective work is unavailable.")
    return membership[0]["role"]


@app.post("/v1/cases/{cid}/share-manager", status_code=201)
async def share_manager(
    cid: UUID, body: ManagerShare, u: User = Depends(user), d=Depends(db)
):
    if await corrective_role(d, u, cid) != "reviewer":
        raise HTTPException(403, "Review access required.")
    await d.rpc(
        "share_manager", cid=str(cid), actor_id=u.id, manager_email=body.email.strip()
    )
    return {"shared": True}


@app.get("/v1/cases/{cid}/corrective-work")
async def corrective_work(cid: UUID, u: User = Depends(user), d=Depends(db)):
    role = await corrective_role(d, u, cid)
    filters = {"case_id": "eq." + str(cid)}
    tasks, evidence, events = await asyncio.gather(
        d.rows("corrective_tasks", token=u.token, filters=filters, order="due_on,id"),
        d.rows(
            "corrective_evidence",
            token=u.token,
            fields="id,task_id,filename,imported_version,created_at",
            filters=filters,
            order="created_at,id",
        ),
        d.rows(
            "corrective_events", token=u.token, filters=filters, order="created_at,id"
        ),
    )
    return {"role": role, "tasks": tasks, "evidence": evidence, "events": events}


@app.post("/v1/cases/{cid}/corrective-work", status_code=201)
async def create_task(
    cid: UUID, body: TaskInput, u: User = Depends(user), d=Depends(db)
):
    await corrective_role(d, u, cid)
    tid = await d.rpc(
        "corrective_task",
        cid=str(cid),
        actor_id=u.id,
        payload=body.model_dump(mode="json"),
    )
    return {"id": tid}


@app.post("/v1/corrective-tasks/{tid}/events")
async def task_event(
    tid: UUID, body: TaskDecision, u: User = Depends(user), d=Depends(db)
):
    task = await d.one("corrective_tasks", tid, token=u.token)
    expected_role = "manager" if body.action == "started" else "reviewer"
    if await corrective_role(d, u, task["case_id"]) != expected_role:
        raise HTTPException(403, "This action requires the other workspace role.")
    if body.action == "return" and not body.note:
        raise HTTPException(422, "Explain what needs to be revised.")
    await d.rpc(
        "corrective_event",
        tid=str(tid),
        actor_id=u.id,
        event_name=body.action,
        note=body.note,
    )
    return {"updated": True}


@app.post("/v1/corrective-tasks/{tid}/evidence", status_code=201)
async def submit_task_evidence(
    tid: UUID,
    request: Request,
    filename: str,
    u: User = Depends(user),
    d=Depends(db),
    content_type: str = Header(default=""),
):
    from .pdf import MAX_BYTES

    task = await d.one("corrective_tasks", tid, token=u.token)
    if await corrective_role(d, u, task["case_id"]) != "manager":
        raise HTTPException(403, "Factory Manager access required.")
    if task["status"] not in {"assigned", "in_progress", "needs_revision"}:
        raise HTTPException(409, "This task is not accepting evidence.")
    filename = filename.strip()
    if (
        not filename.lower().endswith(".pdf")
        or len(filename) > 200
        or any(ord(c) < 32 or c in "/\\" for c in filename)
    ):
        raise HTTPException(422, "Choose a PDF with a valid filename.")
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, "A PDF must be under 10 MB.")
        data.extend(chunk)
    if content_type.split(";")[0] != "application/pdf" or b"%PDF-" not in data[:1024]:
        raise HTTPException(422, "Choose a PDF file.")
    evidence_id = str(uuid4())
    key = f"{task['case_id']}/corrective/{evidence_id}.pdf"
    await d.put(key, bytes(data))
    try:
        await d.rpc(
            "corrective_event",
            tid=str(tid),
            actor_id=u.id,
            event_name="submitted",
            note="",
            evidence_id=evidence_id,
            original_filename=filename,
        )
    except PlatformError as exc:
        if exc.status < 500:
            await d.remove([key])
        raise
    return {"id": evidence_id}


@app.get("/v1/corrective-evidence/{eid}/source")
async def corrective_source(eid: UUID, u: User = Depends(user), d=Depends(db)):
    evidence = await d.one("corrective_evidence", eid, token=u.token)
    return {"url": await d.signed(evidence["object_key"])}


@app.post("/v1/corrective-evidence/{eid}/import", status_code=202)
async def import_corrective_evidence(
    eid: UUID, request: Request, u: User = Depends(user), d=Depends(db)
):
    evidence = await d.one("corrective_evidence", eid, token=u.token)
    if await corrective_role(d, u, evidence["case_id"]) != "reviewer":
        raise HTTPException(403, "Review access required.")
    job_id = await d.rpc("corrective_import", eid=str(eid), actor_id=u.id)
    request.app.state.wake.set()
    return {"job_id": job_id}
