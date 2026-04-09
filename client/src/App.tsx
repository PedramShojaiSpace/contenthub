import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import CommandCenter from "./pages/CommandCenter";
import CreationStudio from "./pages/CreationStudio";
import AssetLibrary from "./pages/AssetLibrary";
import StrategyBrain from "./pages/StrategyBrain";
import ResearchIntelligence from "./pages/ResearchIntelligence";
import ScriptLibrary from "./pages/ScriptLibrary";
import LandingPageGenerator from "./pages/LandingPageGenerator";
import ChannelWatchlist from "./pages/ChannelWatchlist";
import TypeformIntelligence from "./pages/TypeformIntelligence";
import PressIntelligence from "./pages/PressIntelligence";

function Router() {
  return (
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
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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
