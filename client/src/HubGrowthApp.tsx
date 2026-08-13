import { lazy } from "react";
import { Route } from "wouter";
import { HubShell } from "./HubShell";

const UpstreamHome = lazy(() => import("./pages/UpstreamHome"));
const UpstreamRegister = lazy(() => import("./pages/UpstreamRegister"));
const UpstreamOral = lazy(() => import("./pages/UpstreamOral"));
const UpstreamProgram = lazy(() => import("./pages/UpstreamProgram"));
const MetaAds = lazy(() => import("./pages/MetaAds"));
const AdAttributionDashboard = lazy(() => import("./pages/AdAttributionDashboard"));
const CampaignMonitor = lazy(() => import("./pages/CampaignMonitor"));
const HistoricalPosts = lazy(() => import("./pages/HistoricalPosts"));
const RedditPersonas = lazy(() => import("./pages/RedditPersonas"));
const RedditRoas = lazy(() => import("./pages/RedditRoas"));
const YouTubePipeline = lazy(() => import("./pages/YouTubePipeline"));
const SubstackPublisher = lazy(() => import("./pages/SubstackPublisher"));
const SubstackSequence = lazy(() => import("./pages/SubstackSequence"));
const DeepDive = lazy(() => import("./pages/DeepDive"));
const SystemHealth = lazy(() => import("./pages/SystemHealth"));
const FunnelCommand = lazy(() => import("./pages/FunnelCommand"));
const AscensionPipeline = lazy(() => import("./pages/AscensionPipeline"));
const AbTests = lazy(() => import("./pages/AbTests"));
const ClaimsReview = lazy(() => import("./pages/ClaimsReview"));
const YouTubeAnalytics = lazy(() => import("./pages/YouTubeAnalytics"));
const GA4Analytics = lazy(() => import("./pages/GA4Analytics"));
const AnalyzeData = lazy(() => import("./pages/AnalyzeData"));
const TranscriptEngine = lazy(() => import("./pages/TranscriptEngine"));
const CorpusBuilder = lazy(() => import("./pages/CorpusBuilder"));
const PatternExtractor = lazy(() => import("./pages/PatternExtractor"));
const ScriptFactory = lazy(() => import("./pages/ScriptFactory"));
const PerformanceLoop = lazy(() => import("./pages/PerformanceLoop"));
const FunnelEconomics = lazy(() => import("./pages/FunnelEconomics"));
const FunnelAdvisor = lazy(() => import("./pages/FunnelAdvisor"));
const MofContentEngine = lazy(() => import("./pages/MofContentEngine"));

export default function HubGrowthApp() {
  return <HubShell>
    <Route path="/upstream" component={UpstreamHome} />
    <Route path="/upstream/register" component={UpstreamRegister} />
    <Route path="/upstream/oral" component={UpstreamOral} />
    <Route path="/upstream/program" component={UpstreamProgram} />
    <Route path="/meta-ads/:advertorialId" component={MetaAds} />
    <Route path="/meta-ads" component={MetaAds} />
    <Route path="/ad-attribution" component={AdAttributionDashboard} />
    <Route path="/campaign-monitor" component={CampaignMonitor} />
    <Route path="/historical-posts" component={HistoricalPosts} />
    <Route path="/reddit-personas" component={RedditPersonas} />
    <Route path="/reddit-roas" component={RedditRoas} />
    <Route path="/youtube-pipeline" component={YouTubePipeline} />
    <Route path="/substack" component={SubstackPublisher} />
    <Route path="/substack-sequence" component={SubstackSequence} />
    <Route path="/deep-dive" component={DeepDive} />
    <Route path="/system-health" component={SystemHealth} />
    <Route path="/funnels" component={FunnelCommand} />
    <Route path="/ascension" component={AscensionPipeline} />
    <Route path="/ab-tests" component={AbTests} />
    <Route path="/claims-review" component={ClaimsReview} />
    <Route path="/yt-analytics" component={YouTubeAnalytics} />
    <Route path="/ga4-analytics" component={GA4Analytics} />
    <Route path="/analyze" component={AnalyzeData} />
    <Route path="/transcript-engine" component={TranscriptEngine} />
    <Route path="/corpus-builder" component={CorpusBuilder} />
    <Route path="/pattern-extractor" component={PatternExtractor} />
    <Route path="/script-factory" component={ScriptFactory} />
    <Route path="/performance-loop" component={PerformanceLoop} />
    <Route path="/funnel-economics" component={FunnelEconomics} />
    <Route path="/funnel-advisor" component={FunnelAdvisor} />
    <Route path="/mof-content" component={MofContentEngine} />
  </HubShell>;
}
