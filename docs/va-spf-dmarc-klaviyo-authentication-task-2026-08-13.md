# VA Morning Task: Fix Urban Monk Email Authentication

**Priority:** Complete before scaling Interconnected email volume.

**Objective:** Remove the duplicate SPF record, publish a monitoring-only DMARC record, and authenticate Klaviyo through a **separate branded sending subdomain**. These are three distinct pieces of work. Do **not** change the Interconnected flow, email copy, links, message status, or Kajabi configuration while doing this task.

## Why This Is Needed

The owner’s live test email passed SPF and DKIM only for Klaviyo’s shared sending domain, while Gmail reported **DMARC fail** for the visible `From: ...@theurbanmonk.com` domain. Public DNS also currently publishes **two** SPF records for `theurbanmonk.com`, which is invalid SPF configuration.

| Check | Current result | Required outcome |
|---|---|---|
| SPF | Two `v=spf1` records published | Exactly one SPF record |
| DKIM | Passes for `shared.klaviyomail.com` | Passes for a Klaviyo-branded Urban Monk sending domain |
| DMARC | No `_dmarc.theurbanmonk.com` record; test header reports fail | Record exists; test header reports `dmarc=pass` after Klaviyo domain verification |

## Architecture: Protect Kajabi, Isolate Klaviyo

Kajabi and Klaviyo can safely share the Urban Monk root domain when they use separate authentication records. The existing root-domain configuration remains for Kajabi and other established senders. Klaviyo should use an unused branded marketing sending subdomain: **`send.theurbanmonk.com`**.

The visible From address can remain `support@theurbanmonk.com`. Klaviyo’s branded sending domain operates in the delivery headers and aligns authentication without changing the existing root-domain sender address. Klaviyo specifically recommends an unused sending subdomain such as `send`, which avoids interference with other root-domain email configurations. [2]

## Part 1 — Consolidate SPF in DNS Without Removing Kajabi

Open the DNS provider for `theurbanmonk.com` and search for **TXT** records at the root host (`@` or blank host field).

### Current conflicting SPF records

```text
v=spf1 include:dc-aa8e722993._spfm.theurbanmonk.com include:23830440.spf57.hubspotemail.net ~all
v=spf1 include:dc-aa8e722993._spfm.theurbanmonk.com ~all
```

### Required final state

There must be **one—and only one—SPF TXT record** beginning `v=spf1`. Keep the established include mechanisms in the first record and delete only its duplicate/subset record. The final root SPF value should be:

```text
v=spf1 include:dc-aa8e722993._spfm.theurbanmonk.com include:23830440.spf57.hubspotemail.net ~all
```

| DNS field | Value |
|---|---|
| Type | TXT |
| Host / Name | `@` (or blank, depending on DNS provider) |
| Value | `v=spf1 include:dc-aa8e722993._spfm.theurbanmonk.com include:23830440.spf57.hubspotemail.net ~all` |
| TTL | Leave provider default, or 1800–3600 seconds |

**Important:** Delete only the duplicate/subset SPF record. Do **not** delete Google site-verification TXT records, Kajabi records, HubSpot records, website records, or any unrelated TXT records. If the DNS administrator believes Kajabi depends on an additional root SPF include not listed above, stop and send a screenshot of the record set for review rather than guessing.

## Part 2 — Add DMARC Monitoring

Create this new DNS TXT record. It is monitoring-only (`p=none`), so it does **not** reject or quarantine mail.

| DNS field | Value |
|---|---|
| Type | TXT |
| Host / Name | `_dmarc` |
| Value | `v=DMARC1; p=none; rua=mailto:support@theurbanmonk.com; adkim=r; aspf=r; pct=100` |
| TTL | Leave provider default, or 1800–3600 seconds |

Do not add a second DMARC record. If a DMARC record already exists when you enter DNS, stop and report its exact value instead of creating another one.

## Part 3 — Authenticate Klaviyo on `send.theurbanmonk.com`

1. In Klaviyo, open **Settings → Email → Domains**.
2. Choose **Add branded sending domain**.
3. Choose **Marketing** as the send type.
4. Use `send` as the sending subdomain, creating `send.theurbanmonk.com`. This is intentionally separate from Kajabi and the root mail domain.
5. Choose **Dynamic** routing if the DNS provider supports NS delegation; otherwise choose **Static** routing. Klaviyo will display account-specific NS or CNAME records plus a verification TXT record.
6. Copy the records **exactly as Klaviyo displays them** into the DNS provider. They are account-specific; do not invent values or overwrite existing Kajabi records.
7. Return to Klaviyo and wait for the domain status to show **Verified**, then activate it for **Marketing**. Do not change the existing root-domain From address.

## Part 4 — Evidence Required Before Marking Complete

Send the following back in one message or screenshot set:

1. Screenshot of the root DNS TXT records showing exactly one SPF record.
2. Screenshot of the `_dmarc` TXT record.
3. Screenshot of Klaviyo **Domains** showing `send.theurbanmonk.com` as **Verified** and active for **Marketing**.
4. A fresh Gmail test email sent from the same Interconnected Day 0 message, with **Show original** copied or screenshotted. The header must show:

```text
spf=pass
dkim=pass
dmarc=pass
```

5. Confirm the test still shows the intended visible sender: **Interconnected Series by The Urban Monk**.

## Do Not Do These Things

- Do not change the live flow, email status, or subject line.
- Do not delete HubSpot, Google verification, website, or unrelated DNS records.
- Do not publish a strict DMARC policy (`p=quarantine` or `p=reject`) at this stage.
- Do not add any second SPF or DMARC record.

## Completion Standard

This task is complete only when the public DNS has one SPF record and one DMARC record, the Klaviyo branded subdomain is verified, and a new Gmail header shows SPF, DKIM, and DMARC all passing. A DMARC record alone is useful monitoring, but it will not make DMARC pass until Klaviyo sends through the verified branded subdomain.

## References

[1] [Google: Email sender guidelines](https://support.google.com/a/answer/81126?hl=en)

[2] [Klaviyo: Set up a branded sending domain](https://help.klaviyo.com/hc/en-us/articles/115000357752)

[3] [Klaviyo: Understanding email authentication](https://help.klaviyo.com/hc/en-us/articles/4402601857307)
