import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { AppProviders } from "./AppProviders";
import HubGrowthApp from "./HubGrowthApp";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AppProviders><Router base="/hub/growth"><HubGrowthApp /></Router></AppProviders>,
);
