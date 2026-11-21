import asyncio
import json
import logging
import os
import sys
from contextlib import suppress
import httpx
from .ai import InferenceFailure
from .platform import PlatformError
from .verify import run_verification

log = logging.getLogger(__name__)


async def isolated_pdf(data, vid, tessdata):
    proc = await asyncio.create_subprocess_exec(
        sys.executable,
        "-m",
        "safetyproof.pdf",
        vid,
        tessdata,
        env={**os.environ, "OMP_THREAD_LIMIT": "1"},
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        out, err = await asyncio.wait_for(proc.communicate(data), timeout=160)
    finally:
        if proc.returncode is None:
            proc.kill()
            await proc.wait()
    if proc.returncode:
        msg = (
            err.decode(errors="replace")[-250:]
            if proc.returncode == 2
            else "PDF exceeds the parser resource budget."
        )
        raise ValueError(msg)
    return json.loads(out)


async def process(db, ai, cfg, job):
    async def step(op, payload):
        return await db.rpc(
            "step", jid=job["id"], ticket=job["lease"], op=op, payload=payload
        )

    async def renew():
        while True:
            await asyncio.sleep(40)
            await step("progress", {})

    heartbeat = asyncio.create_task(renew())
    try:
        if job["kind"] == "ingest":
            v = await db.one("document_versions", job["version_id"])
            await step("progress", {"stage": "Reading PDF and checking scan quality"})
            data = await db.download(v["object_key"])
            parsed = await isolated_pdf(data, v["id"], cfg.tessdata_prefix)
            await step("ingested", parsed)
        else:
            run = await db.one("verification_runs", job["run_id"])
            if run["config"] != cfg.provenance():
                raise InferenceFailure(
                    "Analysis settings changed. Start a new run to use this configuration.",
                    pause=True,
                )
            await run_verification(db, ai, job, run, step)
    except (
        InferenceFailure,
        ValueError,
        PlatformError,
        httpx.RequestError,
        TimeoutError,
    ) as exc:
        transient = (
            isinstance(exc, (InferenceFailure, httpx.RequestError, TimeoutError))
            or isinstance(exc, PlatformError)
            and exc.status >= 500
        )
        retry = transient and job["attempts"] < 3
        state = (
            "paused"
            if getattr(exc, "pause", False)
            else "queued"
            if retry
            else "failed"
        )
        msg = (
            str(exc)
            if isinstance(exc, (ValueError, PlatformError, InferenceFailure))
            else "A processing service timed out. Retry the job."
        )
        await step(
            "error",
            {
                "state": state,
                "message": msg[:350],
                "delay": max(2 ** job["attempts"], getattr(exc, "delay", 0)),
            },
        )
    except Exception as exc:
        log.error(
            "Unexpected processing error %s in job %s", type(exc).__name__, job["id"]
        )
        await step(
            "error",
            {
                "state": "failed",
                "message": "Processing failed unexpectedly. Inspect the service log and retry.",
            },
        )
    finally:
        heartbeat.cancel()
        with suppress(asyncio.CancelledError, PlatformError):
            await heartbeat


async def loop(db, ai, cfg, wake):
    while True:
        wake.clear()
        try:
            job = await db.rpc("claim")
            if job:
                await process(db, ai, cfg, job)
                continue
        except (PlatformError, httpx.RequestError) as exc:
            log.warning("Worker connection unavailable (%s)", type(exc).__name__)
        with suppress(TimeoutError):
            await asyncio.wait_for(wake.wait(), timeout=3)
