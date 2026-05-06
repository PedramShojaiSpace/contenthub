import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { TrendingUp, Copy, Loader2, Hash, Search, Star, Flame } from "lucide-react";

const NICHES = [
  "Gut Health & Microbiome",
  "Longevity & Anti-Aging",
  "Sleep Optimization",
  "Stress & Nervous System",
  "Functional Medicine",
  "Mindfulness & Meditation",
  "Energy & Metabolism",
  "Brain Health & Cognition",
  "Detox & Cleansing",
  "Supplements & Nutrition",
];

const PLATFORMS = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube Shorts" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X / Twitter" },
];

interface TopicIdea {
  topic: string;
  hook?: string;
  // LLM may return hookAngle instead of hook
  hookAngle?: string;
  hooks?: { contradiction?: string; specificity?: string; curiosityGap?: string };
  angle?: string;
  // LLM may return viralReason instead of angle
  viralReason?: string;
  viralScore: number;
  searchVolume?: string;
  keywords?: string[];
}

interface TopicsResult {
  id: number;
  niche: string;
  platform: string;
  topics: TopicIdea[];
  trendingKeywords?: string[];
  weeklyTheme: string;
  createdAt: Date | string;
}

interface CaptionResult {
  id: number;
  platform: string;
  originalText: string;
  optimizedCaption: string;
  keywords: string[];
  hashtags: string[];
  seoScore: number;
  improvements: string[];
  createdAt: Date | string;
}

