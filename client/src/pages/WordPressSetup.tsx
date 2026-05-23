import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Settings,
  AlertCircle,
  Code2,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const FUNCTIONS_PHP_SNIPPET = `<?php
/**
 * The Urban Monk — Yoast SEO REST API Field Exposure
 *
 * Paste this snippet into your WordPress theme's functions.php file
 * (or into a custom plugin / Code Snippets plugin).
 *
 * PURPOSE: Yoast SEO (free) does not expose its meta fields to the WordPress
 * REST API by default. This snippet registers them as REST-readable and
 * REST-writable, allowing content.theurbanmonk.com to automatically populate
 * all Yoast SEO fields when publishing blog posts — no manual entry required.
 */
add_action( 'rest_api_init', function () {
    $yoast_fields = [
        '_yoast_wpseo_focuskw'   => 'Focus Keyphrase for Yoast SEO',
        '_yoast_wpseo_metadesc'  => 'Meta Description for Yoast SEO',
        '_yoast_wpseo_title'     => 'SEO Title for Yoast SEO',
        '_yoast_wpseo_canonical' => 'Canonical URL for Yoast SEO',
    ];

    foreach ( $yoast_fields as $meta_key => $description ) {
        register_post_meta( 'post', $meta_key, [
            'show_in_rest'  => true,
            'single'        => true,
            'type'          => 'string',
            'description'   => $description,
            'auth_callback' => function () {
                return current_user_can( 'edit_posts' );
            },
        ] );
    }
} );`;

const STEPS = [
  {
    number: 1,
    title: "Open WordPress Admin",
    description: "Go to theurbanmonk.com/wp-admin and log in.",
    link: "https://theurbanmonk.com/wp-admin",
    linkLabel: "Open WP Admin →",
  },
  {
    number: 2,
    title: "Navigate to Theme Editor",
    description: "Go to Appearance → Theme File Editor. If you don't see this, use the Code Snippets plugin instead (safer option).",
    link: "https://theurbanmonk.com/wp-admin/theme-editor.php",
    linkLabel: "Open Theme Editor →",
  },
  {
    number: 3,
    title: "Open functions.php",
    description: "In the right sidebar, click on 'functions.php' (or your child theme's functions.php if you have one).",
  },
  {
    number: 4,
    title: "Paste the snippet",
    description: "Scroll to the bottom of the file and paste the snippet below. Click 'Update File' to save.",
  },
  {
    number: 5,
    title: "Done — no restart needed",
    description: "WordPress REST API changes take effect immediately. All future blog publishes from this platform will automatically populate all Yoast fields.",
  },
];

