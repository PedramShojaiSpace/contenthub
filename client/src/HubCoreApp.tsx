import { lazy } from "react";
import { Route } from "wouter";
import { HubShell } from "./HubShell";

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
const AvatarRepository = lazy(() => import("./pages/AvatarRepository"));
const LLMProjects = lazy(() => import("./pages/LLMProjects"));
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
    <Route path="/webinar" component={WebinarBuilder} />
    <Route path="/webinar-intelligence" component={WebinarIntelligencePage} />
    <Route path="/avatar-repository" component={AvatarRepository} />
    <Route path="/llm-projects" component={LLMProjects} />
    <Route path="/wordpress-setup" component={WordPressSetup} />
    <Route path="/default-channels" component={DefaultChannels} />
    <Route path="/utm" component={UTMGenerator} />
    <Route path="/ingest" component={IngestInbox} />
    <Route path="/verified-links" component={VerifiedLinks} />
    <Route path="/newsfeed" component={LinkedInNewsfeed} />
    <Route path="/viral-studio" component={ViralStudio} />
    <Route path="/video-variants" component={VideoVariantFactory} />
    <Route path="/video-production" component={VideoProductionSession} />
    <Route path="/manychat-wizard" component={ManyChatWizard} />
    <Route path="/book-library" component={BookLibrary} />
    <Route path="/ebook-generator" component={EBookGenerator} />
    <Route path="/reddit-intelligence" component={RedditIntelligence} />
  </HubShell>;
}
