# Standalone defect: `varchar(1024)` UNIQUE index cannot build on utf8mb4

**Status:** logged, NOT fixed. Deliberately excluded from the sandbox boot task at
the operator's instruction — to be scheduled separately with the repo owner.

**Severity:** blocks any fresh database build on a modern MySQL 8 default
configuration. Does not affect the running production database, which was built
under a narrower server charset.

---

## Symptom

`drizzle-kit push` against a fresh MySQL 8.0.46 database whose server default is
`utf8mb4` / `utf8mb4_0900_ai_ci` fails partway through table creation:

```
errno: 1071,
sqlState: '42000',
sqlMessage: 'Specified key was too long; max key length is 3072 bytes'
sql: 'CREATE TABLE `newsfeed_articles` (
        ...
        `url` varchar(1024) NOT NULL,
        CONSTRAINT `newsfeed_articles_id` PRIMARY KEY(`id`),
        CONSTRAINT `newsfeed_articles_url_unique` UNIQUE(`url`)
      );'
```

Observed table count at failure: 69 of 139 created, then abort.

## Root cause

InnoDB caps a single index key at **3072 bytes**. A `UNIQUE` constraint on a
`varchar(1024)` column under a 4-byte-per-character charset requires:

```
1024 characters x 4 bytes = 4096 bytes  >  3072 byte limit
```

Under a 3-byte charset (`utf8mb3`) the same column needs `1024 x 3 = 3072` bytes
— exactly at the ceiling, which is why the production database built
successfully and has never surfaced this.

**The schema is therefore not portable across server charset configurations.**
It builds only where the server default is at most 3 bytes per character.

## Affected declarations

| Location | Table | Column |
|---|---|---|
| `drizzle/schema.ts:851` | `verified_links` | `url: varchar("url", { length: 1024 }).notNull().unique()` |
| `drizzle/schema.ts:870` | `newsfeed_articles` | `url: varchar("url", { length: 1024 }).notNull().unique()` |

**Only two declarations actually need to change.** A third `varchar(1024)` url
exists at `drizzle/schema.ts:776` on `wp_post_index`, but it is **not indexed**
(no `.unique()`, no index entry), so it is unaffected and must be left alone —
shortening it would truncate stored WordPress URLs for no benefit. Only indexed
columns hit the 3072-byte key limit.

The same DDL is present in the committed migration history and has been since it
was introduced, so this is long-standing rather than recent:

```
drizzle/0041_colorful_meltdown.sql:2:  `url` varchar(1024) NOT NULL,
drizzle/0041_colorful_meltdown.sql:11: CONSTRAINT `verified_links_url_unique` UNIQUE(`url`)
drizzle/0044_redundant_venus.sql:5:    `url` varchar(1024) NOT NULL,
drizzle/0044_redundant_venus.sql:15:   CONSTRAINT `newsfeed_articles_url_unique` UNIQUE(`url`)
```

## Proposed fix

Shorten the indexed `url` columns to `varchar(768)`:

```
768 characters x 4 bytes = 3072 bytes  ==  limit, exactly
```

768 is the standard ceiling for a fully-indexed utf8mb4 varchar and makes the
schema build on any modern MySQL regardless of server charset.

```ts
// drizzle/schema.ts — verified_links
- url: varchar("url", { length: 1024 }).notNull().unique(),
+ url: varchar("url", { length: 768 }).notNull().unique(),

// drizzle/schema.ts — newsfeed_articles
- url: varchar("url", { length: 1024 }).notNull().unique(),
+ url: varchar("url", { length: 768 }).notNull().unique(),
```

### Migration required

This is a column type change on indexed columns, not an additive migration:

```sql
-- Verify no existing row exceeds the new length BEFORE altering.
SELECT COUNT(*) FROM verified_links    WHERE CHAR_LENGTH(url) > 768;
SELECT COUNT(*) FROM newsfeed_articles WHERE CHAR_LENGTH(url) > 768;
-- Both must return 0. If not, those rows must be resolved first —
-- MODIFY would truncate them and a truncated URL is silently wrong data.

ALTER TABLE `verified_links`    MODIFY `url` varchar(768) NOT NULL;
ALTER TABLE `newsfeed_articles` MODIFY `url` varchar(768) NOT NULL;
```

### Pre-flight checks before applying to production

1. Run the two `COUNT(*)` queries above. A non-zero result must be resolved
   before the ALTER, not after.
2. `ALTER TABLE ... MODIFY` on an indexed column rebuilds the index. Size the
   maintenance window against current row counts.
3. Confirm the production server charset first
   (`SELECT @@character_set_server, @@collation_server;` — a read-only variable
   query that touches no table data). If production is `latin1`, the 768 change
   is still correct and still safe, but the urgency is lower because production
   was never at risk; the value is in making fresh builds work.
4. URLs longer than 768 characters are rare but legitimate (tracking parameters).
   If any exist, the alternative is dropping the UNIQUE constraint and enforcing
   uniqueness on a generated hash column instead of the raw URL.

## Workaround currently in use (sandbox only)

The sandbox MySQL server default was set to `utf8mb3` so the existing DDL
executes unmodified:

```
/etc/mysql/mysql.conf.d/zz-sandbox-charset.cnf
[mysqld]
character-set-server = utf8mb3
collation-server = utf8mb3_general_ci
```

With that in place, `drizzle-kit push` created all 139 tables successfully. This
is a sandbox accommodation, not a fix — it makes the sandbox match the
production environment rather than making the schema portable.
