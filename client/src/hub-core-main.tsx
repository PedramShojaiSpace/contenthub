import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { AppProviders } from "./AppProviders";
import HubCoreApp from "./HubCoreApp";
import "./index.css";

const coreBase = window.location.pathname === "/hub/core" || window.location.pathname.startsWith("/hub/core/")
  ? "/hub/core"
  : "/hub";

createRoot(document.getElementById("root")!).render(
  <AppProviders><Router base={coreBase}><HubCoreApp /></Router></AppProviders>,
);
