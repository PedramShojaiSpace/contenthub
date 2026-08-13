import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { AppProviders } from "./AppProviders";
import HubCoreApp from "./HubCoreApp";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AppProviders><Router base="/hub"><HubCoreApp /></Router></AppProviders>,
);
