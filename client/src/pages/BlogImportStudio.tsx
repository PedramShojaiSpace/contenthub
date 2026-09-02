import { useMemo, useState } from "react";
import { CheckCircle2, CircleHelp, FileImage, FileText, Loader2, Send, ShieldCheck, Sparkles, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type RefinedArticle = {
  title: string;
  slug: string;
  focusKeyword: string;
  metaDescription: string;
  semanticKeywords: string[];
  articleMarkdown: string;
  reviewNotes: string[];
  ctaLabel: string;
  ctaUrl: string;
  titleWasShortened: boolean;
  ctaWasSelected: boolean;
};

type ImageCandidate = { imageUrl: string; altText: string; title: string; reviewOnly: boolean };
type HandoffCheck = { key: string; label: string; expected: string; actual: string | null; state: "passed" | "failed" | "unverified" };
type WordPressHandoffResult = { editLink: string; link: string; status: string; requestedStatus: "draft" | "publish"; published: boolean; verification: { verified: boolean; checks: HandoffCheck[] } };

export default function BlogImportStudio() {
  const [sourceLabel, setSourceLabel] = useState("Imported external article");
  const [sourceTitle, setSourceTitle] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [selectedCtaId, setSelectedCtaId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [article, setArticle] = useState("");
  const [refined, setRefined] = useState<RefinedArticle | null>(null);
  const [contentItemId, setContentItemId] = useState<number | null>(null);
  const [publishLive, setPublishLive] = useState(false);
  const [imageCandidate, setImageCandidate] = useState<ImageCandidate | null>(null);
  const [handoffResult, setHandoffResult] = useState<WordPressHandoffResult | null>(null);

  const { data: ctaBlocks = [], isLoading: ctasLoading } = trpc.cta.list.useQuery();
  const { data: wpCategories = [], isLoading: categoriesLoading } = trpc.blogImport.listWordPressCategories.useQuery();
  const selectedCta = useMemo(
    () => ctaBlocks.find(cta => String(cta.id) === selectedCtaId) ?? null,
    [ctaBlocks, selectedCtaId],
  );
  const selectedCategory = useMemo(
    () => wpCategories.find(category => String(category.id) === selectedCategoryId) ?? null,
    [wpCategories, selectedCategoryId],
  );

  const refine = trpc.blogImport.refine.useMutation({
    onSuccess: data => { setRefined(data); setContentItemId(null); toast.success("Full imported article refined for review."); },
    onError: error => toast.error(error.message),
  });
  const generateImage = trpc.blogImport.generateFeaturedImage.useMutation({
    onSuccess: data => { setImageCandidate(data); toast.success("Article-specific review image generated. It has not been sent to WordPress."); },
    onError: error => toast.error(error.message),
  });
  const saveDraft = trpc.content.create.useMutation({
    onSuccess: item => { setContentItemId(item.id); toast.success("Review draft saved inside the Content Hub."); },
    onError: error => toast.error(error.message),
  });
  const handleWordPressResult = (post: WordPressHandoffResult) => {
    setHandoffResult(post);
    if (!post.verification.verified) {
      toast.error("WordPress saved a draft, but the required handoff verification did not pass. Live publication was blocked.");
      return;
    }
    toast.success(post.published ? `WordPress post published and verified: ${post.link}` : `WordPress draft created and verified: ${post.editLink}`);
  };
  const createWpDraft = trpc.blogImport.createWordPressDraft.useMutation({
    onSuccess: handleWordPressResult,
    onError: error => toast.error(error.message),
  });
  const publishWp = trpc.blogImport.publishWordPressLive.useMutation({
    onSuccess: handleWordPressResult,
    onError: error => toast.error(error.message),
  });
  const createSubstackDraft = trpc.blogImport.createSubstackDraft.useMutation({
    onSuccess: post => toast.success(`Substack draft created. No email was sent. Review it in Substack: ${post.draftUrl}`),
    onError: error => toast.error(error.message),
  });
  const wordCount = useMemo(() => article.trim() ? article.trim().split(/\s+/).length : 0, [article]);
  const busy = refine.isPending || generateImage.isPending || saveDraft.isPending || createWpDraft.isPending || publishWp.isPending || createSubstackDraft.isPending;

  const handleRefine = () => {
    if (article.trim().length < 300) return toast.error("Paste a complete article of at least 300 characters first.");
    if (!selectedCtaId) return toast.error("Choose the approved CTA before refining the article.");
    setImageCandidate(null);
    setContentItemId(null);
    setHandoffResult(null);
    refine.mutate({ sourceLabel, sourceTitle, focusKeyword, selectedCtaId: Number(selectedCtaId), article });
  };

  const handleSave = () => {
    if (!refined) return;
    saveDraft.mutate({
      title: refined.title,
      rawIdea: `Imported from: ${sourceLabel}`,
      platform: "blog",
      status: "review",
      textContent: refined.articleMarkdown,
      imageUrl: imageCandidate?.imageUrl,
      notes: JSON.stringify({
        sourceLabel,
        sourceTitle,
        selectedCtaId: Number(selectedCtaId),
        selectedCtaLabel: refined.ctaLabel,
        selectedCategoryId: Number(selectedCategoryId),
        selectedCategoryName: selectedCategory?.name ?? null,
        reviewNotes: refined.reviewNotes,
        generatedImage: imageCandidate ? { url: imageCandidate.imageUrl, altText: imageCandidate.altText, reviewOnly: true } : null,
        importWorkflow: true,
      }),
      focusKeyword: refined.focusKeyword,
      seoKeywords: JSON.stringify(refined.semanticKeywords),
      ctaBlockLabel: refined.ctaLabel,
      contentGoal: "llm_seo",
    });
  };

  const getWordPressPayload = () => {
    if (!refined || !contentItemId || !imageCandidate || !selectedCategoryId) return null;
    return {
      contentItemId,
      title: refined.title,
      slug: refined.slug,
      focusKeyword: refined.focusKeyword,
      metaDescription: refined.metaDescription,
      articleMarkdown: refined.articleMarkdown,
      categoryId: Number(selectedCategoryId),
      featuredImageUrl: imageCandidate.imageUrl,
      featuredImageAltText: imageCandidate.altText,
    };
  };

  const handleWordPress = () => {
    if (!refined || !contentItemId) return toast.error("Save the review draft before sending anything to WordPress.");
    if (!imageCandidate) return toast.error("Generate and review an article-specific featured image before WordPress handoff.");
    if (!selectedCategoryId) return toast.error("Choose the existing WordPress category before WordPress handoff.");
    if (refined.title.trim().length > 96) return toast.error("The editable SEO title must be 96 characters or fewer before WordPress handoff.");
    const payload = getWordPressPayload();
    if (!payload) return;
    if (!publishLive) return createWpDraft.mutate(payload);
    if (window.confirm(`Publish this reviewed article live to WordPress with “${selectedCategory?.name ?? "the selected category"}” and the reviewed featured image?`)) {
      publishWp.mutate({ ...payload, confirmLivePublish: true });
    }
  };

  const handleSubstack = () => {
    if (!refined || !contentItemId) return toast.error("Save the review draft before creating a Substack draft.");
    if (window.confirm("Create a private Substack draft from this reviewed article? This will not publish it or email subscribers.")) {
      createSubstackDraft.mutate({
        contentItemId,
        title: refined.title,
        metaDescription: refined.metaDescription,
        articleMarkdown: refined.articleMarkdown,
        confirmCreateSubstackDraft: true,
      });
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-7 px-5 py-8 text-slate-900">
      <header className="border-b border-slate-200 pb-6">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700"><Upload className="h-4 w-4" />Content Production</div>
        <h1 className="text-3xl font-semibold tracking-tight">Blog Import Studio</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Import a complete article written elsewhere, select its approved CTA and existing WordPress category, review the Urban Monk voice and SEO edit, then create a WordPress or Substack draft only when you are ready.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5 text-emerald-700" />1. Import the complete article</h2>
          <label className="block text-sm font-medium">Source label<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={sourceLabel} onChange={e => setSourceLabel(e.target.value)} /></label>
          <label className="block text-sm font-medium">Original source title <span className="font-normal text-slate-500">(optional; preserved in review notes)</span><input maxLength={500} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={sourceTitle} onChange={e => setSourceTitle(e.target.value)} /><span className="mt-1 block text-xs font-normal text-slate-500">{sourceTitle.length}/500 characters. The review-ready SEO title is generated separately and limited to 96 characters.</span></label>
          <label className="block text-sm font-medium">Focus keyword <span className="font-normal text-slate-500">(optional)</span><input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={focusKeyword} onChange={e => setFocusKeyword(e.target.value)} placeholder="Example: gut brain axis" /></label>
          <label className="block text-sm font-medium">Approved CTA <span className="text-rose-600">(required)</span><select className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2" value={selectedCtaId} onChange={e => setSelectedCtaId(e.target.value)} disabled={ctasLoading}><option value="">{ctasLoading ? "Loading approved CTAs…" : "Choose the CTA for this article"}</option>{ctaBlocks.filter(cta => cta.active).map(cta => <option key={cta.id} value={cta.id}>{cta.label}</option>)}</select></label>
          {selectedCta && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950"><strong>{selectedCta.label}</strong><p className="mt-1 whitespace-pre-line text-xs leading-5">{selectedCta.ctaText}</p><p className="mt-2 break-all text-xs text-emerald-800">{selectedCta.url}</p></div>}
          <label className="block text-sm font-medium">WordPress category <span className="text-rose-600">(required for WordPress handoff)</span><select className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2" value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} disabled={categoriesLoading}><option value="">{categoriesLoading ? "Loading WordPress categories…" : "Choose the existing category"}</option>{wpCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">The exact selected existing category is assigned only on the WordPress handoff. This tool never creates a category, and Substack drafts do not require a WordPress category.</span></label>
          <label className="block text-sm font-medium">Full article<textarea className="mt-1 min-h-[300px] w-full resize-y rounded-md border border-slate-300 px-3 py-2 font-mono text-xs leading-5" value={article} onChange={e => setArticle(e.target.value)} placeholder="Paste the complete article, including citations and references." /></label>
          <div className="flex justify-between text-xs text-slate-500"><span>{wordCount.toLocaleString()} words</span><span>Sources remain available for review.</span></div>
          <button type="button" disabled={busy || !selectedCtaId} onClick={handleRefine} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{refine.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{refine.isPending ? "Refining full article…" : "Refine with Urban Monk voice + SEO"}</button>
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-emerald-700" />2. Review before handoff</h2>
          {!refined ? <p className="rounded-md bg-slate-50 p-5 text-sm text-slate-600">The editable complete article appears here after refinement. Existing citations are retained, unsupported claims are flagged, and the CTA/category come only from your selected approved records.</p> : <>
            {refined.titleWasShortened && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">The generated title was shortened to the 96-character publishing limit. Your original source title remains preserved in the internal review notes and this SEO title is editable.</p>}
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">SEO title<input maxLength={96} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={refined.title} onChange={e => setRefined({ ...refined, title: e.target.value, titleWasShortened: false })} /><span className="mt-1 block text-xs font-normal text-slate-500">{refined.title.length}/96 characters</span></label><label className="text-sm font-medium">Slug<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={refined.slug} onChange={e => setRefined({ ...refined, slug: e.target.value })} /></label></div>
            <label className="block text-sm font-medium">Focus keyword<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={refined.focusKeyword} onChange={e => setRefined({ ...refined, focusKeyword: e.target.value })} /></label>
            <label className="block text-sm font-medium">Meta description<textarea className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={refined.metaDescription} onChange={e => setRefined({ ...refined, metaDescription: e.target.value })} /></label>
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-950"><strong>Selected CTA: {refined.ctaLabel}</strong><br /><a className="underline" href={refined.ctaUrl} target="_blank" rel="noreferrer">{refined.ctaUrl}</a><br /><strong className="mt-2 inline-block">Selected WordPress category: {selectedCategory?.name ?? "Choose before handoff"}</strong></div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="flex items-center gap-2 text-sm"><FileImage className="h-4 w-4 text-emerald-700" />Featured image candidate</strong><p className="mt-1 max-w-xl text-xs text-slate-600">Creates an article-specific visual from the reviewed title, focus keyword, and opening article context—not a generic wellness image. It remains review-only until an explicit WordPress draft/live handoff.</p></div><button type="button" disabled={busy} onClick={() => generateImage.mutate({ title: refined.title, focusKeyword: refined.focusKeyword, articleExcerpt: refined.articleMarkdown.slice(0, 1200) })} className="inline-flex items-center gap-2 rounded-md border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">{generateImage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileImage className="h-4 w-4" />}{generateImage.isPending ? "Generating…" : "Generate article-specific image"}</button></div>{imageCandidate && <div className="mt-4 space-y-3"><img src={imageCandidate.imageUrl} alt={imageCandidate.altText} className="h-52 w-full rounded-md border border-slate-200 object-cover" /><label className="block text-sm font-medium">Suggested alt text<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={imageCandidate.altText} onChange={e => setImageCandidate({ ...imageCandidate, altText: e.target.value })} /></label><p className="text-xs text-amber-800">This exact reviewed image is uploaded and assigned only if you create a WordPress draft or explicitly confirm live publication.</p></div>}</div>
            {refined.reviewNotes.length > 0 && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Editorial review notes</strong><ul className="mt-1 list-disc pl-5">{refined.reviewNotes.map(note => <li key={note}>{note}</li>)}</ul></div>}
            <label className="block text-sm font-medium">Complete editable article<textarea className="mt-1 min-h-[420px] w-full resize-y rounded-md border border-slate-300 px-3 py-2 font-mono text-xs leading-5" value={refined.articleMarkdown} onChange={e => setRefined({ ...refined, articleMarkdown: e.target.value })} /></label>
            <button type="button" disabled={busy || contentItemId !== null} onClick={handleSave} className="rounded-md border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50">{contentItemId ? "Internal review draft saved" : "Save review draft"}</button>
            <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-md border border-slate-200 p-3"><strong className="text-sm">WordPress handoff</strong><label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={publishLive} onChange={e => setPublishLive(e.target.checked)} />I completed final review and intend to publish live</label><button type="button" disabled={busy || contentItemId === null || !imageCandidate || !selectedCategoryId} onClick={handleWordPress} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" />{publishLive ? "Verify draft, then publish live" : "Create and verify WordPress draft"}</button><p className="mt-2 text-xs text-slate-500">Every handoff creates and verifies a WordPress draft first. Live publication occurs only after all title, status, SEO, category, image, and canonical checks pass.</p></div><div className="rounded-md border border-indigo-200 bg-indigo-50 p-3"><strong className="text-sm text-indigo-950">Substack handoff</strong><p className="mt-2 text-xs leading-5 text-indigo-900">Creates a private Substack draft from this reviewed article. It does not publish, email subscribers, or auto-share.</p><button type="button" disabled={busy || contentItemId === null} onClick={handleSubstack} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-indigo-700 px-4 py-2.5 font-semibold text-indigo-800 disabled:opacity-50"><Send className="h-4 w-4" />Create Substack draft for review</button></div></div>
            {handoffResult && <div className={`rounded-md border p-4 ${handoffResult.verification.verified ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}><div className="flex items-start justify-between gap-3"><div><strong className="flex items-center gap-2 text-sm">{handoffResult.verification.verified ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <XCircle className="h-4 w-4 text-rose-700" />}{handoffResult.verification.verified ? handoffResult.published ? "WordPress publication verified" : "WordPress draft verified" : "WordPress handoff needs review"}</strong><p className="mt-1 text-xs text-slate-700">{handoffResult.verification.verified ? "All required fields passed the post-write verification." : "The draft was retained for review and live publication was blocked. Check the failed or unavailable fields below before continuing."}</p></div><a href={handoffResult.editLink} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold underline">Open WordPress</a></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{handoffResult.verification.checks.map(check => <div key={check.key} className="flex items-start gap-2 text-xs"><span className="mt-0.5">{check.state === "passed" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" /> : check.state === "failed" ? <XCircle className="h-3.5 w-3.5 text-rose-700" /> : <CircleHelp className="h-3.5 w-3.5 text-amber-700" />}</span><span><strong>{check.label}</strong><br /><span className="text-slate-600">Expected: {check.expected} · Actual: {check.actual ?? "unavailable"}</span></span></div>)}</div></div>}
          </>}
        </div>
      </section>
    </main>
  );
}
