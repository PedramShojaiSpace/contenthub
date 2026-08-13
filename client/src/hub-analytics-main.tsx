import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { AppProviders } from "./AppProviders";
import HubAnalyticsApp from "./HubAnalyticsApp";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AppProviders><Router base="/hub/analytics"><HubAnalyticsApp /></Router></AppProviders>,
);
