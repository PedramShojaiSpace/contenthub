#!/usr/bin/env bash
# Gate 2 / Section 2 — APPROVED DEVIATION
#
# The migration file declares Section 2 as ONE `ALTER TABLE` with 14 ADD COLUMN
# clauses (v24-production-migration.sql lines 225-255). The reviewer approved
# splitting it into 14 separate ADD COLUMN statements. The DDL content is
# byte-identical to what was reviewed; only the statement boundaries change.
# Rationale: a multi-column ALTER that fails partway leaves an ambiguous state,
# whereas 14 statements localise any failure to a named column with the preceding
# ones already verified.
#
# HALTS on the first error. Does NOT continue, does NOT roll back.
set -u

cd /home/ubuntu/chfresh-plan
MYSQL_PWD=$(python3 -c "
import json,urllib.parse as u
d=json.load(open('.project-config.json'))
print(u.urlparse(d['env_vars']['DATABASE_URL']).password)")
export MYSQL_PWD
PH=gateway02.us-east-1.prod.aws.tidbcloud.com
PU='2Xox4WBe4KrUPbP.bb54cdcee2e7'
PDB=iUgsiz76NwfDUVHZHV7CyJ
LOG=docs/deploy/runlogs/section2-execution.txt

m() { timeout 180 mysql --batch --table --host "$PH" --port 4000 --user "$PU" --database "$PDB" "$@"; }

# name|type-clause  — in the file's order, lines 227-255
COLS=(
  "persona_id|INT NULL"
  "analog_data_entry_ids|LONGTEXT CHARACTER SET utf8mb4 NULL"
  "target_length_minutes|INT NULL"
  "source_idea_id|INT NULL"
  "research_job_id|INT NULL"
  "word_count|INT NULL"
  "production_script_id|INT NULL"
  "pattern_composition|LONGTEXT CHARACTER SET utf8mb4 NULL"
  "parent_script_id|INT NULL"
  "variant_label|VARCHAR(120) CHARACTER SET utf8mb4 NULL"
  "variant_of_root_id|INT NULL"
  "generation_params|LONGTEXT CHARACTER SET utf8mb4 NULL"
  "section_history|LONGTEXT CHARACTER SET utf8mb4 NULL"
  "metric_version|VARCHAR(16) CHARACTER SET utf8mb4 NULL"
)

: > "$LOG"
echo "APPROVED DEVIATION: single 14-clause ALTER split into 14 ADD COLUMN statements." | tee -a "$LOG"
echo "DDL content identical to reviewed file; statement boundaries only." | tee -a "$LOG"
echo "Started $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"
echo | tee -a "$LOG"

n=0
for entry in "${COLS[@]}"; do
  n=$((n + 1))
  NAME="${entry%%|*}"
  TYPE="${entry#*|}"
  STMT="ALTER TABLE \`script_factory_outputs\` ADD COLUMN \`${NAME}\` ${TYPE};"
  echo "######## STATEMENT ${n}/14 ########" | tee -a "$LOG"
  echo "$STMT" | tee -a "$LOG"
  ERR=$(m --execute "$STMT" 2>&1)
  RC=$?
  if [ -n "$ERR" ]; then echo "$ERR" | tee -a "$LOG"; fi
  echo "exit=${RC}" | tee -a "$LOG"
  if [ "$RC" -ne 0 ] || printf '%s' "$ERR" | grep -qi "^ERROR"; then
    echo "!!!! HALTING on column ${NAME} (statement ${n}/14). Not continuing. Not rolling back." | tee -a "$LOG"
    exit 1
  fi

  # read back immediately: name, type, nullability, charset
  RB=$(m --execute "
SELECT column_name, column_type, is_nullable, IFNULL(character_set_name,'-') AS charset,
       IFNULL(column_default,'NULL') AS col_default, ordinal_position
FROM information_schema.columns
WHERE table_schema=DATABASE() AND table_name='script_factory_outputs'
  AND column_name='${NAME}';" 2>&1)
  echo "$RB" | tee -a "$LOG"
  if ! printf '%s' "$RB" | grep -q "$NAME"; then
    echo "!!!! HALTING: ${NAME} did not read back from information_schema." | tee -a "$LOG"
    exit 1
  fi
  if ! printf '%s' "$RB" | grep -q "YES"; then
    echo "!!!! HALTING: ${NAME} is NOT nullable. All 14 must be nullable." | tee -a "$LOG"
    exit 1
  fi
  echo | tee -a "$LOG"
done

echo "All 14 ADD COLUMN statements applied and read back." | tee -a "$LOG"
echo "Finished $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"
