# Upstream $99 OCU — Director’s Cut Entitlement and Fulfillment Map

**Status:** The Director’s Cut access path is already technically included in the live $99 OCU. No additional Kajabi product should be attached solely for this benefit.

## Verified current setup

The active $99 one-click upsell is **Upstream: The Complete Microbiome Solution** (Kajabi offer `2151104453`). It is published and currently attaches the following three Kajabi courses:

| Included course | What the buyer receives | Director’s Cut relevance |
|---|---|---|
| **Upstream: The Complete Microbiome Solution** | The core Upstream program. | Core upgraded course access. |
| **Interconnected Series Full** | The fuller Interconnected product, separate from the $67/$99 self-guided product. | **Contains the published Director’s Cut module.** |
| **Gut Check Series** | The attached Gut Check course product. | Separate included product. |

The Director’s Cut is **not** a separate Kajabi course/product. It is a **published module within _Interconnected Series Full_** (course `2148687267`). Because that full course is already attached to the $99 OCU, a successful OCU buyer is granted the course entitlement that exposes the Director’s Cut in their library.

> **Conclusion:** Do not create or attach a second “Director’s Cut” product. That would be unnecessary and could confuse access management. The correct promise is: **“Includes the Director’s Cut of Interconnected inside Interconnected Series Full.”**

## What Kajabi already fulfills automatically

A buyer who accepts the $99 OCU receives access to all three courses immediately through the offer-to-product relationship. The OCU’s current post-purchase setting sends the buyer to the **Member’s Product Library**, and the default Kajabi post-purchase email is selected.

The existing offer automations also unsubscribe an OCU buyer from the referenced Interconnected free-screening email sequence and subscribe the person to the existing Upstream welcome/Kajabi sequences. This is the correct broad direction: payment establishes access, while onboarding directs the buyer to use that access.

## What must be surfaced to the buyer

The access exists, but the buyer must be told where to find it. The clean delivery message should make three elements explicit:

1. **Course access:** “Your Upstream course is ready in your library.”
2. **Bonus access:** “Your upgrade also includes _Interconnected Series Full_, including the Director’s Cut.”
3. **Next click:** “Open your library, then choose _Interconnected Series Full_ to find the Director’s Cut module.”

### Recommended checkout/upsell benefit line

> **Bonus with your upgrade:** Get access to the full Interconnected experience, including the exclusive **Director’s Cut** inside _Interconnected Series Full_.

### Recommended post-purchase email copy

**Subject:** Your Upstream upgrade is ready

**Preview:** Your course, the full Interconnected experience, and the Director’s Cut are waiting in your library.

**Body:**

> Your Upstream upgrade is ready in your Urban Monk Academy library.
>
> You now have access to:
>
> - **Upstream: The Complete Microbiome Solution**
> - **Interconnected Series Full**, including the exclusive **Director’s Cut**
> - **Gut Check Series**
>
> Start in your library. When you are ready for the bonus material, open **Interconnected Series Full** and select the **Director’s Cut** module.
>
> **[Open my library]** → `https://theacademy.theurbanmonk.com/library`
>
> To your health,  
> Dr. Pedram Shojai

## Fulfillment standard for future bundled course assets

Any new included item should be set up as one of two classes before it is promised in a checkout, upsell, or email:

| Asset class | Correct Kajabi fulfillment | Required pre-publish check |
|---|---|---|
| **New full course** | Add that course to the offer’s **Products in this Offer** list. | Confirm the course is published, appears in an entitled buyer’s library, and is named in the post-purchase guidance. |
| **New module/lesson inside an included course** | Publish the module/lesson inside a course already attached to the offer. Do **not** add a second product. | Confirm the parent course is attached to the offer; then confirm the module/lesson is published and visible to an entitled buyer. |
| **Download/PDF/worksheet inside a lesson** | Attach it to a published lesson inside an attached course. | Confirm the file opens for an entitled buyer and is named accurately in the delivery email. |
| **Live service, call, or physical item** | Use a separate fulfillment automation/operational handoff. A course entitlement alone is not sufficient. | Confirm the owner/team notification, scheduling or shipment path, and customer confirmation message before the offer is promoted. |

## Required quality-control gate before promoting the bonus

Before the Director’s Cut is highlighted in the OCU creative or a buyer email, complete one controlled, non-production review with an entitled internal account:

- Confirm the $99 OCU still attaches **Interconnected Series Full**.
- Confirm the **Director’s Cut** module and its intended lesson(s) are published and open within that course.
- Confirm an OCU buyer’s library contains **Upstream**, **Interconnected Series Full**, and **Gut Check Series**.
- Confirm the post-purchase page and email tell the buyer how to find the bonus.
- Confirm the existing automation does not enroll the same buyer twice into the Upstream welcome/onboarding sequence.

## Existing automation cleanup to review before scaling

The OCU currently shows both **Offer purchased** and **Offer granted** entries that subscribe buyers to the Upstream welcome and Kajabi email sequences. Since a normal purchase produces a grant, the two trigger types may overlap. Kajabi may deduplicate them, but that should not be assumed.

Do not change the automations during the Director’s Cut update without a controlled test. Before increasing OCU traffic, designate one canonical enrollment trigger per buyer sequence, document the duplicate-prevention rule, and send one internal review purchase through the completed path. The separate staged Kajabi-to-Klaviyo buyer-event adapter remains disabled and should remain disabled until separately approved.

## Source references

- Kajabi offer `2151104453`: **Upstream: The Complete Microbiome Solution**, $99, published; current included courses verified in the offer editor.
- Kajabi course `2148687267`: **Interconnected Series Full**; Director’s Cut verified as a published module.
- [Kajabi: Connect additional Products to an Offer](https://help.kajabi.com/articles/sales/offers/how-to-connect-additional-products-to-your-offer)
- [Kajabi: Create an Offer](https://help.kajabi.com/articles/sales/offers/create-an-offer)
- [Kajabi: Courses overview](https://help.kajabi.com/articles/products/courses/courses-overview)
