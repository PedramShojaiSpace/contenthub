# Email Authentication Remediation — The Urban Monk

## Purpose

This instruction repairs sender authentication for `support@theurbanmonk.com` and related domain mail. It is separate from Gmail’s Promotions categorization, but it reduces the risk of Spam placement, authentication errors, and sender-reputation harm.

## Verified Current Issue

Public DNS shows more than one TXT record at the root domain that begins with `v=spf1`. SPF permits exactly **one** SPF policy record at a domain. The visible policies include:

```text
v=spf1 include:dc-aa8e722993._spfm.theurbanmonk.com ~all
v=spf1 include:dc-aa8e722993._spfm.theurbanmonk.com include:23830440.spf57.hubspotemail.net ~all
```

The public lookup also did not return a DMARC record at `_dmarc.theurbanmonk.com`.

> **Do not paste a replacement SPF record until the person managing all email systems confirms every legitimate sender.** Removing an unrecognized include can interrupt delivery from a still-active system.

## Cloudflare / DNS Administrator Steps

| Step | Action | Safe target state |
|---:|---|---|
| 1 | Inventory every system that sends email using `@theurbanmonk.com` (Klaviyo, HubSpot, Google Workspace, Kajabi, support desk, etc.). | One confirmed list of legitimate sending services. |
| 2 | Retain exactly one root-domain SPF TXT record. | One record beginning `v=spf1`. |
| 3 | If the only active senders are the two policies shown above, retain the combined record and remove the shorter duplicate: | `v=spf1 include:dc-aa8e722993._spfm.theurbanmonk.com include:23830440.spf57.hubspotemail.net ~all` |
| 4 | Confirm the Klaviyo branded sending domain remains authenticated in Klaviyo. | Klaviyo shows the branded domain as authenticated. |
| 5 | Add a monitoring-only DMARC record. Create a dedicated mailbox first if `dmarc-reports@theurbanmonk.com` does not exist. | Host/name: `_dmarc`; type: TXT; value below. |

### Initial DMARC Record

```text
v=DMARC1; p=none; rua=mailto:dmarc-reports@theurbanmonk.com; adkim=r; aspf=r; pct=100
```

`p=none` only collects reports; it does not reject or quarantine mail. Review reports for 2–4 weeks before considering a stricter policy. Do not move to `quarantine` or `reject` without checking all legitimate senders first.

## Verification After DNS Propagation

Send the new **draft-only** Day 0 confirmation to three controlled Gmail accounts. On each received email, select **Show original** and verify:

| Check | Expected result |
|---|---|
| SPF | `PASS` |
| DKIM | `PASS` with a domain aligned to `theurbanmonk.com` or its branded sending domain |
| DMARC | `PASS` after the record propagates |
| Category | Record Primary/Promotions/Spam, but do not treat Promotions by itself as a failure |
| Gmail placement | Inbox and no warning banner; Spam is a failure requiring investigation |

Record the result separately for the plain Day 0 confirmation and the later $67 promotional email. This distinguishes authentication problems from normal marketing categorization.

## Live-Email Gate

The new Klaviyo item is a template-only draft named `[DRAFT] Interconnected Day 0 — Plain Confirmation Deliverability Test`. It does not send and is not connected to the live flow. Keep the current Day 0 email live until the sender-authentication verification and controlled seed test are complete, then explicitly approve a live replacement.
