# Agora Kajabi Price-Test Setup — Runtime Observations

**Status:** Read-only navigation observation; no Kajabi or funnel setting changed.

The owner’s authenticated Kajabi dashboard loaded under the Urban Monk Academy site context. The guessed legacy path `/admin/offers` returned a Kajabi 404, so the current UI’s **Sales → Pricing** navigation must be used to inspect and create the approved draft Offers. This is a navigation finding only: no offer, checkout, price, upgrade, allocation, message, subscriber, campaign, audience, or budget was changed.

## Current offer inventory — read-only check

The current site-specific Pricing workspace is `https://app.kajabi.com/admin/sites/2148432935/offers`. Its visible offer list confirms the existing **Interconnected $67 Bundle OTO** is published and shows one connected product. It also confirms the existing published **Gut Permeability and Food Sensitivity Testing w/ Coach Consultation [OCUS DISCOUNT] New** at **$199** appears as a zero-product offer in the table. The browser inventory does not, by itself, prove post-purchase eligibility/association between the $67 Offer and the $199 Offer; that remains a required deeper inspection.

No $49 or $99 Interconnected price-test Offer was visible in the first page of the current list. The available action is **New Offer**; no new Offer has been started. The global “Activate New Checkouts” control is explicitly out of scope and was not selected.

## $67 control Offer — read-only check

The active control opened at `/admin/offers/2151314475/edit`. Its published internal title is **Interconnected $67 Bundle OTO** and its displayed title is **Interconnected: The Complete Healing Protocol**. It grants access to one product, **Interconnected Series Self Guided**, and its pricing tab confirms a **one-time $67.00 USD** payment. The UI exposed standard card payment provider choices and multiple optional payment methods; detailed selection state was not changed or relied upon.

This confirms the control’s product/access and entry-price baseline. It does not yet establish the relevant $199 post-purchase path. The next read-only check is the control’s **Purchase flow** tab; no field was changed and the Save action was not used.

## $199 OCUS relationship — read-only check

The $67 control’s **Purchase flow** tab confirms a published **Upsell funnel** named **Gut Permeability and Food Sensitivity Testing w/ Coach Consultation [OCUS DISCOUNT] New Upsell** at **$199.00 one-time payment**. The control Offer’s post-purchase action is an existing landing page, **Interconnected Purchased — Redirect**, and its purchaser automation applies the **Interconnected Purchased —** tag.

This directly verifies the $67-to-$199 relationship. It does **not** verify that any future $49/$99 Offers will inherit the same post-purchase landing page, upsell, or automation. Those are required parity checks after each draft Offer is created, before the non-live registry’s OCUS-equivalence flag may be set to true.

## Approved $49 draft-offer workflow

The live control’s action menu could not be inspected because the browser artifact capture failed, so no duplication path was used. The current site-specific **New Offer** workflow is available at `/admin/sites/2148432935/offers?create=true`. It opens a modal that requires an Offer title and selected product(s) before its Next action becomes available.

The approved title **Interconnected $49 Bundle OTO — Price Test P1** has been entered into the unsaved modal only. No product has been selected and no save/create action has occurred; therefore no $49 Offer exists yet and the live $67 control remains unchanged.
