"""Configure this checkout for its own local Supabase stack and provision private test logins."""

import json
import os
import secrets
import shlex
import subprocess
from pathlib import Path
import httpx

ROOT = Path(__file__).resolve().parents[1]
local = ROOT / ".local"
local.mkdir(mode=0o700, exist_ok=True)
env_text = subprocess.check_output(
    ["npx", "--yes", "supabase@2.98.2", "status", "-o", "env"],
    cwd=ROOT,
    stderr=subprocess.DEVNULL,
    text=True,
)
values = dict(pair.split("=", 1) for pair in shlex.split(env_text) if "=" in pair)
keys = {
    "SUPABASE_URL": values["API_URL"],
    "SUPABASE_ANON_KEY": values["ANON_KEY"],
    "SUPABASE_SERVICE_ROLE_KEY": values["SERVICE_ROLE_KEY"],
}
env = ROOT / ".env"
with open(env, "a+", opener=lambda path, flags: os.open(path, flags, 0o600)) as f:
    f.seek(0)
    current = f.read()
    for k, v in keys.items():
        if not any(
            line.startswith(k + "=") and line.split("=", 1)[1].strip()
            for line in current.splitlines()
        ):
            f.write("\n" + k + "=" + v + "\n")
creds = local / "accounts.json"
accounts = json.loads(creds.read_text()) if creds.exists() else {}
changed = not creds.exists()
for name in ("reviewer", "viewer", "factory_manager"):
    if name not in accounts:
        accounts[name] = {
            "email": name.replace("_", "-") + "@safetyproof.test",
            "password": secrets.token_urlsafe(20),
        }
        changed = True
if changed:
    with open(creds, "w", opener=lambda path, flags: os.open(path, flags, 0o600)) as f:
        json.dump(accounts, f, indent=2)
admin_headers = {
    "apikey": keys["SUPABASE_SERVICE_ROLE_KEY"],
    "Authorization": "Bearer " + keys["SUPABASE_SERVICE_ROLE_KEY"],
}
base = keys["SUPABASE_URL"]
factory = httpx.get(
    base + "/rest/v1/factories",
    headers=admin_headers,
    params={"name": "eq.Shaluk Threadworks Ltd."},
)
factory.raise_for_status()
factory_id = factory.json()[0]["id"]
for name in ("reviewer", "viewer", "factory_manager"):
    account = accounts[name]
    existing = httpx.get(
        base + "/rest/v1/account_profiles",
        headers=admin_headers,
        params={"email": "eq." + account["email"]},
    )
    existing.raise_for_status()
    if existing.json():
        uid = existing.json()[0]["id"]
    else:
        profile = {
            "role": name,
            "status": "active",
            "full_name": name.replace("_", " ").title(),
        }
        if name == "factory_manager":
            profile["factory_id"] = factory_id
        resp = httpx.post(
            base + "/auth/v1/admin/users",
            headers=admin_headers,
            json={"email": account["email"], "email_confirm": True},
        )
        resp.raise_for_status()
        uid = resp.json()["id"]
        httpx.post(
            base + "/rest/v1/rpc/sp_register_profile",
            headers=admin_headers,
            json={"uid": uid, "p": profile, "secret": account["password"]},
        ).raise_for_status()
    if name == "reviewer":
        httpx.post(
            base + "/rest/v1/reviewer_factories",
            headers={**admin_headers, "Prefer": "resolution=ignore-duplicates"},
            json={"reviewer_id": uid, "factory_id": factory_id},
        ).raise_for_status()
print("Local account details are stored in .local/accounts.json")
