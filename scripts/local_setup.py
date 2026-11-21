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
for name, account in accounts.items():
    metadata = (
        {"app_metadata": {"workspace_role": "factory_manager"}}
        if name == "factory_manager"
        else {}
    )
    resp = httpx.post(
        keys["SUPABASE_URL"] + "/auth/v1/admin/users",
        headers={
            "apikey": keys["SUPABASE_SERVICE_ROLE_KEY"],
            "Authorization": "Bearer " + keys["SUPABASE_SERVICE_ROLE_KEY"],
        },
        json={**account, **metadata, "email_confirm": True},
    )
    if not resp.is_success and resp.json().get("error_code") != "email_exists":
        resp.raise_for_status()
    login = httpx.post(
        keys["SUPABASE_URL"] + "/auth/v1/token",
        params={"grant_type": "password"},
        headers={"apikey": keys["SUPABASE_ANON_KEY"]},
        json=account,
    )
    if (
        login.is_success
        and name == "factory_manager"
        and login.json()["user"]["app_metadata"].get("workspace_role")
        != "factory_manager"
    ):
        raise SystemExit("The local Factory Manager lacks its Auth role metadata.")
    if not login.is_success:
        raise SystemExit(
            "The generated local account could not sign in. Check local Supabase Auth."
        )
print("Local account details are stored in .local/accounts.json")
