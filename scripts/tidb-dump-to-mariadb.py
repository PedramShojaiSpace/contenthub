#!/usr/bin/env python3
"""
Make a TiDB mysqldump loadable into local MariaDB.

TiDB supports a native `vector(N)` column type and VECTOR INDEX, which MariaDB 10.11
does not understand. Only `corpus_entries.embedding` uses it. For a staging clone we
keep the column (so app code that SELECTs it still works) but degrade the type to
LONGTEXT and drop the vector index. Semantic/vector search against staging will not
be meaningful, but nothing else is affected.
"""
import re
import sys

src, dst = sys.argv[1], sys.argv[2]
sql = open(src, encoding="utf-8", errors="ignore").read()

changes = []

# 1. vector(N) column type -> LONGTEXT
sql, n = re.subn(r"\bvector\(\d+\)", "LONGTEXT", sql, flags=re.I)
changes.append(f"vector(N) -> LONGTEXT: {n}")

# 2. Remove VECTOR INDEX definition lines (may be trailing or mid-list)
sql, n = re.subn(r",?\n\s*VECTOR INDEX [^\n]*?\)\)[^\n,]*(?=,?\n)", "", sql, flags=re.I)
changes.append(f"VECTOR INDEX removed: {n}")

# 3. TiDB-specific table options MariaDB rejects
for pat, label in [
    (r"/\*T!\[[^\]]*\][^*]*\*/", "TiDB /*T![..]*/ hints"),
    (r"\s*/\*T!\s*[^*]*\*/", "TiDB /*T! */ hints"),
    (r"\bPRE_SPLIT_REGIONS\s*=\s*\d+", "PRE_SPLIT_REGIONS"),
    (r"\bSHARD_ROW_ID_BITS\s*=\s*\d+", "SHARD_ROW_ID_BITS"),
    (r"\bAUTO_ID_CACHE\s*=\s*\d+", "AUTO_ID_CACHE"),
    (r"\bAUTO_RANDOM_BASE\s*=\s*\d+", "AUTO_RANDOM_BASE"),
]:
    sql, n = re.subn(pat, "", sql, flags=re.I)
    if n:
        changes.append(f"{label}: {n}")

# 4. Constraint names are global in MariaDB but TiDB allows per-table reuse.
#    Make every FK constraint name unique by prefixing it with its table name.
def _uniquify_constraints(match):
    table = match.group(1)
    body = match.group(2)

    def rename(cm):
        return f"CONSTRAINT `{table}_{cm.group(1)}`"

    body = re.sub(r"CONSTRAINT `([^`]+)`", rename, body)
    return f"CREATE TABLE `{table}`{body}"

sql = re.sub(
    r"CREATE TABLE `([^`]+)`(\s*\(.*?\n\)[^;]*;)",
    _uniquify_constraints,
    sql,
    flags=re.S,
)
changes.append("FK constraint names namespaced per table")

# 5. Clean up any dangling comma before a closing paren of a CREATE TABLE
sql = re.sub(r",(\s*\n\s*\))", r"\1", sql)

open(dst, "w", encoding="utf-8").write(sql)
print("\n".join(changes))
print(f"wrote {dst}")
