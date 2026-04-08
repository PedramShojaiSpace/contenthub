import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Facebook, Linkedin, Loader2, Save, Twitter, Youtube } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Platform = "meta" | "linkedin" | "x" | "youtube";

const PLATFORMS: { key: Platform; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "linkedin", label: "LinkedIn", icon: <Linkedin className="h-4 w-4" />, color: "text-sky-400" },
  { key: "meta", label: "Meta", icon: <Facebook className="h-4 w-4" />, color: "text-blue-400" },
  { key: "x", label: "X (Twitter)", icon: <Twitter className="h-4 w-4" />, color: "text-slate-300" },
  { key: "youtube", label: "YouTube", icon: <Youtube className="h-4 w-4" />, color: "text-red-400" },
];

const DEFAULT_VOICE_GUIDELINES: Record<Platform, string> = {
  linkedin: `AUDIENCE: Corporate executives, entrepreneurs, high-achieving professionals aged 35-55.

TONE: Professional, authoritative, data-informed. Challenges hustle culture. Bridges ancient wisdom with modern science. Direct, confident, slightly provocative. No fluff.

MESSAGING PILLARS:
- Performance optimization through biological hardware
- The gut-brain connection and its impact on executive function
- Upstream medicine (fix the root cause, not the symptom)
- The cost of ignoring your health on your career and legacy
- Ancient wisdom applied to modern high-performance life

AVOID: Corporate buzzwords, empty motivational language, anything that sounds like generic "wellness" content.`,

  meta: `AUDIENCE: Health-conscious professionals, wellness seekers, spiritual explorers aged 28-50.

TONE: Warm, relatable, inspiring, educational but accessible. Bridges science and spirituality. Personal stories welcome. Empathetic but direct.

MESSAGING PILLARS:
- Daily practices and rituals for energy and clarity
- Mindfulness and meditation in a busy world
- Gut health, sleep, and stress management
- The Urban Monk Academy as a transformation vehicle
- Personal stories of breakthrough and healing

AVOID: Preachy tone, overly clinical language, anything that alienates spiritual seekers.`,

  x: `AUDIENCE: Intellectually curious professionals, wellness enthusiasts, biohackers aged 25-45.

TONE: Sharp, punchy, thought-provoking. Challenges conventional wisdom. Mix of bold statements and nuanced insights. Conversational.

MESSAGING PILLARS:
- Counterintuitive health insights
- Performance hacks and mental models
- Mindset shifts for high performers
- Short wisdom nuggets from Taoist and functional medicine traditions
- Thread-worthy deep dives on gut, sleep, and stress

AVOID: Long-winded explanations, corporate speak, anything that doesn't stop the scroll.`,

  youtube: `AUDIENCE: Serious wellness seekers and high-performers looking for in-depth education, aged 30-55.

TONE: Educational, authoritative, storytelling-driven. Pedram is the guide/teacher. Conversational but substantive. Mix of personal experience and clinical/scientific backing.

MESSAGING PILLARS:
- Deep dives on gut health, sleep optimization, stress physiology
- Ancient practices with modern scientific validation
- Functional medicine approaches to common executive health problems
- The Urban Monk Academy curriculum and philosophy
- Interviews with leading experts in health and performance

AVOID: Superficial content, clickbait without substance, anything that doesn't deliver genuine value.`,
};

function PlatformStrategyTab({ platform }: { platform: Platform }) {
  const { data: strategy, refetch } = trpc.strategy.get.useQuery({ platform });
  const upsertMutation = trpc.strategy.upsert.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Strategy saved!");
    },
    onError: (err) => toast.error("Save failed: " + err.message),
  });

  const [voiceGuidelines, setVoiceGuidelines] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");

  useEffect(() => {
    if (strategy) {
      setVoiceGuidelines(strategy.voiceGuidelines || DEFAULT_VOICE_GUIDELINES[platform]);
      setPromptTemplate(strategy.promptTemplate || "");
    } else {
      setVoiceGuidelines(DEFAULT_VOICE_GUIDELINES[platform]);
    }
  }, [strategy, platform]);

  const handleSave = () => {
    upsertMutation.mutate({ platform, voiceGuidelines, promptTemplate });
  };

  return (
    <div className="space-y-6 pt-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-foreground">Voice Guidelines</CardTitle>
          <p className="text-xs text-muted-foreground">
            Define the audience, tone, and messaging pillars for this platform. These guidelines
            are injected into every AI generation request.
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            value={voiceGuidelines}
            onChange={(e) => setVoiceGuidelines(e.target.value)}
            rows={16}
            className="bg-background border-border resize-none text-sm text-foreground font-mono leading-relaxed"
          />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-foreground">
            Custom Prompt Override (Optional)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Advanced: override the default system prompt for this platform. Leave blank to use the
            built-in optimized prompt.
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Leave blank to use the built-in platform prompt..."
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            rows={6}
            className="bg-background border-border resize-none text-sm text-foreground font-mono leading-relaxed placeholder:text-muted-foreground/50"
          />
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={upsertMutation.isPending}
        className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
      >
        {upsertMutation.isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        Save Strategy
      </Button>
    </div>
  );
}

export default function StrategyBrain() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Strategy Brain</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define your voice, audience, and messaging pillars for each platform. These guidelines
            power every AI generation.
          </p>
        </div>

        <Tabs defaultValue="linkedin">
          <TabsList className="bg-muted/30 border border-border">
            {PLATFORMS.map((p) => (
              <TabsTrigger
                key={p.key}
                value={p.key}
                className="data-[state=active]:bg-card data-[state=active]:text-foreground"
              >
                <span className={`mr-1.5 ${p.color}`}>{p.icon}</span>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {PLATFORMS.map((p) => (
            <TabsContent key={p.key} value={p.key}>
              <PlatformStrategyTab platform={p.key} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
