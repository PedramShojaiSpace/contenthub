import { useState } from "react";
import { ExternalLink, Copy, CheckCircle2, FileText, ShieldCheck, Target, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TANTRA_CONTENT_AD_TOTAL, TANTRA_CONTENT_AD_VARIANTS, type TantraContentAd } from "@shared/tantraContentAds";
import { trpc } from "@/lib/trpc";

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied`);
}

function packageText(pageTitle: string, ad: TantraContentAd) {
  return [`${pageTitle} — Creative ${ad.label}`, `Headline: ${ad.headline}`, "", ad.primaryText, "", `Description: ${ad.description}`, `CTA: ${ad.cta}`, `Destination: ${ad.destinationUrl}`].join("\n");
}

export function TantraContentAdWorkspace() {
  const [expanded, setExpanded] = useState<string | null>("considering-divorce");
  const [pushingSlug, setPushingSlug] = useState<string | null>(null);
  const pushVariant = trpc.tantraContentAdPush.createPausedVariantDrafts.useMutation();

  const createPausedDrafts = async (slug: string) => {
    setPushingSlug(slug);
    try {
      const result = await pushVariant.mutateAsync({ slug, optimizationGoal: "LINK_CLICKS", dailyBudgetCents: 200 });
      toast.success("Three paused Meta drafts created", { description: "The $2/day draft ad set remains off until you activate it in Ads Manager." });
      window.open(result.adsManagerUrl, "_blank");
    } catch (error: any) {
      toast.error("Paused draft creation was not completed", { description: String(error?.message ?? error).slice(0, 180) });
    } finally {
      setPushingSlug(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Target className="w-5 h-5 text-primary" />Content-first traffic drafts</h2>
          <p className="mt-1 text-sm text-muted-foreground">Seven low-friction educational destinations with three policy-safe ad variants each. All copy, visuals, destinations, and UTM tags are ready for review before any paid traffic is activated.</p>
        </div>
        <Badge variant="outline" className="w-fit"><FileText className="w-3 h-3 mr-1" />{TANTRA_CONTENT_AD_TOTAL} draft packages</Badge>
      </div>

      <Card className="border-blue-200 bg-blue-50/70">
        <CardContent className="pt-4 text-sm text-blue-950 flex gap-3">
          <ShieldCheck className="w-5 h-5 shrink-0 text-blue-700" />
          <div><strong>Review-first, policy-safe setup.</strong> These cold-traffic packages avoid personal-attribute assertions, health diagnoses, graphic sexual language, and sensitive-audience targeting. The planned first test is broad U.S. adult traffic optimized for landing-page views; quiz registration and purchases remain downstream measurement signals.</div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {TANTRA_CONTENT_AD_VARIANTS.map((variant) => {
          const isOpen = expanded === variant.slug;
          return (
            <Card key={variant.slug} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={variant.imageUrl} alt="" className="w-14 h-[70px] object-cover rounded-md border" />
                    <div className="min-w-0"><CardTitle className="text-base">{variant.title}</CardTitle><p className="text-xs text-muted-foreground mt-1 truncate">{variant.destinationBaseUrl}</p></div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => window.open(variant.destinationBaseUrl, "_blank")}><ExternalLink className="w-3 h-3 mr-1" />Review page</Button>
                    <Button size="sm" disabled={pushingSlug === variant.slug} onClick={() => createPausedDrafts(variant.slug)}>{pushingSlug === variant.slug ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}{pushingSlug === variant.slug ? "Creating…" : "Create 3 paused drafts"}</Button>
                    <Button variant="outline" size="sm" onClick={() => setExpanded(isOpen ? null : variant.slug)}>{isOpen ? "Collapse" : "Review 3 drafts"}</Button>
                  </div>
                </div>
              </CardHeader>
              {isOpen && <CardContent className="grid gap-3 md:grid-cols-3 border-t pt-4">{variant.ads.map((ad) => (
                <div key={ad.id} className="rounded-lg border bg-muted/20 p-4 flex flex-col gap-3">
                  <div className="flex justify-between gap-2"><Badge variant="outline">Creative {ad.label}</Badge><Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Policy review ready</Badge></div>
                  <p className="font-semibold leading-snug">{ad.headline}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-6">{ad.primaryText}</p>
                  <p className="text-xs text-muted-foreground"><strong>Description:</strong> {ad.description}</p>
                  <p className="text-xs text-muted-foreground"><strong>CTA:</strong> Learn More</p>
                  <div className="mt-auto flex gap-2"><Button className="flex-1" variant="outline" size="sm" onClick={() => copy(packageText(variant.pageTitle, ad), "Full ad package")}><Copy className="w-3 h-3 mr-1" />Copy package</Button><Button variant="ghost" size="sm" onClick={() => copy(ad.destinationUrl, "Tracked URL")}>URL</Button></div>
                </div>
              ))}</CardContent>}
            </Card>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-4 text-sm text-muted-foreground"><CheckCircle2 className="inline w-4 h-4 mr-2 text-emerald-600" /><strong className="text-foreground">Controlled push:</strong> each button creates one campaign, one $2/day broad-U.S. ad set, and three ads in <strong>PAUSED</strong> status. The campaign stays off until you activate it in Meta. A Meta App Live-mode error will be shown instead of creating any partial live campaign.</CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/40">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-amber-700" />Measurement and retargeting guardrail</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong className="text-foreground">Event ladder:</strong> PageView → CompleteRegistration (quiz finished) → Lead (email captured) → Purchase. Browser and server events share deduplication IDs after email capture; quiz answers and sensitive wellness details are not sent in Meta event parameters.</p>
          <p><strong className="text-foreground">Retargeting:</strong> start with a single broad Urban Monk education-engagement audience, not a page-specific audience tied to a private health or sexual-wellness concern. Confirm current Meta audience eligibility before creating any URL-based audience.</p>
          <p><strong className="text-foreground">Optimization:</strong> drafts begin on landing-page views, not raw clicks. After enough email-capture volume, duplicate the winning package into a Lead-optimized website-conversion test. Read results in order: content visit → quiz completion → identified lead → paid order.</p>
        </CardContent>
      </Card>
    </div>
  );
}
