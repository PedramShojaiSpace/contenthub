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

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={CommandCenter} />
      <Route path={"/studio"} component={CreationStudio} />
      <Route path={"/assets"} component={AssetLibrary} />
      <Route path={"/strategy"} component={StrategyBrain} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
