# Defect: 4-byte characters (emoji) cannot be stored if the server charset is utf8mb3 or latin1

**Status:** open, needs a production read to confirm scope
**Found:** 2026-08-03, while seeding the operator's real sales page into a clean sandbox
**Severity:** potential silent data loss on live content columns
**Relationship to the other defect:** direct consequence of the workaround for
`DEFECT-varchar1024-unique-index.md`. Fixing that one likely fixes this one.

## What happened

Seeding the operator's real KBMO sales page failed outright:

```
Error: Conversion from collation utf8mb4_unicode_ci into utf8mb3_general_ci
  impossible for parameter
  code: 'ER_IMPOSSIBLE_STRING_CONVERSION', errno: 3988
```

Cause: the page contains three emoji — 📦 🔬 👨 — each 4 bytes in UTF-8.
`utf8mb3` stores a maximum of 3 bytes per character, so those codepoints are not
merely truncated, they are unrepresentable. MySQL refuses the parameter.

The sandbox server default was `utf8mb3` deliberately, because a `utf8mb4` server
cannot build the schema at all (three `varchar(1024) UNIQUE` columns exceed
InnoDB's 3072-byte key limit — see the other defect doc).

## Why this is a production question, not a sandbox artifact

The DDL in migrations `0041` and `0044` **only executes on a server whose default
charset is at most 3 bytes per character.** Since those migrations demonstrably ran
against production, production's default is `utf8mb3`, `latin1`, or similar — it
cannot be `utf8mb4`.

If that is right, then for the entire life of the deployment:

- any content containing emoji written to a 3-byte column either **failed on
  write** or was **stored corrupted**, depending on the connection charset and
  whether strict mode was on;
- with `sql_mode` strict, the write raises errno 3988 and the row is rejected;
- without it, MySQL may substitute `?` or truncate at the offending character,
  silently losing the remainder of the field.

Content most at risk: anything sourced from social platforms, YouTube titles and
descriptions, LinkedIn posts, newsletter copy, sales pages — all routinely contain
emoji.

## The read-only query to confirm

Same query as the other defect. One statement, touches no data:

```sql
SELECT @@character_set_server, @@collation_server;
```

Then, to find whether corruption already happened, this is also read-only:

```sql
-- Columns that cannot hold emoji at all
SELECT table_name, column_name, data_type, character_set_name
  FROM information_schema.columns
 WHERE table_schema = DATABASE()
   AND character_set_name IS NOT NULL
   AND character_set_name <> 'utf8mb4'
 ORDER BY table_name, ordinal_position;

-- Spot-check for the substitution artefact in a high-risk column
SELECT id, LEFT(content, 120) FROM analog_data_entries
 WHERE content LIKE '%?%' LIMIT 20;
```

## Interpreting the answer

| Result | Meaning |
|---|---|
| `utf8mb4` | Contradicts the migration evidence — investigate how `0041`/`0044` applied. |
| `utf8mb3` | Emoji unstorable in every non-converted column. Also explains why the fresh build needed a charset workaround. |
| `latin1` | Worse: only 1 byte per character, so most non-ASCII (curly quotes, em dashes, accented names) is also at risk, not just emoji. |

## Recommended fix

Fix the index-length defect first (`varchar(1024)` → `varchar(768)` on the three
indexed url columns), then move the server default to `utf8mb4` and convert
existing tables. Doing it in that order means the charset change is unblocked
rather than fought column by column.

## What the sandbox does instead

Sandbox-only, no branch code changed: server default stays `utf8mb3` so the
schema builds, and every string column narrow enough to be safely indexed was
converted to `utf8mb4`:

- 381 TEXT-family columns converted
- all `varchar`/`char` columns of length ≤ 768 converted
- final state: 916 `utf8mb4` string columns; 128 left alone, being 116 ENUMs
  (fixed ASCII tokens, cannot contain emoji) and 12 `varchar` > 768 (exactly the
  set named in the index-length defect)

Verified afterwards: the sales page round-trips **byte-for-byte identical**
(14,834 bytes in, 14,834 bytes out) with all three emoji intact.

Note that `personas.icon` is `varchar(8)`, not TEXT — a TEXT-only conversion pass
missed it and the seed still failed. Any real fix must cover narrow varchars too.

