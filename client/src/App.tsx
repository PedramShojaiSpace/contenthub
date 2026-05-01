import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";

// Lazy-load all pages to enable code splitting and reduce initial bundle size
const NotFound = lazy(() => import("@/pages/NotFound"));
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const CreationStudio = lazy(() => import("./pages/CreationStudio"));
const AssetLibrary = lazy(() => import("./pages/AssetLibrary"));
const StrategyBrain = lazy(() => import("./pages/StrategyBrain"));
const ResearchIntelligence = lazy(() => import("./pages/ResearchIntelligence"));
const ScriptLibrary = lazy(() => import("./pages/ScriptLibrary"));
const LandingPageGenerator = lazy(() => import("./pages/LandingPageGenerator"));
const ChannelWatchlist = lazy(() => import("./pages/ChannelWatchlist"));
const TypeformIntelligence = lazy(() => import("./pages/TypeformIntelligence"));
const PressIntelligence = lazy(() => import("./pages/PressIntelligence"));
const IntelligenceDashboard = lazy(() => import("./pages/IntelligenceDashboard"));
const MediaVault = lazy(() => import("./pages/MediaVault"));
const AvatarIntelligence = lazy(() => import("./pages/AvatarIntelligence"));
const WebinarBuilder = lazy(() => import("./pages/WebinarBuilder"));
const WebinarIntelligencePage = lazy(() => import("./pages/WebinarIntelligence"));
const LLMProjects = lazy(() => import("./pages/LLMProjects"));
const AvatarRepository = lazy(() => import("./pages/AvatarRepository"));
const WordPressSetup = lazy(() => import("./pages/WordPressSetup"));
const UTMGenerator = lazy(() => import("./pages/UTMGenerator"));
const IngestInbox = lazy(() => import("./pages/IngestInbox"));
const VerifiedLinks = lazy(() => import("./pages/VerifiedLinks"));
const LinkedInNewsfeed = lazy(() => import("./pages/LinkedInNewsfeed"));

// Simple full-screen loading fallback
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path={"/"} component={CommandCenter} />
        <Route path={"/studio"} component={CreationStudio} />
        <Route path={"/assets"} component={AssetLibrary} />
        <Route path={"/strategy"} component={StrategyBrain} />
        <Route path={"/research"} component={ResearchIntelligence} />
        <Route path={"/scripts"} component={ScriptLibrary} />
        <Route path={"/landing-pages"} component={LandingPageGenerator} />
        <Route path={"/channels"} component={ChannelWatchlist} />
        <Route path={"/typeform"} component={TypeformIntelligence} />
        <Route path={"/press"} component={PressIntelligence} />
        <Route path={"/intelligence"} component={IntelligenceDashboard} />
        <Route path={"/media-vault"} component={MediaVault} />
        <Route path={"/avatar"} component={AvatarIntelligence} />
        <Route path={"/webinar"} component={WebinarBuilder} />
        <Route path={"/webinar-intelligence"} component={WebinarIntelligencePage} />
        <Route path={"/avatar-repository"} component={AvatarRepository} />
        <Route path={"/llm-projects"} component={LLMProjects} />
        <Route path={"/wordpress-setup"} component={WordPressSetup} />
        <Route path={"/utm"} component={UTMGenerator} />
        <Route path={"/ingest"} component={IngestInbox} />
        <Route path={"/verified-links"} component={VerifiedLinks} />
        <Route path={"/newsfeed"} component={LinkedInNewsfeed} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
