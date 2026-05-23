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
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// The snippet — no <?php opening tag, WPCode adds that automatically
const WPCODE_SNIPPET = `add_action( 'rest_api_init', function () {
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

// Full snippet with PHP opening tag for functions.php
const FUNCTIONS_PHP_SNIPPET = `<?php
${WPCODE_SNIPPET}`;

const WPCODE_STEPS = [
  {
    number: 1,
    title: "Open WPCode Lite",
    description: "In your WordPress admin, go to Code Snippets → Add Snippet.",
    link: "https://theurbanmonk.com/wp-admin/admin.php?page=wpcode-snippet-manager&custom_snippet=1",
    linkLabel: "Open WPCode → Add Snippet",
  },
  {
    number: 2,
    title: "Set snippet type to PHP",
    description: "Click \"Add Your Custom Code (New Snippet)\" and select PHP Snippet as the code type.",
  },
  {
    number: 3,
    title: "Paste the snippet",
    description: "Give it a name like \"Yoast REST API Fields\", paste the snippet below into the code box, and set the insertion location to \"Run Everywhere\".",
  },
  {
    number: 4,
    title: "Activate and save",
    description: "Toggle the snippet to Active and click Save Snippet. No restart needed — takes effect immediately.",
  },
  {
    number: 5,
    title: "Click Recheck above",
    description: "Come back here and click the Recheck button. The status card should turn green within seconds.",
  },
];

const FUNCTIONS_PHP_STEPS = [
  {
    number: 1,
    title: "Open WordPress Admin",
    description: "Go to theurbanmonk.com/wp-admin and log in.",
    link: "https://theurbanmonk.com/wp-admin",
    linkLabel: "Open WP Admin →",
  },
  {
    number: 2,
    title: "Navigate to Theme File Editor",
    description: "Go to Appearance → Theme File Editor. Active theme is Hello Elementor.",
    link: "https://theurbanmonk.com/wp-admin/theme-editor.php",
    linkLabel: "Open Theme Editor →",
  },
  {
    number: 3,
    title: "Open functions.php",
    description: "In the right sidebar, click on 'functions.php' for the Hello Elementor theme.",
  },
  {
    number: 4,
    title: "Paste the snippet",
    description: "Scroll to the very bottom of the file and paste the full snippet (including the <?php tag if the file doesn't already end with PHP code). Click 'Update File' to save.",
  },
  {
    number: 5,
    title: "Click Recheck above",
    description: "Come back here and click the Recheck button. The status card should turn green within seconds.",
  },
];

export default function WordPressSetup() {
  const [snippetExpanded, setSnippetExpanded] = useState(true);
  const [useWpCode, setUseWpCode] = useState(true);
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

  // Auto-select WPCode tab if WPCode is detected
  const wpCodeDetected = yoastStatus?.wpCodeActive ?? false;
  const activeSteps = useWpCode ? WPCODE_STEPS : FUNCTIONS_PHP_STEPS;
  const snippetToCopy = useWpCode ? WPCODE_SNIPPET : FUNCTIONS_PHP_SNIPPET;
  const snippetLabel = useWpCode ? "WPCode Snippet (no <?php needed)" : "functions.php Snippet (includes <?php)";

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(snippetToCopy).then(() => {
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
                ✓ Snippet is active and working
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
            <div className="space-y-3">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Snippet not yet active in WordPress REST API
              </p>
              <p className="text-xs text-muted-foreground">
                The WordPress REST API does not expose any Yoast meta keys. The snippet code is correct — it just needs to be added via one of the methods below.
              </p>
              {wpCodeDetected && (
                <div className="flex items-start gap-2 rounded-md bg-blue-500/10 border border-blue-500/20 p-3">
                  <Zap className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300">WPCode Lite detected on your site</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Use the WPCode method below — it's safer than editing functions.php and loads before themes.
                      If you already added it to functions.php, the snippet may have a PHP syntax error or be in the wrong file.
                    </p>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Current meta keys visible in REST API:{" "}
                <code className="bg-muted px-1 rounded text-xs">
                  {yoastStatus?.metaKeys?.join(", ") || "(none)"}
                </code>
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopySnippet}
                className="gap-2 h-8 text-xs border-amber-500/40 hover:bg-amber-500/10"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Snippet
              </Button>
            </div>
          )}
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
                Without this snippet, the platform can only write the post content — focus keyphrase and meta description won't stick in Yoast.
                Add it once and all three fields will auto-populate on every future publish.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Installation method tabs */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Installation Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tab switcher */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
            <button
              onClick={() => setUseWpCode(true)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                useWpCode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {wpCodeDetected && <span className="mr-1 text-blue-400">★</span>}
              Via WPCode Lite {wpCodeDetected && "(recommended)"}
            </button>
            <button
              onClick={() => setUseWpCode(false)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !useWpCode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Via functions.php
            </button>
          </div>

          {useWpCode && (
            <div className="rounded-md bg-blue-500/5 border border-blue-500/20 p-3 text-xs text-blue-700 dark:text-blue-300">
              <strong>Why WPCode is better:</strong> It loads as a plugin (before themes), so it works even if the theme changes.
              It also has syntax validation and can be toggled on/off without editing files.
              {wpCodeDetected ? " WPCode Lite is already active on your site." : " Install WPCode Lite from the WordPress plugin directory if needed."}
            </div>
          )}

          {/* Steps */}
          <div className="space-y-4">
            {activeSteps.map((step) => (
              <div key={step.number} className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                  {step.number}
                </div>
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  {"link" in step && step.link && (
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
          </div>
        </CardContent>
      </Card>

      {/* The snippet */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Code2 className="h-4 w-4 text-muted-foreground" />
              {snippetLabel}
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
              {snippetToCopy}
            </pre>
          </CardContent>
        )}
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
                Pushes the stored Yoast fields to all already-published WordPress posts without republishing them. Requires the snippet above to be active.
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
