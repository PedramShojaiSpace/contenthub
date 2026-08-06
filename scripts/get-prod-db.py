#!/usr/bin/env python3
"""Emit shell-sourceable production DB connection vars from .project-config.json.

Read-only usage: we only ever mysqldump FROM this host. The app itself never
receives these values because .env points at the local MariaDB clone.
"""
import json
import pathlib
import re
import urllib.parse

config = json.loads(pathlib.Path("/home/ubuntu/contenthub/.project-config.json").read_text())

url = None


def find_db_url(obj):
    global url
    if url:
        return
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "DATABASE_URL" and isinstance(v, str) and v.startswith("mysql"):
                url = v
                return
            find_db_url(v)
    elif isinstance(obj, list):
        for item in obj:
            find_db_url(item)


find_db_url(config)

if not url:
    raise SystemExit("DATABASE_URL not found in .project-config.json")

parsed = urllib.parse.urlparse(url)
db_name = parsed.path.lstrip("/").split("?")[0]

print(f'export PH="{parsed.hostname}"')
print(f'export PP="{parsed.port or 4000}"')
print(f'export PU="{urllib.parse.unquote(parsed.username or "")}"')
print(f'export PW="{urllib.parse.unquote(parsed.password or "")}"')
print(f'export PD="{db_name}"')
