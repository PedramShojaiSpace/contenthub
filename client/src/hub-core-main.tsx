import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { AppProviders } from "./AppProviders";
import HubCoreApp from "./HubCoreApp";
import { getHubCoreRouteBase } from "./lib/hubCoreRouteBase";
import "./index.css";

const coreBase = getHubCoreRouteBase(window.location.pathname);

createRoot(document.getElementById("root")!).render(
  <AppProviders><Router base={coreBase}><HubCoreApp /></Router></AppProviders>,
);
