import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Loader2,
  Plus,
  ExternalLink,
  Copy,
  RefreshCw,
  Globe,
  FileText,
  Zap,
  Eye,
  Trash2,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  published: "bg-green-500/20 text-green-400 border-green-500/30",
  archived: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const BRIDGE_BASE = "https://ch.theurbanmonk.com/bridge";
const SHOPIFY_PAGES_BASE = "https://theurbanmonkstore.myshopify.com/pages";

type DeploymentMode = "shopify" | "bridge";

export default function AdvertorialBuilder() {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showShopifyExport, setShowShopifyExport] = useState(false);
  const [htmlCopied, setHtmlCopied] = useState(false);

  // Form state
  const [topic, setTopic] = useState("gut_health");
  const [slug, setSlug] = useState("");
  const [customAngle, setCustomAngle] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [deploymentMode, setDeploymentMode] = useState<DeploymentMode>("shopify");
  const [selectedProduct, setSelectedProduct] = useState("");

  const utils = trpc.useUtils();
  const [, navigate] = useLocation();

  const { data: pages, isLoading: pagesLoading } = trpc.advertorial.list.useQuery();
  const { data: topics } = trpc.advertorial.getTopics.useQuery();
  const { data: products } = trpc.advertorial.getProducts.useQuery();
  const { data: selectedPage, isLoading: pageLoading } = trpc.advertorial.get.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId }
  );
  const { data: shopifyExport, isLoading: shopifyLoading } = trpc.advertorial.getShopifyHtml.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId && showShopifyExport }
  );

  const generateMutation = trpc.advertorial.generate.useMutation({
    onSuccess: (page) => {
      toast.success("Advertorial generated! Review and publish when ready.");
      utils.advertorial.list.invalidate();
      if (page) setSelectedId(page.id);
      setShowForm(false);
      setSlug(""); setCustomAngle(""); setTargetAudience(""); setCtaUrl(""); setCtaText(""); setSelectedProduct("");
    },
    onError: (err) => toast.error(err.message),
  });

  const setStatusMutation = trpc.advertorial.setStatus.useMutation({
    onSuccess: (page) => {
      toast.success(page?.status === "published" ? "Page is now live!" : "Status updated.");
      utils.advertorial.list.invalidate();
      if (page) utils.advertorial.get.invalidate({ id: page.id });
    },
    onError: (err) => toast.error(err.message),
  });

  const regenerateMutation = trpc.advertorial.regenerate.useMutation({
    onSuccess: () => {
      toast.success("Copy regenerated with fresh AI.");
      if (selectedId) utils.advertorial.get.invalidate({ id: selectedId });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.advertorial.delete.useMutation({
    onSuccess: () => {
      toast.success("Page deleted.");
      utils.advertorial.list.invalidate();
      setSelectedId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleTopicChange = (t: string) => {
    setTopic(t);
    const config = topics?.find((x) => x.key === t);
    if (config) {
      setCtaUrl(config.defaultCtaUrl);
      setCtaText(config.defaultCtaText);
      setSelectedProduct(config.defaultShopifyProduct || "");
    }
  };

  const handleGenerate = () => {
    if (!slug) { toast.error("URL slug is required"); return; }
    if (!/^[a-z0-9-]+$/.test(slug)) { toast.error("Slug must be lowercase letters, numbers, and hyphens only"); return; }
    generateMutation.mutate({
      topic,
      slug,
      deploymentMode,
      shopifyProductHandle: deploymentMode === "shopify" ? (selectedProduct || undefined) : undefined,
      customAngle: customAngle || undefined,
      targetAudience: targetAudience || undefined,
      ctaUrl: deploymentMode === "bridge" ? (ctaUrl || undefined) : undefined,
      ctaText: ctaText || undefined,
    });
  };

  const copyUrl = (s: string, mode: string) => {
    const url = mode === "shopify" ? `${SHOPIFY_PAGES_BASE}/${s}` : `${BRIDGE_BASE}/${s}`;
    navigator.clipboard.writeText(url);
    toast.success("URL copied!");
  };

  const handleCopyHtml = () => {
    if (shopifyExport?.html) {
      navigator.clipboard.writeText(shopifyExport.html);
      setHtmlCopied(true);
      toast.success("HTML copied to clipboard!");
      setTimeout(() => setHtmlCopied(false), 3000);
    }
  };

  const getTopicProducts = () => {
    if (!topic || !products) return products || [];
    return products.filter((p) => p.topic.includes(topic));
  };

  const isShopifyPage = (ctaUrl?: string | null) => ctaUrl?.includes("/cart/") || ctaUrl?.includes("myshopify.com");
  const selectedTopic = topics?.find((t) => t.key === topic);

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-100">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0d1117]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Advertorial Builder</h1>
            <p className="text-sm text-gray-400 mt-0.5">AI-generated native advertorials → Shopify checkout (zero domain hop)</p>
          </div>
          <Button onClick={() => { setShowForm(!showForm); setSelectedId(null); }} className="bg-[#00d4ff] hover:bg-[#00b8e0] text-black font-semibold">
            <Plus className="w-4 h-4 mr-2" />New Advertorial
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Anatomy explainer */}
        <div className="mb-8 p-5 rounded-xl border border-[#00d4ff]/20 bg-[#00d4ff]/5">
          <h2 className="text-xs font-semibold text-[#00d4ff] uppercase tracking-wider mb-3">Anatomy of a High-Converting Advertorial</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { num: "01", title: "Skeptic-Destroying Headline", desc: "Specific, benefit-driven — speaks to the reader's biggest pain and curiosity" },
              { num: "02", title: "Invisible Mechanism Angle", desc: "A metaphor that explains the hidden root cause — sparks curiosity and emotional resonance" },
              { num: "03", title: "3-Minute Deep Engagement", desc: "Reads like editorial journalism — the '3 min read' cue maximizes completion rates" },
              { num: "04", title: "Direct Shopify Cart CTA", desc: "CTA goes directly to Shopify cart — zero domain hop, full Meta Pixel attribution" },
            ].map((item) => (
              <div key={item.num} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded bg-[#00d4ff]/20 text-[#00d4ff] text-xs font-bold flex items-center justify-center">{item.num}</div>
                <div>
                  <div className="text-xs font-semibold text-white">{item.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* New Advertorial Form */}
        {showForm && (
          <div className="mb-8 p-6 rounded-xl border border-white/10 bg-[#161b22]">
            <h2 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#00d4ff]" />Generate New Advertorial
            </h2>

            {/* Deployment Mode */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-400 mb-2">Deployment Mode *</label>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  onClick={() => setDeploymentMode("shopify")}
                  className={`p-3 rounded-lg border text-left transition-all ${deploymentMode === "shopify" ? "bg-[#00d4ff]/10 border-[#00d4ff]/50" : "bg-white/5 border-white/10 hover:bg-white/8"}`}
                >
                  <ShoppingCart className={`w-4 h-4 mb-1 ${deploymentMode === "shopify" ? "text-[#00d4ff]" : "text-gray-400"}`} />
                  <div className="text-xs font-semibold text-white">Shopify Native</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Page lives on your Shopify store. CTA = direct cart add. Zero hop.</div>
                </button>
                <button
                  onClick={() => setDeploymentMode("bridge")}
                  className={`p-3 rounded-lg border text-left transition-all ${deploymentMode === "bridge" ? "bg-[#00d4ff]/10 border-[#00d4ff]/50" : "bg-white/5 border-white/10 hover:bg-white/8"}`}
                >
                  <Globe className={`w-4 h-4 mb-1 ${deploymentMode === "bridge" ? "text-[#00d4ff]" : "text-gray-400"}`} />
                  <div className="text-xs font-semibold text-white">Bridge Page</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Hosted externally. CTA links to any URL (assessment, offer page, etc.)</div>
                </button>
              </div>
              {deploymentMode === "shopify" && (
                <div className="mt-2 flex items-start gap-2 p-2 rounded bg-green-500/10 border border-green-500/20 max-w-md">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-green-400">Recommended for supplement ads. Shopify handles checkout — Meta Pixel fires AddToCart on click with no redirect.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Topic */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Topic *</label>

                {/* Flagship entry points */}
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-[#00d4ff] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] inline-block"></span>
                    Primary Funnels
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {topics?.filter(t => ["lights_on", "orobiome", "kbmo_fit22"].includes(t.key)).map((t) => (
                      <button key={t.key} onClick={() => handleTopicChange(t.key)}
                        className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all text-left flex items-center justify-between ${
                          topic === t.key
                            ? "bg-[#00d4ff]/20 border-[#00d4ff]/50 text-[#00d4ff]"
                            : "bg-[#00d4ff]/5 border-[#00d4ff]/20 text-gray-200 hover:bg-[#00d4ff]/10"
                        }`}>
                        <span>{t.label}</span>
                        <span className="text-[10px] font-normal text-gray-400">
                          {t.key === "lights_on" ? "$369" : "$399"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Supplement topics */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block"></span>
                    Supplement Topics
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {topics?.filter(t => !["lights_on", "orobiome", "kbmo_fit22"].includes(t.key)).map((t) => (
                      <button key={t.key} onClick={() => handleTopicChange(t.key)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left ${topic === t.key ? "bg-[#00d4ff]/20 border-[#00d4ff]/50 text-[#00d4ff]" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Product (Shopify mode) */}
              {deploymentMode === "shopify" && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Supplement Product <span className="text-gray-500">(CTA will add this to cart)</span>
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {getTopicProducts().map((p) => (
                      <button key={p.handle} onClick={() => setSelectedProduct(p.handle)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${selectedProduct === p.handle ? "bg-[#00d4ff]/20 border-[#00d4ff]/50 text-[#00d4ff]" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"}`}>
                        <span className="font-medium">{p.title}</span>
                        <span className="text-gray-500 ml-2">${p.price}</span>
                      </button>
                    ))}
                    {getTopicProducts().length === 0 && (
                      <p className="text-xs text-gray-500 px-1">No products mapped to this topic. Default will be used.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Slug */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  {deploymentMode === "shopify" ? "Shopify Page Slug *" : "Bridge Page Slug *"}
                  <span className="text-gray-500 ml-1">
                    ({deploymentMode === "shopify" ? "theurbanmonkstore.myshopify.com/pages/___" : "ch.theurbanmonk.com/bridge/___"})
                  </span>
                </label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="gut-inflammation-fatigue" className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
                {slug && (
                  <p className="text-xs text-gray-500 mt-1">
                    → {deploymentMode === "shopify" ? `${SHOPIFY_PAGES_BASE}/${slug}` : `${BRIDGE_BASE}/${slug}`}
                  </p>
                )}
              </div>

              {/* Custom angle */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Custom Mechanism Angle <span className="text-gray-500">(optional)</span></label>
                <Input value={customAngle} onChange={(e) => setCustomAngle(e.target.value)}
                  placeholder="e.g. leaky gut triggers brain fog via vagus nerve"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>

              {/* Target audience */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Target Audience <span className="text-gray-500">(optional)</span></label>
                <Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. busy professionals 40-60 with chronic fatigue"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>

              {/* CTA URL (bridge mode only) */}
              {deploymentMode === "bridge" && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">CTA Destination URL</label>
                  <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder={selectedTopic?.defaultCtaUrl || "https://theacademy.theurbanmonk.com/..."}
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
                </div>
              )}

              {/* CTA Text */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">CTA Button Text <span className="text-gray-500">(optional)</span></label>
                <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)}
                  placeholder={selectedTopic?.defaultCtaText || "Add to Cart →"}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <Button onClick={handleGenerate} disabled={generateMutation.isPending || !slug || !topic}
                className="bg-[#00d4ff] hover:bg-[#00b8e0] text-black font-semibold">
                {generateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating (30-60s)...</> : <><Zap className="w-4 h-4 mr-2" />Generate Advertorial</>}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} className="border-white/20 text-gray-300">Cancel</Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Pages list */}
          <div className="lg:col-span-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your Advertorials ({pages?.length ?? 0})</h2>
            {pagesLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
            ) : pages?.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                <FileText className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No advertorials yet</p>
                <p className="text-xs text-gray-600 mt-1">Click "New Advertorial" to generate your first one</p>
              </div>
            ) : (
              <div className="space-y-2">
                  {pages?.map((page) => {
                    const isFlagship = ["lights_on", "orobiome", "kbmo_fit22"].includes(page.topic || "");
                    const flagshipPrice = page.topic === "lights_on" ? "$369" : page.topic === "orobiome" || page.topic === "kbmo_fit22" ? "$399" : null;
                    return (
                    <div key={page.id} onClick={() => { setSelectedId(page.id); setShowShopifyExport(false); }}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedId === page.id
                          ? "border-[#00d4ff]/50 bg-[#00d4ff]/5"
                          : isFlagship
                          ? "border-[#00d4ff]/20 bg-[#00d4ff]/3 hover:border-[#00d4ff]/40"
                          : "border-white/10 bg-[#161b22] hover:border-white/20"
                      }`}>
                      <div className="flex items-center gap-2 mb-1">
                        {isFlagship ? (
                          <span className="text-[10px] text-[#00d4ff] bg-[#00d4ff]/10 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                            ★ {flagshipPrice}
                          </span>
                        ) : isShopifyPage(page.ctaUrl) ? (
                          <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <ShoppingCart className="w-2.5 h-2.5" />Shopify
                          </span>
                        ) : (
                          <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" />Bridge
                          </span>
                        )}
                        <span className="text-xs font-mono text-gray-500 truncate">/{page.slug}</span>
                      </div>
                      <div className="text-sm font-medium text-white mt-1 line-clamp-2">{page.headline || "(No headline yet)"}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[page.status || "draft"]}`}>{page.status || "draft"}</span>
                        <span className="text-xs text-gray-500 capitalize">{page.topic?.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Page detail */}
          <div className="lg:col-span-3">
            {!selectedId ? (
              <div className="flex items-center justify-center h-64 border border-dashed border-white/10 rounded-xl">
                <div className="text-center">
                  <Eye className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Select an advertorial to preview</p>
                </div>
              </div>
            ) : pageLoading ? (
              <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
            ) : selectedPage ? (
              <div className="rounded-xl border border-white/10 bg-[#161b22] overflow-hidden">
                {/* Actions bar */}
                <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2 flex-wrap">
                  {isShopifyPage(selectedPage.ctaUrl) ? (
                    <a href={`${SHOPIFY_PAGES_BASE}/${selectedPage.slug}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="border-white/20 text-gray-300 text-xs">
                        <ExternalLink className="w-3 h-3 mr-1.5" />Preview on Shopify
                      </Button>
                    </a>
                  ) : (
                    <a href={`${BRIDGE_BASE}/${selectedPage.slug}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="border-white/20 text-gray-300 text-xs">
                        <ExternalLink className="w-3 h-3 mr-1.5" />Preview Bridge
                      </Button>
                    </a>
                  )}
                  <Button size="sm" variant="outline" className="border-white/20 text-gray-300 text-xs"
                    onClick={() => copyUrl(selectedPage.slug, isShopifyPage(selectedPage.ctaUrl) ? "shopify" : "bridge")}>
                    <Copy className="w-3 h-3 mr-1.5" />Copy URL
                  </Button>
                  <Button size="sm" variant="outline" className="border-white/20 text-gray-300 text-xs"
                    onClick={() => regenerateMutation.mutate({ id: selectedPage.id })} disabled={regenerateMutation.isPending}>
                    {regenerateMutation.isPending ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1.5" />}
                    Regenerate
                  </Button>
                  <div className="ml-auto flex items-center gap-2">
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                      onClick={() => navigate(`/meta-ads/${selectedPage.id}`)}>
                      <Sparkles className="w-3 h-3 mr-1.5" />Meta Ads
                    </Button>
                    {selectedPage.status !== "published" ? (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={() => setStatusMutation.mutate({ id: selectedPage.id, status: "published" })} disabled={setStatusMutation.isPending}>
                        <Globe className="w-3 h-3 mr-1.5" />Publish
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="border-yellow-500/30 text-yellow-400 text-xs"
                        onClick={() => setStatusMutation.mutate({ id: selectedPage.id, status: "draft" })} disabled={setStatusMutation.isPending}>
                        Unpublish
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 text-xs"
                      onClick={() => { if (confirm("Delete this advertorial?")) deleteMutation.mutate({ id: selectedPage.id }); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4 max-h-[700px] overflow-y-auto">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[selectedPage.status || "draft"]}`}>{selectedPage.status || "draft"}</span>
                    {isShopifyPage(selectedPage.ctaUrl) ? (
                      <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" />Shopify Native
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-gray-500">{BRIDGE_BASE}/{selectedPage.slug}</span>
                    )}
                  </div>

                  {selectedPage.mechanismAngle && (
                    <div className="p-3 rounded-lg bg-[#00d4ff]/5 border border-[#00d4ff]/20">
                      <div className="text-xs font-semibold text-[#00d4ff] mb-1">Mechanism Angle</div>
                      <div className="text-xs text-gray-300">{selectedPage.mechanismAngle}</div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Headline</div>
                    <div className="text-lg font-bold text-white leading-tight">{selectedPage.headline}</div>
                  </div>

                  {selectedPage.subheadline && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Subheadline</div>
                      <div className="text-sm text-gray-300 italic">{selectedPage.subheadline}</div>
                    </div>
                  )}

                  {selectedPage.bodyHtml && (
                    <div>
                      <button className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2"
                        onClick={() => setExpandedId(expandedId === selectedPage.id ? null : selectedPage.id)}>
                        Body Copy {expandedId === selectedPage.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      {expandedId === selectedPage.id && (
                        <div className="prose prose-sm prose-invert max-w-none text-gray-300 text-xs leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: selectedPage.bodyHtml }} />
                      )}
                    </div>
                  )}

                  {/* CTA Info */}
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">CTA Configuration</div>
                    <div className="text-sm font-semibold text-white">{selectedPage.ctaText}</div>
                    <div className="text-xs text-gray-400 mt-1 font-mono truncate">{selectedPage.ctaUrl}</div>
                    {isShopifyPage(selectedPage.ctaUrl) && (
                      <div className="mt-2 flex items-start gap-1.5 p-2 rounded bg-green-500/10 border border-green-500/20">
                        <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                        <p className="text-[10px] text-green-400">Direct Shopify cart permalink — zero domain hop. Meta Pixel fires AddToCart on click.</p>
                      </div>
                    )}
                  </div>

                  {/* Shopify Export Panel */}
                  <div className="rounded-lg border border-white/10 overflow-hidden">
                    <button
                      onClick={() => setShowShopifyExport(!showShopifyExport)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/8 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-[#00d4ff]" />
                        <span className="text-sm font-medium text-white">Export for Shopify Pages</span>
                        <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded">Paste into Shopify HTML editor</span>
                      </div>
                      {showShopifyExport ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </button>

                    {showShopifyExport && (
                      <div className="p-4 space-y-4">
                        {shopifyLoading ? (
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Loader2 className="w-4 h-4 animate-spin" />Generating HTML...
                          </div>
                        ) : shopifyExport ? (
                          <>
                            {/* Step-by-step instructions */}
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">How to deploy to Shopify</p>
                              {shopifyExport.instructions.map((step: string, i: number) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                                  <span className="text-[#00d4ff] font-mono shrink-0 w-4">{i + 1}.</span>
                                  <span>{step.replace(/^\d+\.\s*/, "")}</span>
                                </div>
                              ))}
                            </div>

                            {/* Shopify Admin Link */}
                            <a href={shopifyExport.shopifyAdminUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-[#00d4ff] hover:underline">
                              <ExternalLink className="w-3.5 h-3.5" />Open Shopify Admin → Pages
                            </a>

                            {/* HTML Output */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-500 font-mono">HTML to paste into Shopify page editor</span>
                                <Button size="sm" onClick={handleCopyHtml}
                                  className={`text-xs h-7 ${htmlCopied ? "bg-green-600 hover:bg-green-700" : "bg-white/10 hover:bg-white/20"} text-white`}>
                                  {htmlCopied ? <><CheckCircle2 className="w-3 h-3 mr-1.5" />Copied!</> : <><Copy className="w-3 h-3 mr-1.5" />Copy HTML</>}
                                </Button>
                              </div>
                              <pre className="bg-black/40 border border-white/10 rounded-md p-3 text-[10px] text-green-300 font-mono overflow-x-auto max-h-56 overflow-y-auto whitespace-pre-wrap">
                                {shopifyExport.html}
                              </pre>
                            </div>

                            {/* Live URL */}
                            <div className="p-3 rounded-md bg-[#00d4ff]/5 border border-[#00d4ff]/20">
                              <p className="text-[10px] text-gray-500 mb-1">After saving in Shopify, your page will be live at:</p>
                              <a href={shopifyExport.pageUrl} target="_blank" rel="noopener noreferrer"
                                className="text-sm text-[#00d4ff] hover:underline flex items-center gap-1 font-mono">
                                {shopifyExport.pageUrl}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              <p className="text-[10px] text-gray-500 mt-1.5">→ Use this as your Meta ad destination URL</p>
                            </div>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-gray-600">
                    Created {new Date(selectedPage.createdAt).toLocaleDateString()}
                    {selectedPage.publishedAt && ` · Published ${new Date(selectedPage.publishedAt).toLocaleDateString()}`}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
