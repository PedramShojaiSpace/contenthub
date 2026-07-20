import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Send, Eye, RefreshCw, ExternalLink } from "lucide-react";

// ─── Shared preview card ──────────────────────────────────────────────────────

function EmailPreview({
  title,
  subtitle,
  body,
  postUrl,
  onPublish,
  isPublishing,
}: {
  title: string;
  subtitle?: string;
  body: string;
  postUrl?: string;
  onPublish: () => void;
  isPublishing: boolean;
}) {
  return (
    <div className="mt-6 border border-border rounded-lg overflow-hidden">
      <div className="bg-muted/40 px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="w-4 h-4" />
          Preview
        </div>
        <div className="flex gap-2">
          {postUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={postUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 mr-1" />
                View on Substack
              </a>
            </Button>
          )}
          {!postUrl && (
            <Button size="sm" onClick={onPublish} disabled={isPublishing}>
              {isPublishing ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Send className="w-3 h-3 mr-1" />
              )}
              Publish & Send to All
            </Button>
          )}
        </div>
      </div>
      <div className="p-6 space-y-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        {subtitle && <p className="text-muted-foreground text-sm italic">{subtitle}</p>}
        <div className="prose prose-sm max-w-none mt-4 whitespace-pre-wrap text-sm leading-relaxed">
          {body}
        </div>
      </div>
    </div>
  );
}

// ─── Permission Pass ──────────────────────────────────────────────────────────

function PermissionPassTab() {
  const [result, setResult] = useState<{ title: string; subtitle: string; body: string; published: boolean; postUrl?: string } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const generate = trpc.substackSequence.generatePermissionPass.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error(e.message),
  });

  const publish = trpc.substackSequence.generatePermissionPass.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success("Permission Pass published and sent to all subscribers!");
      setIsPublishing(false);
    },
    onError: (e) => {
      toast.error(e.message);
      setIsPublishing(false);
    },
  });

  const handlePublish = () => {
    setIsPublishing(true);
    publish.mutate({ publish: true });
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
        <strong>Send this first.</strong> This is the first email to go to all 900,000 subscribers. Its only goal is to trigger recognition and give disengaged subscribers a graceful way to unsubscribe — so they don't mark you as spam. Do not skip this step.
      </div>
      <Button
        onClick={() => generate.mutate({ publish: false })}
        disabled={generate.isPending}
        className="w-full"
      >
        {generate.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
        ) : (
          <><RefreshCw className="w-4 h-4 mr-2" />Generate Permission Pass</>
        )}
      </Button>
      {result && (
        <EmailPreview
          title={result.title}
          subtitle={result.subtitle}
          body={result.body}
          postUrl={result.postUrl}
          onPublish={handlePublish}
          isPublishing={isPublishing}
        />
      )}
    </div>
  );
}

// ─── Re-Introduction Letter ───────────────────────────────────────────────────

function ReintroductionTab() {
  const [result, setResult] = useState<{ title: string; subtitle: string; body: string; published: boolean; postUrl?: string } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const generate = trpc.substackSequence.generateReintroductionLetter.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error(e.message),
  });

  const publish = trpc.substackSequence.generateReintroductionLetter.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success("Re-Introduction Letter published and sent!");
      setIsPublishing(false);
    },
    onError: (e) => {
      toast.error(e.message);
      setIsPublishing(false);
    },
  });

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
        <strong>Send this second</strong> — one week after the Permission Pass. This is a personal letter from Pedram that re-establishes the relationship and delivers immediate value. No offer.
      </div>
      <Button
        onClick={() => generate.mutate({ publish: false })}
        disabled={generate.isPending}
        className="w-full"
      >
        {generate.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
        ) : (
          <><RefreshCw className="w-4 h-4 mr-2" />Generate Re-Introduction Letter</>
        )}
      </Button>
      {result && (
        <EmailPreview
          title={result.title}
          subtitle={result.subtitle}
          body={result.body}
          postUrl={result.postUrl}
          onPublish={() => {
            setIsPublishing(true);
            publish.mutate({ publish: true });
          }}
          isPublishing={isPublishing}
        />
      )}
    </div>
  );
}

// ─── Academy Launch Sequence ──────────────────────────────────────────────────

