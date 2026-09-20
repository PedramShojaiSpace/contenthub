#!/usr/bin/env bash
set -euo pipefail

sleep 90
url='https://content.theurbanmonk.com/interconnected/thank-you-p99-draft?release_verify=6579ed11'
html="$(curl -fsSL --max-time 30 "$url")"

printf 'url=%s\n' "$url"
printf 'pending_markers=%s\n' "$(printf '%s' "$html" | grep -Eio 'checkout mapping pending|draft page — checkout is not active' | wc -l | tr -d ' ')"
printf 'new_checkout_markers=%s\n' "$(printf '%s' "$html" | grep -Eio 'ofRhsQvo|interconnected_p99_offer_end_time_v1' | wc -l | tr -d ' ')"
if printf '%s' "$html" | grep -qi 'checkout mapping pending'; then
  echo 'result=stale_or_incomplete'
  exit 2
fi
if printf '%s' "$html" | grep -qi 'ofRhsQvo'; then
  echo 'result=updated'
  exit 0
fi
printf 'result=unknown_bundle_state\n'
exit 3
