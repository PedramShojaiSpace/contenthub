import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import App from "./App";
import { AppProviders } from "./AppProviders";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <Router base="/hub">
      <App />
    </Router>
  </AppProviders>,
);