const ACADEMY_EMAIL_LABELS: Record<number, string> = {
  1: "Email 1 — The Problem",
  2: "Email 2 — The Mechanism",
  3: "Email 3 — The Story",
  4: "Email 4 — The Offer",
  5: "Email 5 — The Close",
};

function AcademyLaunchTab() {
  const [selectedEmail, setSelectedEmail] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [results, setResults] = useState<Record<number, { title: string; body: string; postUrl?: string }>>({});
  const [publishing, setPublishing] = useState<number | null>(null);

  const generate = trpc.substackSequence.generateAcademyLaunchEmail.useMutation({
    onSuccess: (data) => {
      setResults((prev) => ({ ...prev, [selectedEmail]: data }));
    },
    onError: (e) => toast.error(e.message),
  });

  const publish = trpc.substackSequence.generateAcademyLaunchEmail.useMutation({
    onSuccess: (data) => {
      setResults((prev) => ({ ...prev, [publishing!]: data }));
      toast.success(`Academy Launch Email ${publishing} published and sent!`);
      setPublishing(null);
    },
    onError: (e) => {
      toast.error(e.message);
      setPublishing(null);
    },
  });

  const current = results[selectedEmail];

  return (
    <div className="space-y-4">
      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm text-green-800 dark:text-green-200">
        <strong>5-email sequence — send one per week, in order.</strong> Emails 1–3 build trust (no offer). Email 4 introduces the Academy. Email 5 closes. Send the first email 4 weeks after the Re-Introduction Letter.
      </div>
      <div className="flex flex-wrap gap-2">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            onClick={() => setSelectedEmail(n)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              selectedEmail === n
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            } ${results[n] ? "ring-1 ring-green-500" : ""}`}
          >
            {ACADEMY_EMAIL_LABELS[n]}
            {results[n] && " ✓"}
          </button>
        ))}
      </div>
      <Button
        onClick={() => generate.mutate({ emailNumber: selectedEmail, publish: false })}
        disabled={generate.isPending}
        className="w-full"
      >
        {generate.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating {ACADEMY_EMAIL_LABELS[selectedEmail]}...</>
        ) : (
          <><RefreshCw className="w-4 h-4 mr-2" />Generate {ACADEMY_EMAIL_LABELS[selectedEmail]}</>
        )}
      </Button>
      {current && (
        <EmailPreview
          title={current.title}
          body={current.body}
          postUrl={current.postUrl}
          onPublish={() => {
            setPublishing(selectedEmail);
            publish.mutate({ emailNumber: selectedEmail, publish: true });
          }}
          isPublishing={publishing === selectedEmail}
        />
      )}
    </div>
  );
}

// ─── Supplement Sequence ──────────────────────────────────────────────────────

function SupplementSequenceTab() {
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [productBenefit, setProductBenefit] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [result, setResult] = useState<{ title: string; body: string; postUrl?: string } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const SUPP_LABELS: Record<number, string> = {
    1: "Email 1 — Educational",
    2: "Email 2 — Mechanism",
    3: "Email 3 — Story",
    4: "Email 4 — Offer",
    5: "Email 5 — Close",
  };

  const generate = trpc.substackSequence.generateSupplementEmail.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error(e.message),
  });

  const publish = trpc.substackSequence.generateSupplementEmail.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success("Supplement email published and sent!");
      setIsPublishing(false);
    },
    onError: (e) => {
      toast.error(e.message);
      setIsPublishing(false);
    },
  });

  const canGenerate = productName.trim() && productUrl.trim() && productBenefit.trim();

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        <div>
          <Label>Product Name</Label>
          <Input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. Urban Monk Gut Restore"
          />
        </div>
        <div>
          <Label>Product URL</Label>
          <Input
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            placeholder="https://theurbanmonk.com/products/..."
          />
        </div>
        <div>
          <Label>Primary Health Benefit</Label>
          <Input
            value={productBenefit}
            onChange={(e) => setProductBenefit(e.target.value)}
            placeholder="e.g. gut barrier repair and microbiome restoration"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            onClick={() => setSelectedEmail(n)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              selectedEmail === n
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {SUPP_LABELS[n]}
          </button>
        ))}
      </div>
      <Button
        onClick={() =>
          generate.mutate({
            emailNumber: selectedEmail,
            productName,
            productUrl,
            productBenefit,
            publish: false,
          })
        }
        disabled={generate.isPending || !canGenerate}
        className="w-full"
      >
        {generate.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
        ) : (
          <><RefreshCw className="w-4 h-4 mr-2" />Generate {SUPP_LABELS[selectedEmail]}</>
        )}
      </Button>
      {result && (
        <EmailPreview
          title={result.title}
          body={result.body}
          postUrl={result.postUrl}
          onPublish={() => {
            setIsPublishing(true);
            publish.mutate({
              emailNumber: selectedEmail,
              productName,
              productUrl,
              productBenefit,
              publish: true,
            });
          }}
          isPublishing={isPublishing}
        />
      )}
    </div>
  );
}

// ─── Standalone Post ──────────────────────────────────────────────────────────

function StandalonePostTab() {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [postUrl, setPostUrl] = useState<string | null>(null);

  const publish = trpc.substackSequence.publishStandalonePost.useMutation({
    onSuccess: (data) => {
      setPostUrl(data.postUrl ?? null);
      toast.success("Post published to Substack!");
    },
    onError: (e) => toast.error(e.message),
  });

  const bodyHtml = body
    .split("\n\n")
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return (
    <div className="space-y-4">
      <div className="bg-muted/40 border border-border rounded-lg p-4 text-sm text-muted-foreground">
        Write and publish a one-off Substack letter — not derived from a blog post. Use this for announcements, personal notes, or any standalone communication.
      </div>
      <div className="space-y-3">
        <div>
          <Label>Subject / Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Email subject line" />
        </div>
        <div>
          <Label>Subtitle (optional)</Label>
          <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="One-line deck" />
        </div>
        <div>
          <Label>Body (plain text — blank lines become paragraph breaks)</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            placeholder="Write your letter here..."
            className="font-mono text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="send-email"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="send-email" className="cursor-pointer">
            Send as email to all subscribers (uncheck to publish as web-only post)
          </Label>
        </div>
      </div>
      <Button
        onClick={() => publish.mutate({ title, subtitle: subtitle || undefined, bodyHtml, sendEmail })}
        disabled={publish.isPending || !title.trim() || !body.trim()}
        className="w-full"
      >
        {publish.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publishing...</>
        ) : (
          <><Send className="w-4 h-4 mr-2" />{sendEmail ? "Publish & Send to All Subscribers" : "Publish as Web Post Only"}</>
        )}
      </Button>
      {postUrl && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <ExternalLink className="w-4 h-4" />
          <a href={postUrl} target="_blank" rel="noopener noreferrer" className="underline">
            View published post on Substack
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubstackSequence() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Substack Sequence Builder</h1>
          <p className="text-muted-foreground mt-1">
            Re-engage your 900,000 subscribers — one email at a time, in order.
          </p>
        </div>

        {/* Send order reminder */}
        <div className="mb-6 bg-card border border-border rounded-lg p-4">
          <p className="text-sm font-medium mb-2">Recommended Send Order</p>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li><strong className="text-foreground">Permission Pass</strong> — Week 1 (send first, to everyone)</li>
            <li><strong className="text-foreground">Re-Introduction Letter</strong> — Week 2</li>
            <li>4 educational emails — Weeks 3–6 (write manually in Substack or use Standalone Post)</li>
            <li><strong className="text-foreground">Academy Launch Emails 1–5</strong> — Weeks 7–11 (one per week)</li>
            <li><strong className="text-foreground">Supplement Sequence</strong> — After Academy launch</li>
          </ol>
        </div>

        <Tabs defaultValue="permission-pass">
          <TabsList className="w-full grid grid-cols-5 mb-6">
            <TabsTrigger value="permission-pass" className="text-xs">Permission Pass</TabsTrigger>
            <TabsTrigger value="reintro" className="text-xs">Re-Intro Letter</TabsTrigger>
            <TabsTrigger value="academy" className="text-xs">Academy Launch</TabsTrigger>
            <TabsTrigger value="supplement" className="text-xs">Supplement</TabsTrigger>
            <TabsTrigger value="standalone" className="text-xs">Standalone</TabsTrigger>
          </TabsList>
          <TabsContent value="permission-pass"><PermissionPassTab /></TabsContent>
          <TabsContent value="reintro"><ReintroductionTab /></TabsContent>
          <TabsContent value="academy"><AcademyLaunchTab /></TabsContent>
          <TabsContent value="supplement"><SupplementSequenceTab /></TabsContent>
          <TabsContent value="standalone"><StandalonePostTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
