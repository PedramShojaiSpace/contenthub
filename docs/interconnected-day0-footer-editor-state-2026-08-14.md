# Interconnected Day 0 Footer Update — Editor State

The user approved a footer-only live Day 0 correction: add `{{ organization.name }} {{ organization.full_address }}` immediately above the existing unsubscribe handling, without changing the message copy, sender, timing, offer, tracking, or Live status.

## Browser verification

The user signed in to Klaviyo and the flow `/flow/YyFZPu/edit` opened successfully. The visible flow canvas confirmed the relevant live action:

| Field | Verified value |
|---|---|
| Flow | `[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67` |
| Action | `Day 0 opt in EG sp26` |
| Action status | Live |
| UTM indicator | Present |
| Required change | Footer-only organization address above unsubscribe handling |

The browser automation intermittently navigated into an extension context after opening the action pane. The approved edit remains pending until a stable editor pane is available.
