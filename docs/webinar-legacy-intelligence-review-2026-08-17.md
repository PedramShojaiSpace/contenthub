# Legacy Webinar Intelligence Review

This was a read-only review of the remaining imports where `extractedAt` is null. No webinar session, raw response, or intelligence field was changed.

| Attached session | Unextracted imports | Declared responses per import | Raw payload size | Raw-payload fingerprint result |
|---|---:|---:|---:|---|
| Session `1` | 2 | 49 | 84,416 characters | The two payloads are distinct. |
| Session `30002` | 1 | 49 | 84,416 characters | The payload is distinct from both session-1 imports. |

Session `1` already renders 584 responses from six extracted imports in Webinar Studio. Extracting either remaining import could add separate legacy evidence to that existing session. Session `30002` currently renders the intended zero-response state because its only 49-response post-webinar import remains unextracted.

> **Recommendation:** Do not bulk extract these records. They are similar in size and declared response count but have different content fingerprints, so they require a human data-quality review of their raw-response provenance before any extraction can write derived themes, questions, language, and timestamps.

The safe next step is an approval-gated, record-by-record review that confirms whether each import is a distinct survey cohort, a duplicate export with formatting differences, or a record attached to the wrong session. Only then should the selected record be extracted.
