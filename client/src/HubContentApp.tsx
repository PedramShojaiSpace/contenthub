import { lazy } from "react";
import { Route } from "wouter";
import { HubShell } from "./HubShell";
import { HubCrossBundleRedirect } from "./components/HubCrossBundleRedirect";

const ContentPipeline = lazy(() => import("./pages/ContentPipeline"));
const PodcastProduction = lazy(() => import("./pages/PodcastProduction"));
const PodcastEpisodeViewer = lazy(() => import("./pages/PodcastEpisodeViewer"));
const GuestIntakeForm = lazy(() => import("./pages/GuestIntakeForm"));
const SeoDashboard = lazy(() => import("./pages/SeoDashboard"));
const Scoreboard = lazy(() => import("./pages/Scoreboard"));
const CompetitiveIntelligence = lazy(() => import("./pages/CompetitiveIntelligence"));
const KeywordStrategy = lazy(() => import("./pages/KeywordStrategy"));
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
const BlogImportStudio = lazy(() => import("./pages/BlogImportStudio"));
const KlaviyoFlowOptimizer = lazy(() => import("./pages/KlaviyoFlowOptimizer"));
const KidsResearch = lazy(() => import("./pages/KidsResearch"));
const KidsReview = lazy(() => import("./pages/KidsReview"));
const CollectiveSourcing = lazy(() => import("./pages/CollectiveSourcing"));
const SoroIntelligence = lazy(() => import("./pages/SoroIntelligence"));
const PlainTextEmailGenerator = lazy(() => import("./pages/PlainTextEmailGenerator"));
const VATaskHub = lazy(() => import("./pages/VATaskHub"));
const KajabiLiveHub = lazy(() => import("./pages/KajabiLiveHub"));
const AdvertorialBuilder = lazy(() => import("./pages/AdvertorialBuilder"));
const WebinarBuilder = lazy(() => import("./pages/WebinarBuilder"));
const WebinarIntelligencePage = lazy(() => import("./pages/WebinarIntelligence"));
const ViralStudio = lazy(() => import("./pages/ViralStudio"));
const VideoVariantFactory = lazy(() => import("./pages/VideoVariantFactory"));
const VideoProductionSession = lazy(() => import("./pages/VideoProductionSession"));
const EBookGenerator = lazy(() => import("./pages/EBookGenerator"));

export default function HubContentApp() {
  return <HubShell>
    <Route path="/content-pipeline" component={ContentPipeline} />
    <Route path="/podcast-production" component={PodcastProduction} />
    <Route path="/podcast-production/:id" component={PodcastEpisodeViewer} />
    <Route path="/podcast-intake/:token" component={GuestIntakeForm} />
    <Route path="/seo" component={SeoDashboard} />
    <Route path="/scoreboard" component={Scoreboard} />
    <Route path="/competitive-intelligence" component={CompetitiveIntelligence} />
    <Route path="/keyword-strategy" component={KeywordStrategy} />
    <Route path="/ch-pages" component={LandingPageBuilder} />
    <Route path="/qr-generator" component={QrGenerator} />
    <Route path="/backlink-outreach" component={BacklinkOutreach} />
    <Route path="/video-to-blog" component={VideoToBlog} />
    <Route path="/blog-to-youtube" component={BlogToYoutube} />
    <Route path="/review-queue" component={ReviewQueue} />
    <Route path="/ask-urban-monk" component={AskUrbanMonk} />
    <Route path="/presence-assessment" component={PresenceAssessment} />
    <Route path="/syndication" component={SyndicationQueue} />
    <Route path="/va" component={VADashboard} />
    <Route path="/ads" component={AdsManager} />
    <Route path="/lead-scrubber" component={LeadScrubber} />
    <Route path="/email-optimizer" component={EmailOptimizer} />
    <Route path="/blog-importer" component={BlogImportStudio} />
    <Route path="/klaviyo-flow-optimizer" component={KlaviyoFlowOptimizer} />
    <Route path="/kids-research" component={KidsResearch} />
    <Route path="/kids-review" component={KidsReview} />
    <Route path="/collective-sourcing" component={CollectiveSourcing} />
    <Route path="/soro-intelligence" component={SoroIntelligence} />
    <Route path="/plain-text-email" component={PlainTextEmailGenerator} />
    <Route path="/va-tasks" component={VATaskHub} />
    <Route path="/kajabi-live" component={KajabiLiveHub} />
    <Route path="/advertorial-builder" component={AdvertorialBuilder} />
    <Route path="/webinar" component={WebinarBuilder} />
    <Route path="/webinar-intelligence" component={WebinarIntelligencePage} />
    <Route path="/viral-studio" component={ViralStudio} />
    <Route path="/video-variants" component={VideoVariantFactory} />
    <Route path="/video-production" component={VideoProductionSession} />
    <Route path="/ebook-generator" component={EBookGenerator} />
    <Route component={HubCrossBundleRedirect} />
  </HubShell>;
}
