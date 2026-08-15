# Kajabi Email → Revenue Import Guide

## Purpose

Use this workflow to add **Kajabi-native email engagement** to the Interconnected Email → Revenue dashboard without contaminating the KO/Klaviyo or Shopify measurement path. Each import becomes a `kajabi` snapshot and is labeled **platform-attributed**. It is not direct Shopify-click credit and is never pooled with the KO/Klaviyo A/B path.

## What to collect in Kajabi

For one Interconnected sequence email and the same reporting window selected in the dashboard, copy these values from Kajabi's native email report:

| Dashboard field | Kajabi source | Notes |
|---|---|---|
| Kajabi email ID | The sequence email record ID in its edit URL | Example: `2151341113` for the current Day 0 message. |
| Email name | The displayed Kajabi email title | Use a recognizable, stable name. |
| Recipients | Email-report recipient total | Must be greater than or equal to Delivered. |
| Delivered | Kajabi-delivered total | Native platform metric. |
| Opens | Kajabi-open total | Native platform metric. |
| Clicks | Kajabi-click total | Native platform metric. |
| Kajabi conversions | Kajabi-reported conversion count, if available | Leave at zero if Kajabi does not report it for this email. |
| Kajabi revenue ($) | Kajabi-reported revenue for that email, if available | Enter dollars, not cents. |

## Import steps

1. Open **Content Hub → Email → Revenue**.
2. Select the reporting period. The dashboard uses **completed UTC days**, matching the KO/Klaviyo daily snapshot job.
3. In **Import Kajabi-native email metrics**, enter one email's native report values.
4. Click **Import**. Corrected values for the same Kajabi email and date window safely replace the previous import.
5. Confirm the row appears only in the **Kajabi Path** column. It must not appear in the KO/Klaviyo column.

## Attribution boundaries

> A Kajabi imported engagement row represents Kajabi's platform-reported activity. It does not prove that a visitor clicked a first-party tracked checkout bridge, and it never creates Shopify direct-click revenue.

Kajabi payment revenue is retained as Kajabi-path cohort revenue. Shopify direct-click revenue is retained separately under KO/Klaviyo and requires its first-party click token. Do not combine either number to declare the experiment winner; compare the two path columns only after each one has its own reconciled leads, spend, and revenue.
