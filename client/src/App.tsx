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
const DefaultChannels = lazy(() => import("./pages/DefaultChannels"));
const UTMGenerator = lazy(() => import("./pages/UTMGenerator"));
const IngestInbox = lazy(() => import("./pages/IngestInbox"));
const VerifiedLinks = lazy(() => import("./pages/VerifiedLinks"));
const LinkedInNewsfeed = lazy(() => import("./pages/LinkedInNewsfeed"));
const ViralStudio = lazy(() => import("./pages/ViralStudio"));
const VideoVariantFactory = lazy(() => import("./pages/VideoVariantFactory"));
const VideoProductionSession = lazy(() => import("./pages/VideoProductionSession"));
const ManyChatWizard = lazy(() => import("./pages/ManyChatWizard"));
const BookLibrary = lazy(() => import("./pages/BookLibrary"));
const EBookGenerator = lazy(() => import("./pages/EBookGenerator"));
const RedditIntelligence = lazy(() => import("./pages/RedditIntelligence"));
const ContentPipeline = lazy(() => import("./pages/ContentPipeline"));
const PodcastProduction = lazy(() => import("./pages/PodcastProduction"));
const PodcastEpisodeViewer = lazy(() => import("./pages/PodcastEpisodeViewer"));
const GuestIntakeForm = lazy(() => import("./pages/GuestIntakeForm"));
const SeoDashboard = lazy(() => import("./pages/SeoDashboard"));
const CompetitiveIntelligence = lazy(() => import("./pages/CompetitiveIntelligence"));
const KeywordStrategy = lazy(() => import("./pages/KeywordStrategy"));
const Scoreboard = lazy(() => import("./pages/Scoreboard"));
const LandingPageBuilder = lazy(() => import("./pages/LandingPageBuilder"));
const QrGenerator = lazy(() => import("./pages/QrGenerator"));
const BacklinkOutreach = lazy(() => import("./pages/BacklinkOutreach"));
const VideoToBlog = lazy(() => import("./pages/VideoToBlog"));
const BlogToYoutube = lazy(() => import("./pages/BlogToYoutube"));
const ReviewQueue = lazy(() => import("./pages/ReviewQueue"));
const AskUrbanMonk = lazy(() => import("./pages/AskUrbanMonk"));
const PresenceAssessment = lazy(() => import("./pages/PresenceAssessment"));
const SyndicationQueue = lazy(() => import("./pages/SyndicationQueue"));
const VADashboard = lazy(() => import("./pages/VADashboard"));
const AdsManager = lazy(() => import("./pages/AdsManager"));
const LeadScrubber = lazy(() => import("./pages/LeadScrubber"));
const EmailOptimizer = lazy(() => import("./pages/EmailOptimizer"));

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
        <Route path={"/default-channels"} component={DefaultChannels} />
        <Route path={"/utm"} component={UTMGenerator} />
        <Route path={"/ingest"} component={IngestInbox} />
        <Route path={"/verified-links"} component={VerifiedLinks} />
        <Route path={"/newsfeed"} component={LinkedInNewsfeed} />
        <Route path={"/viral-studio"} component={ViralStudio} />
        <Route path={"/video-variants"} component={VideoVariantFactory} />
        <Route path={"/video-production"} component={VideoProductionSession} />
        <Route path={"/manychat-wizard"} component={ManyChatWizard} />
        <Route path={"/book-library"} component={BookLibrary} />
        <Route path={"/ebook-generator"} component={EBookGenerator} />
        <Route path={"/reddit-intelligence"} component={RedditIntelligence} />
        <Route path={"/content-pipeline"} component={ContentPipeline} />
        <Route path={"/podcast-production"} component={PodcastProduction} />
        <Route path={"/podcast-production/:id"} component={PodcastEpisodeViewer} />
        <Route path={"/podcast-intake/:token"} component={GuestIntakeForm} />
        <Route path={"/seo"} component={SeoDashboard} />
        <Route path={"/scoreboard"} component={Scoreboard} />
        <Route path={"/competitive-intelligence"} component={CompetitiveIntelligence} />
        <Route path={"/keyword-strategy"} component={KeywordStrategy} />
        <Route path={"/ch-pages"} component={LandingPageBuilder} />
        <Route path={"/qr-generator"} component={QrGenerator} />
        <Route path={"/backlink-outreach"} component={BacklinkOutreach} />
        <Route path={"/video-to-blog"} component={VideoToBlog} />
        <Route path={"/blog-to-youtube"} component={BlogToYoutube} />
        <Route path={"/review-queue"} component={ReviewQueue} />
        <Route path={"/ask-urban-monk"} component={AskUrbanMonk} />
        <Route path={"/presence-assessment"} component={PresenceAssessment} />
        <Route path={"/syndication"} component={SyndicationQueue} />
        <Route path={"/va"} component={VADashboard} />
        <Route path={"/ads"} component={AdsManager} />
        <Route path={"/lead-scrubber"} component={LeadScrubber} />
        <Route path={"/email-optimizer"} component={EmailOptimizer} />
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
