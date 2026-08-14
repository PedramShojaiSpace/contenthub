import { lazy, Suspense, useEffect } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const TantraQuiz = lazy(() => import("./pages/TantraQuiz"));
const TantraContentDivorce = lazy(() => import("./pages/TantraContentDivorce"));
const TantraContentKingQueen = lazy(() => import("./pages/TantraContentKingQueen"));
const TantraContentFlower = lazy(() => import("./pages/TantraContentFlower"));
const TantraContentHim = lazy(() => import("./pages/TantraContentHim"));
const TantraContentLoveBank = lazy(() => import("./pages/TantraContentLoveBank"));
const TantraContentWhySheStopped = lazy(() => import("./pages/TantraContentWhySheStopped"));
const TantraContentFemaleOrgasm = lazy(() => import("./pages/TantraContentFemaleOrgasm"));
const TantraHormoneHealthPathway = lazy(() => import("./pages/TantraHormoneHealthPathway"));
const Interconnected = lazy(() => import("./pages/Interconnected"));
const InterconnectedThankYou = lazy(() => import("./pages/InterconnectedThankYou"));
const InterconnectedThankYouB = lazy(() => import("./pages/InterconnectedThankYouB"));
const InterconnectedThankYouKlaviyo = lazy(() => import("./pages/InterconnectedThankYouKlaviyo"));
const Interconnected199PostPurchaseKlaviyo = lazy(() => import("./pages/Interconnected199PostPurchaseKlaviyo"));
const InterconnectedPurchased = lazy(() => import("./pages/InterconnectedPurchased"));
const InterconnectedB = lazy(() => import("./pages/InterconnectedB"));
const DiagnosticQuiz = lazy(() => import("./pages/DiagnosticQuiz"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d]">
      <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function HubRedirect() {
  useEffect(() => {
    const query = window.location.search;
    const path = window.location.pathname;
    const analyticsPaths = ["/tantra-funnel", "/reconciliation", "/interconnected-command"];
    const contentPaths = [
      "/content-pipeline", "/podcast-production", "/seo", "/scoreboard",
      "/competitive-intelligence", "/keyword-strategy", "/ch-pages", "/qr-generator",
      "/backlink-outreach", "/video-to-blog", "/blog-to-youtube", "/review-queue",
      "/ask-urban-monk", "/presence-assessment", "/syndication", "/va", "/ads",
      "/lead-scrubber", "/email-optimizer", "/klaviyo-flow-optimizer", "/kids-research",
      "/kids-review", "/collective-sourcing", "/soro-intelligence", "/plain-text-email",
      "/va-tasks", "/kajabi-live", "/advertorial-builder",
    ];
    const growthPaths = [
      "/upstream", "/meta-ads", "/ad-attribution", "/campaign-monitor", "/historical-posts",
      "/reddit-personas", "/reddit-roas", "/youtube-pipeline", "/substack", "/deep-dive",
      "/system-health", "/funnels", "/ascension", "/ab-tests", "/claims-review", "/yt-analytics",
      "/ga4-analytics", "/analyze", "/transcript-engine", "/corpus-builder", "/pattern-extractor",
      "/script-factory", "/performance-loop", "/funnel-economics", "/funnel-advisor", "/mof-content",
    ];
    const target = analyticsPaths.some((item) => path.startsWith(item))
      ? `/hub/analytics${path}`
      : contentPaths.some((item) => path.startsWith(item))
        ? `/hub/content${path}`
        : growthPaths.some((item) => path.startsWith(item))
          ? `/hub/growth${path}`
          : `/hub${path}`;
    window.location.replace(`${target}${query}`);
  }, []);
  return <PageLoader />;
}

export default function PublicApp() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<PageLoader />}>
            <Switch>
            <Route path="/" component={HubRedirect} />
            <Route path="/quiz/tantra" component={TantraQuiz} />
            <Route path="/tantra-funnel" component={HubRedirect} />
            <Route path="/tantra/considering-divorce" component={TantraContentDivorce} />
            <Route path="/tantra/king-and-queen" component={TantraContentKingQueen} />
            <Route path="/tantra/sex-is-the-flower" component={TantraContentFlower} />
            <Route path="/tantra/why-he-stopped" component={TantraContentHim} />
            <Route path="/tantra/love-bank" component={TantraContentLoveBank} />
            <Route path="/tantra/why-she-stopped" component={TantraContentWhySheStopped} />
            <Route path="/tantra/female-orgasm" component={TantraContentFemaleOrgasm} />
            <Route path="/tantra/hormone-health" component={TantraHormoneHealthPathway} />
            <Route path="/interconnected" component={Interconnected} />
            <Route path="/interconnected/thank-you" component={InterconnectedThankYouB} />
            <Route path="/interconnected/thank-you-b" component={InterconnectedThankYouB} />
            <Route path="/interconnected/thank-you-klaviyo" component={InterconnectedThankYouKlaviyo} />
            <Route path="/interconnected/post-purchase-199-klaviyo" component={Interconnected199PostPurchaseKlaviyo} />
            <Route path="/interconnected/thank-you-a" component={InterconnectedThankYou} />
            <Route path="/interconnected/purchased" component={InterconnectedPurchased} />
            <Route path="/interconnected-b" component={InterconnectedB} />
            <Route path="/quiz" component={DiagnosticQuiz} />
              <Route component={HubRedirect} />
            </Switch>
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
