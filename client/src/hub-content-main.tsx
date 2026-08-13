import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { AppProviders } from "./AppProviders";
import HubContentApp from "./HubContentApp";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AppProviders><Router base="/hub/content"><HubContentApp /></Router></AppProviders>,
);
