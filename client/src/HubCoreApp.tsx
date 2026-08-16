import { lazy } from "react";
import { Route } from "wouter";
import { HubShell } from "./HubShell";
import { HubCrossBundleRedirect } from "./components/HubCrossBundleRedirect";

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
const AvatarRepository = lazy(() => import("./pages/AvatarRepository"));
const LLMProjects = lazy(() => import("./pages/LLMProjects"));
const WordPressSetup = lazy(() => import("./pages/WordPressSetup"));
const DefaultChannels = lazy(() => import("./pages/DefaultChannels"));
const UTMGenerator = lazy(() => import("./pages/UTMGenerator"));
const IngestInbox = lazy(() => import("./pages/IngestInbox"));
const VerifiedLinks = lazy(() => import("./pages/VerifiedLinks"));
const LinkedInNewsfeed = lazy(() => import("./pages/LinkedInNewsfeed"));
const ManyChatWizard = lazy(() => import("./pages/ManyChatWizard"));
const BookLibrary = lazy(() => import("./pages/BookLibrary"));
const RedditIntelligence = lazy(() => import("./pages/RedditIntelligence"));
const InterconnectedEmailRevenue = lazy(() => import("./pages/InterconnectedEmailRevenue"));

export default function HubCoreApp() {
  return <HubShell>
    <Route path="/" component={CommandCenter} />
    <Route path="/studio" component={CreationStudio} />
    <Route path="/assets" component={AssetLibrary} />
    <Route path="/strategy" component={StrategyBrain} />
    <Route path="/research" component={ResearchIntelligence} />
    <Route path="/scripts" component={ScriptLibrary} />
    <Route path="/landing-pages" component={LandingPageGenerator} />
    <Route path="/channels" component={ChannelWatchlist} />
    <Route path="/typeform" component={TypeformIntelligence} />
    <Route path="/press" component={PressIntelligence} />
    <Route path="/intelligence" component={IntelligenceDashboard} />
    <Route path="/media-vault" component={MediaVault} />
    <Route path="/avatar" component={AvatarIntelligence} />
    <Route path="/avatar-repository" component={AvatarRepository} />
    <Route path="/llm-projects" component={LLMProjects} />
    <Route path="/wordpress-setup" component={WordPressSetup} />
    <Route path="/default-channels" component={DefaultChannels} />
    <Route path="/utm" component={UTMGenerator} />
    <Route path="/ingest" component={IngestInbox} />
    <Route path="/verified-links" component={VerifiedLinks} />
    <Route path="/newsfeed" component={LinkedInNewsfeed} />
    <Route path="/manychat-wizard" component={ManyChatWizard} />
    <Route path="/book-library" component={BookLibrary} />
    <Route path="/reddit-intelligence" component={RedditIntelligence} />
    <Route path="/interconnected-email-revenue" component={InterconnectedEmailRevenue} />
    <Route component={HubCrossBundleRedirect} />
  </HubShell>;
}
