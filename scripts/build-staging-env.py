#!/usr/bin/env python3
"""Build the staging .env from .project-config.json.

Two safety transforms, identical to the pre-reset setup:
  1. DATABASE_URL is repointed at the local MariaDB scratch clone.
  2. Write-capable third-party credentials are blanked so no button in the
     staging UI can publish, email, spend ad budget, or burn paid credits.

Read-only keys are intentionally left intact so dashboards still populate
and the app looks real during review.
"""
import json
import pathlib
import re

repo = pathlib.Path("/home/ubuntu/contenthub")
config = json.loads((repo / ".project-config.json").read_text())

# The config stores env vars either flat or under an "env"/"variables" key.
env: dict[str, str] = {}


def harvest(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, (str, int, float, bool)) and re.fullmatch(r"[A-Z0-9_]+", str(k)):
                env[str(k)] = str(v)
            else:
                harvest(v)
    elif isinstance(obj, list):
        for item in obj:
            harvest(item)


harvest(config)

if not env:
    raise SystemExit("No env vars harvested from .project-config.json — inspect its shape")

prod_db = env.get("DATABASE_URL", "")

# 1. Repoint EVERY database connection string at the local scratch clone.
#    Note: there is more than one. DRIZZLE_DATABASE_URL is a separate var and
#    missing it means migrations/queries silently hit production.
# MariaDB's root uses unix_socket auth, so a TCP connection as root is refused.
# A dedicated password-authenticated user scoped to the staging DB is required.
STAGING_URL = "mysql://chstaging:stagingonly@127.0.0.1:3306/contenthub_staging"
repointed = []
for key, value in list(env.items()):
    if isinstance(value, str) and re.match(r"^mysql(2)?://", value.strip()):
        env[key] = STAGING_URL
        repointed.append(key)

# Belt and braces: ensure the canonical names exist even if absent above.
for key in ("DATABASE_URL", "DRIZZLE_DATABASE_URL"):
    if env.get(key) != STAGING_URL:
        env[key] = STAGING_URL
        if key not in repointed:
            repointed.append(key)

# 2. Neutralize write-capable credentials.
NEUTRALIZE = [
    # Publishing
    "WORDPRESS_PASSWORD", "WORDPRESS_APP_PASSWORD", "WP_APP_PASSWORD",
    "SUBSTACK_COOKIE", "SUBSTACK_SESSION", "SUBSTACK_API_KEY",
    "SUBSTACK_SESSION_COOKIE",
    # Email / SMS
    "KLAVIYO_API_KEY", "KLAVIYO_PRIVATE_KEY",
    # Paid ad spend
    "META_ACCESS_TOKEN", "META_APP_SECRET", "FACEBOOK_ACCESS_TOKEN",
    "META_AD_ACCESS_TOKEN",
    # Paid generation credits
    "HEYGEN_API_KEY", "DESCRIPT_API_KEY", "GAMMA_API_KEY",
    # Scheduling / commerce writes
    "BUFFER_ACCESS_TOKEN", "SHOPIFY_ADMIN_TOKEN", "SHOPIFY_ADMIN_API_TOKEN",
    "KAJABI_API_KEY", "TYPEFORM_TOKEN", "TYPEFORM_API_KEY",
    "KAJABI_CLIENT_SECRET",
    # Outbound email (can send on your behalf)
    "GMAIL_CLIENT_SECRET",
]

neutralized = []
for key in NEUTRALIZE:
    if key in env and env[key]:
        env[key] = ""
        neutralized.append(key)

# Enable the dev-only login route so the sandbox is reviewable without
# the production OAuth redirect allow-list.
env["NODE_ENV"] = "development"
env["ALLOW_DEV_LOGIN"] = "true"

lines = [f"{k}={v}" for k, v in sorted(env.items())]
(repo / ".env").write_text("\n".join(lines) + "\n")

# Keep the real production DATABASE_URL out of the working tree entirely;
# it is already in .project-config.json and does not need a second copy.
print(f"wrote .env with {len(env)} vars")
print(f"repointed {len(repointed)} DB connection string(s) -> {STAGING_URL}")
for key in repointed:
    print(f"    {key}")
print(f"production DB host preserved in .project-config.json only "
      f"(was {prod_db.split('@')[-1].split('/')[0] if '@' in prod_db else 'n/a'})")
print(f"neutralized {len(neutralized)}: {', '.join(neutralized)}")
