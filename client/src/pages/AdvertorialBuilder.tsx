import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
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
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  published: "bg-green-500/20 text-green-400 border-green-500/30",
  archived: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const BRIDGE_BASE = "https://ch.theurbanmonk.com/bridge";

export default function AdvertorialBuilder() {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form state
  const [topic, setTopic] = useState("gut_health");
  const [slug, setSlug] = useState("");
  const [customAngle, setCustomAngle] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaText, setCtaText] = useState("");

  const utils = trpc.useUtils();

  const { data: pages, isLoading: pagesLoading } = trpc.advertorial.list.useQuery();
  const { data: topics } = trpc.advertorial.getTopics.useQuery();
  const { data: selectedPage, isLoading: pageLoading } = trpc.advertorial.get.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId }
  );

  const generateMutation = trpc.advertorial.generate.useMutation({
    onSuccess: (page) => {
      toast.success("Advertorial generated! Review and publish when ready.");
      utils.advertorial.list.invalidate();
      if (page) setSelectedId(page.id);
      setShowForm(false);
      setSlug(""); setCustomAngle(""); setTargetAudience(""); setCtaUrl(""); setCtaText("");
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
    if (config) { setCtaUrl(config.defaultCtaUrl); setCtaText(config.defaultCtaText); }
  };

  const handleGenerate = () => {
    if (!slug) { toast.error("URL slug is required"); return; }
    generateMutation.mutate({
      topic, slug,
      customAngle: customAngle || undefined,
      targetAudience: targetAudience || undefined,
      ctaUrl: ctaUrl || undefined,
      ctaText: ctaText || undefined,
    });
  };

  const copyUrl = (s: string) => {
    navigator.clipboard.writeText(`${BRIDGE_BASE}/${s}`);
    toast.success("URL copied!");
  };

  const selectedTopic = topics?.find((t) => t.key === topic);

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-100">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0d1117]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Advertorial Bridge Builder</h1>
            <p className="text-sm text-gray-400 mt-0.5">Native editorial pages that bridge cold Meta traffic to your offers</p>
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
              { num: "04", title: "Seamless Bridge CTA", desc: "Natural next step that pre-qualifies the reader and bridges directly into the offer" },
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Topic *</label>
                <div className="grid grid-cols-2 gap-2">
                  {topics?.map((t) => (
                    <button key={t.key} onClick={() => handleTopicChange(t.key)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left ${topic === t.key ? "bg-[#00d4ff]/20 border-[#00d4ff]/50 text-[#00d4ff]" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">URL Slug * <span className="text-gray-500">(ch.theurbanmonk.com/bridge/___)</span></label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="gut-inflammation-fatigue" className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
                {slug && <p className="text-xs text-gray-500 mt-1">→ {BRIDGE_BASE}/{slug}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Custom Mechanism Angle <span className="text-gray-500">(optional)</span></label>
                <Input value={customAngle} onChange={(e) => setCustomAngle(e.target.value)}
                  placeholder={selectedTopic ? `Default: ${selectedTopic.defaultCampaign} campaign` : "e.g. leaky gut triggers brain fog via vagus nerve"}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Target Audience <span className="text-gray-500">(optional)</span></label>
                <Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. busy professionals 40-60 with chronic fatigue"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">CTA Destination URL</label>
                <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder={selectedTopic?.defaultCtaUrl || "https://theacademy.theurbanmonk.com/..."}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">CTA Button Text</label>
                <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)}
                  placeholder={selectedTopic?.defaultCtaText || "Check Your Eligibility →"}
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
                {pages?.map((page) => (
                  <div key={page.id} onClick={() => setSelectedId(page.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedId === page.id ? "border-[#00d4ff]/50 bg-[#00d4ff]/5" : "border-white/10 bg-[#161b22] hover:border-white/20"}`}>
                    <div className="text-xs font-mono text-gray-500 truncate">/bridge/{page.slug}</div>
                    <div className="text-sm font-medium text-white mt-1 line-clamp-2">{page.headline || "(No headline yet)"}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[page.status]}`}>{page.status}</span>
                      <span className="text-xs text-gray-500 capitalize">{page.topic.replace("_", " ")}</span>
                    </div>
                  </div>
                ))}
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
                  <a href={`${BRIDGE_BASE}/${selectedPage.slug}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="border-white/20 text-gray-300 text-xs">
                      <ExternalLink className="w-3 h-3 mr-1.5" />Preview
                    </Button>
                  </a>
                  <Button size="sm" variant="outline" className="border-white/20 text-gray-300 text-xs" onClick={() => copyUrl(selectedPage.slug)}>
                    <Copy className="w-3 h-3 mr-1.5" />Copy URL
                  </Button>
                  <Button size="sm" variant="outline" className="border-white/20 text-gray-300 text-xs"
                    onClick={() => regenerateMutation.mutate({ id: selectedPage.id })} disabled={regenerateMutation.isPending}>
                    {regenerateMutation.isPending ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1.5" />}
                    Regenerate
                  </Button>
                  <div className="ml-auto flex items-center gap-2">
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
                <div className="p-5 space-y-4 max-h-[600px] overflow-y-auto">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[selectedPage.status]}`}>{selectedPage.status}</span>
                    <span className="text-xs font-mono text-gray-500">{BRIDGE_BASE}/{selectedPage.slug}</span>
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

                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">CTA Bridge</div>
                    <div className="text-sm font-semibold text-white">{selectedPage.ctaText}</div>
                    <div className="text-xs text-gray-400 mt-1 font-mono truncate">{selectedPage.ctaUrl}</div>
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