export default function WordPressSetup() {
  const [snippetExpanded, setSnippetExpanded] = useState(true);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  // Live Yoast snippet status check
  const {
    data: yoastStatus,
    isLoading: yoastLoading,
    refetch: refetchYoast,
    isFetching: yoastFetching,
  } = trpc.blog.checkYoastSnippet.useQuery(undefined, {
    staleTime: 30_000,
  });

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(FUNCTIONS_PHP_SNIPPET).then(() => {
      toast.success("Snippet copied to clipboard!");
    });
  };

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestMessage("");
    try {
      const res = await fetch("/api/trpc/blog.testWpConnection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ json: {} }),
      });
      const json = await res.json();
      const result = json?.result?.data?.json;
      if (result?.ok) {
        setTestStatus("ok");
        setTestMessage(result.message ?? "WordPress is connected and responding.");
      } else {
        setTestStatus("error");
        setTestMessage(result?.message ?? "WordPress returned an unexpected response.");
      }
    } catch (err) {
      setTestStatus("error");
      setTestMessage(err instanceof Error ? err.message : "Connection failed.");
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Back nav */}
      <a href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Hub
      </a>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
          <Settings className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">WordPress Setup</h1>
          <p className="text-sm text-muted-foreground">One-time setup to unlock full Yoast SEO field automation</p>
        </div>
      </div>

      {/* ─── Yoast Snippet Status (live check) ─────────────────────────────── */}
      <Card className={`border-2 ${
        yoastLoading || yoastFetching
          ? "border-border"
          : yoastStatus?.installed
          ? "border-green-500/40 bg-green-500/5"
          : "border-amber-500/40 bg-amber-500/5"
      }`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              {yoastLoading || yoastFetching ? (
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : yoastStatus?.installed ? (
                <ShieldCheck className="h-4 w-4 text-green-500" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-amber-500" />
              )}
              Yoast Snippet Status
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchYoast()}
              disabled={yoastFetching}
              className="h-7 text-xs gap-1.5"
            >
              <RefreshCw className={`h-3 w-3 ${yoastFetching ? "animate-spin" : ""}`} />
              Recheck
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {yoastLoading ? (
            <p className="text-sm text-muted-foreground">Checking WordPress REST API…</p>
          ) : yoastStatus?.installed ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Snippet is installed and working
              </p>
              <p className="text-xs text-muted-foreground">
                Yoast meta keys exposed via REST API:{" "}
                <code className="bg-muted px-1 rounded text-xs">
                  {yoastStatus.foundYoastKeys?.join(", ")}
                </code>
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">
                All future blog publishes will automatically set the focus keyphrase, meta description, and SEO title in Yoast.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Snippet not yet installed
              </p>
              <p className="text-xs text-muted-foreground">
                The WordPress REST API does not expose any Yoast meta keys. Focus keyphrase and meta description will not be pushed to Yoast until the snippet is added.
              </p>
              <p className="text-xs text-muted-foreground">
                Current meta keys visible:{" "}
                <code className="bg-muted px-1 rounded text-xs">
                  {yoastStatus?.metaKeys?.join(", ") || "(none)"}
                </code>
              </p>
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopySnippet}
                  className="gap-2 h-8 text-xs border-amber-500/40 hover:bg-amber-500/10"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Snippet to Clipboard
                </Button>
                <span className="ml-2 text-xs text-muted-foreground">then paste into functions.php (see steps below)</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            WordPress Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testStatus === "testing"}
              className="gap-2"
            >
              {testStatus === "testing" ? (
                <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Testing...</>
              ) : (
                <><RefreshCw className="h-3.5 w-3.5" /> Test WP Connection</>
              )}
            </Button>
            {testStatus === "ok" && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> {testMessage}
              </span>
            )}
            {testStatus === "error" && (
              <span className="flex items-center gap-1.5 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" /> {testMessage}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Tests the connection to theurbanmonk.com WordPress REST API using the configured credentials.
          </p>
        </CardContent>
      </Card>

      {/* Why this matters */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Why this snippet is needed</p>
              <p className="text-sm text-muted-foreground">
                Yoast SEO (free version) marks its meta fields as "protected" in WordPress, which blocks external REST API writes by default.
                Without this snippet, the platform can only write the SEO title — focus keyphrase and meta description won't stick.
                Paste this once and all three fields will auto-populate on every future publish.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step-by-step instructions */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Installation Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {STEPS.map((step) => (
            <div key={step.number} className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                {step.number}
              </div>
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium text-foreground">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
                {step.link && (
                  <a
                    href={step.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {step.linkLabel} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* The snippet */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Code2 className="h-4 w-4 text-muted-foreground" />
              functions.php Snippet
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopySnippet}
                className="gap-2 h-8 text-xs"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Snippet
              </Button>
              <button
                onClick={() => setSnippetExpanded(!snippetExpanded)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {snippetExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardHeader>
        {snippetExpanded && (
          <CardContent>
            <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs text-foreground overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
              {FUNCTIONS_PHP_SNIPPET}
            </pre>
          </CardContent>
        )}
      </Card>

      {/* Batch actions */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            Batch SEO Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            These batch actions are also available in the <strong>Command Center → Blog filter</strong> header bar.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <p className="text-sm font-medium text-foreground">Generate Yoast for All Drafts</p>
              </div>
              <p className="text-xs text-muted-foreground">
                AI reads each draft blog post and generates an optimized SEO title, meta description, and focus keyphrase. Saves to database automatically.
              </p>
              <p className="text-xs text-purple-400 font-medium">
                → Go to Command Center → click "Blog" filter → click "Generate Yoast for X Drafts"
              </p>
            </div>
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-green-400" />
                <p className="text-sm font-medium text-foreground">Backfill Yoast in WordPress</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Pushes the stored Yoast fields to all already-published WordPress posts without republishing them. Requires the functions.php snippet above.
              </p>
              <p className="text-xs text-green-400 font-medium">
                → Go to Command Center → click "Blog" filter → click "Backfill Yoast in WP"
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
