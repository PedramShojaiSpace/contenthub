#!/usr/bin/env bash
# Part 0.3 — prove the three v2.2 columns are absent by forcing ER_BAD_FIELD_ERROR.
# Read-only: SELECT statements only. Run against staging for ground truth.
set -u
DB="${1:-contenthub_staging}"
export MYSQL_PWD="$(cat /tmp/chpw.txt)"
for q in \
  "SELECT offer_profile FROM analog_data_entries LIMIT 1" \
  "SELECT pattern_composition FROM script_factory_outputs LIMIT 1" \
  "SELECT structure_summary FROM research_jobs LIMIT 1"
do
  echo "\$ $q   [db=$DB]"
  mysql --batch --raw --skip-column-names -h 127.0.0.1 -u chstaging "$DB" -e "$q" 2>&1 | head -3
  echo "   exit=${PIPESTATUS[0]}"
  echo
done
