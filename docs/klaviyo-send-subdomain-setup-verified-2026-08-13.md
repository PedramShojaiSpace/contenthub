# Verified Email Authentication Status and Klaviyo `send` Setup

**Verification date:** 2026-08-13  
**DNS provider:** GoDaddy  
**Purpose:** Add a Klaviyo Marketing branded sending domain without changing Kajabi’s existing root-domain email configuration.

## Your First Two GoDaddy Changes Are Correct

Public DNS currently shows the intended root records.

| Record | Public DNS result | Assessment |
|---|---|---|
| Root SPF | `v=spf1 include:dc-aa8e722993._spfm.theurbanmonk.com ~all` | Correct. Exactly one SPF record is present; the obsolete HubSpot include is gone. The remaining include resolves to Google Workspace authorization. |
| Root DMARC | `v=DMARC1; p=none; rua=mailto:dmarc_kjb@kajabi.com; fo=1; pct=100; rf=afrf` | Correct for a safe first stage. `p=none` monitors rather than rejects, and the existing Kajabi report mailbox is preserved. |
| `send.theurbanmonk.com` | No current TXT answer | Expected. Klaviyo has not yet generated or verified this sending subdomain. |

Do **not** edit the root SPF record or `_dmarc` record again as part of the Klaviyo setup. The Klaviyo records below are additive and live on `send` plus one separate site-verification TXT record. They do not replace Kajabi records.

## Exact Klaviyo Setup

1. In Klaviyo, click the company name in the lower-left corner, then choose **Settings → Domains → Add Domain**.
2. Choose **Marketing** as the send type. This is correct for Interconnected campaigns and flows.
3. Confirm the root domain is **`theurbanmonk.com`**.
4. In **Sending domain**, enter exactly **`send`**. Klaviyo will display the full domain as `send.theurbanmonk.com`.
5. Choose **Dynamic** routing if Klaviyo offers it. Dynamic routing is Klaviyo’s recommended option and delegates only the `send` subdomain to Klaviyo. It does not delegate or change the root domain, Kajabi, the website, or other subdomains. [1]
6. Do **not** select Klaviyo’s option to add a DMARC record: a valid root DMARC record already exists.
7. Choose **Set up manually**. Do not allow any tool to overwrite existing root DNS records.
8. Copy the DNS values that Klaviyo generates exactly. Do not use generic examples or values from another account.

## What to Add in GoDaddy

Klaviyo will generate account-specific values. Add the records below exactly as shown in Klaviyo; GoDaddy normally appends `.theurbanmonk.com` automatically when you enter a host name.

| If Klaviyo selected Dynamic | GoDaddy type | GoDaddy host/name | Value |
|---|---|---|---|
| 1 | NS | `send` | First Klaviyo NS value, typically `ns1.klaviyo.com` |
| 2 | NS | `send` | Second Klaviyo NS value, typically `ns2.klaviyo.com` |
| 3 | NS | `send` | Third Klaviyo NS value, typically `ns3.klaviyo.com` |
| 4 | NS | `send` | Fourth Klaviyo NS value, typically `ns4.klaviyo.com` |
| 5 | TXT | `@` | The exact `klaviyo-site-verification=...` value generated in Klaviyo |

If GoDaddy does not allow the four NS records at host `send`, return to Klaviyo and choose **Static** routing. Klaviyo will instead generate a `send` CNAME, two marketing DKIM CNAMEs (`km1` and `km2`, or the next pair shown in your account), and a root verification TXT record. Add those exact Klaviyo-generated values; do not invent selector values. [1]

## Do Not Change

- Do not change the existing root SPF record.
- Do not change or delete the `_dmarc` record or its Kajabi reporting address.
- Do not alter Kajabi domain, DKIM, SPF, or sender settings.
- Do not use `support@send.theurbanmonk.com` as the from address. Continue to use the root-domain address, for example **Interconnected Series by The Urban Monk** / `support@theurbanmonk.com`.
- Do not activate the new domain until Klaviyo reports every generated record as **Verified**.

## Verify, Activate, and Test

After GoDaddy records are saved, return to Klaviyo and select **Verify**. DNS can take time to propagate; Klaviyo notes that it can take up to 48 hours, although GoDaddy changes commonly appear earlier. [1]

When Klaviyo shows **Verified**, do not activate during an active campaign send. Schedule a short quiet window, then activate the Marketing domain. Klaviyo recommends pausing sending during the activation of a first or replacement marketing branded domain, then resuming after a seed test. [1]

Send a test to a Gmail inbox and use **Show original**. The expected result is:

```text
spf=pass
dkim=pass
dmarc=pass
```

The visible From address should remain `support@theurbanmonk.com`; the branded `send` subdomain is used in delivery headers for alignment, not in the visible reply address. [1] [2]

## Final Live Header Verification

An owner-supplied Gmail **Show original** record for a fresh Klaviyo test received on 2026-08-13 confirms the configuration is operating end to end:

| Header check | Verified result |
|---|---|
| Klaviyo sending-domain status | `active` for `send.theurbanmonk.com` / Marketing / Dynamic |
| SPF | `pass` for a return-path under `k3.send.theurbanmonk.com` |
| DKIM | `pass` for `send.theurbanmonk.com` using selector `mtd1` |
| DMARC | `pass` for `header.from=theurbanmonk.com` |
| Visible sender | `Interconnected Series by The Urban Monk <Support@theurbanmonk.com>` |

The header still includes a second successful Klaviyo shared-domain DKIM signature, which is normal. The important aligned result is the successful `send.theurbanmonk.com` DKIM signature together with `dmarc=pass` for the root From domain.

## References

[1] [Klaviyo: How to set up a branded sending domain](https://help.klaviyo.com/hc/en-us/articles/115000357752), updated March 27, 2026.

[2] [Klaviyo: Understanding email authentication](https://help.klaviyo.com/hc/en-us/articles/4402601857307), updated January 17, 2026.