function TopicCard({ topic, onCopy }: { topic: TopicIdea; onCopy: (t: string) => void }) {
  // Normalize: LLM may return hookAngle or hooks.contradiction instead of hook
  const hookText = topic.hook ?? topic.hookAngle ?? topic.hooks?.contradiction ?? topic.hooks?.specificity ?? "";
  const angleText = topic.angle ?? topic.viralReason ?? "";
  const keywordList = topic.keywords ?? [];
  const searchVol = topic.searchVolume ?? "";
  return (
    <div className="border border-border rounded-lg p-4 hover:border-orange-300 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Flame
                key={i}
                className={`w-3 h-3 ${i < topic.viralScore ? "fill-orange-400 text-orange-400" : "text-muted-foreground/20"}`}
              />
            ))}
          </div>
          {searchVol && <Badge variant="outline" className="text-xs">{searchVol}</Badge>}
          {angleText && <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">{angleText}</Badge>}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onCopy(topic.topic + (hookText ? "\n\nHook: " + hookText : ""))}>
          <Copy className="w-3 h-3" />
        </Button>
      </div>
      <p className="text-sm font-semibold text-foreground mb-1">{topic.topic}</p>
      {hookText && <p className="text-xs text-muted-foreground italic mb-2">Hook: "{hookText}"</p>}
      {keywordList.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {keywordList.map((kw, i) => (
            <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ViralTopics() {
  const [activeTab, setActiveTab] = useState("topics");

  // Topics state
  const [niche, setNiche] = useState(NICHES[0]);
  const [platform, setPlatform] = useState("tiktok");
  const [topicsResult, setTopicsResult] = useState<TopicsResult | null>(null);

  // Caption SEO state
  const [captionText, setCaptionText] = useState("");
  const [captionPlatform, setCaptionPlatform] = useState("tiktok");
  const [captionKeywords, setCaptionKeywords] = useState("");
  const [captionResult, setCaptionResult] = useState<CaptionResult | null>(null);

  const topicsMutation = trpc.viralStudio.generateViralTopics.useMutation({
    onSuccess: (data) => {
      setTopicsResult(data as unknown as TopicsResult);
      toast.success("10 viral topics generated!");
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const captionMutation = trpc.viralStudio.optimizeCaption.useMutation({
    onSuccess: (data) => {
      setCaptionResult(data as unknown as CaptionResult);
      toast.success("Caption optimized for Social SEO!");
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="p-6 space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="topics" className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            Viral Topics
          </TabsTrigger>
          <TabsTrigger value="seo" className="flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" />
            Caption SEO Optimizer
          </TabsTrigger>
        </TabsList>

        {/* Viral Topics Tab */}
        <TabsContent value="topics" className="space-y-6">
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
            <h3 className="font-semibold text-orange-900 mb-1">Weekly Viral Topic Generator</h3>
            <p className="text-sm text-orange-700">
              Get 10 trending topic ideas in your niche with pre-written hooks, viral angles, and Social SEO keywords. Each topic is scored for viral potential and includes the search volume tier.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  Topic Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Niche</Label>
                  <Select value={niche} onValueChange={setNiche}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NICHES.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Platform</Label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={() => topicsMutation.mutate({ niche, platform: platform as "tiktok" })}
                  disabled={topicsMutation.isPending}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {topicsMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating topics...</>
                  ) : (
                    <><TrendingUp className="w-4 h-4 mr-2" />Generate 10 Viral Topics</>
                  )}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {topicsResult ? (
                <>
                  {topicsResult.weeklyTheme && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-semibold text-amber-700 mb-1">Weekly Theme</p>
                      <p className="text-sm font-medium text-foreground">{topicsResult.weeklyTheme}</p>
                    </div>
                  )}
                  {(topicsResult.trendingKeywords ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(topicsResult.trendingKeywords ?? []).map((kw, i) => (
                        <Badge key={i} variant="outline" className="text-xs text-orange-600 border-orange-200">{kw}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    {topicsResult.topics.map((topic, i) => (
                      <TopicCard key={i} topic={topic} onCopy={handleCopy} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl text-center p-6">
                  <TrendingUp className="w-8 h-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Select a niche and platform to generate 10 viral topic ideas</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Caption SEO Tab */}
        <TabsContent value="seo" className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-blue-900 mb-1 flex items-center gap-2">
              <Search className="w-4 h-4" />
              Social SEO Caption Optimizer
            </h3>
            <p className="text-sm text-blue-700">
              Paste any caption and get a platform-optimized version with natural keyword integration, strategic hashtags, and a SEO score. The algorithm reads captions — this tool makes yours discoverable.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-500" />
                  Caption Input
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Platform</Label>
                  <Select value={captionPlatform} onValueChange={setCaptionPlatform}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Caption to Optimize *</Label>
                  <Textarea
                    placeholder="Paste your caption here..."
                    value={captionText}
                    onChange={(e) => setCaptionText(e.target.value)}
                    rows={5}
                    className="text-sm resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Target Keywords <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
                  <Input
                    placeholder="gut health, microbiome, brain fog, longevity"
                    value={captionKeywords}
                    onChange={(e) => setCaptionKeywords(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <Button
                  onClick={() => captionMutation.mutate({
                    platform: captionPlatform as "tiktok",
                    rawCaption: captionText.trim(),
                    targetKeywords: captionKeywords ? captionKeywords.split(",").map(k => k.trim()).filter(Boolean) as string[] : [],
                  })}
                  disabled={captionMutation.isPending || !captionText.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {captionMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Optimizing...</>
                  ) : (
                    <><Search className="w-4 h-4 mr-2" />Optimize for Social SEO</>
                  )}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {captionResult ? (
                <>
                  {/* SEO Score */}
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                      <span className="text-white font-bold text-lg">{captionResult.seoScore}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-green-700">SEO Score</p>
                      <p className="text-xs text-muted-foreground">out of 100</p>
                    </div>
                  </div>

                  {/* Optimized Caption */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Optimized Caption</p>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => handleCopy(captionResult.optimizedCaption + "\n\n" + captionResult.hashtags.join(" "))}>
                        <Copy className="w-3 h-3 mr-1" />Copy with hashtags
                      </Button>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap">
                      {captionResult.optimizedCaption}
                    </div>
                  </div>

                  {/* Keywords */}
                  {captionResult.keywords?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Keywords Integrated</p>
                      <div className="flex flex-wrap gap-1.5">
                        {captionResult.keywords.map((kw, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hashtags */}
                  {captionResult.hashtags?.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" />Hashtags</p>
                        <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5" onClick={() => handleCopy(captionResult.hashtags.join(" "))}>
                          <Copy className="w-3 h-3 mr-1" />Copy
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {captionResult.hashtags.map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs text-blue-600 border-blue-200 cursor-pointer" onClick={() => handleCopy(tag)}>
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Improvements */}
                  {captionResult.improvements?.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-semibold text-amber-700 mb-2">What Changed</p>
                      <ul className="space-y-1">
                        {captionResult.improvements.map((imp, i) => (
                          <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                            <span className="text-amber-500 mt-0.5">•</span>{imp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl text-center p-6">
                  <Search className="w-8 h-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Paste a caption to optimize it for Social SEO</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
