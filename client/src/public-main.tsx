import { createRoot } from "react-dom/client";
import { AppProviders } from "./AppProviders";
import PublicApp from "./PublicApp";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <PublicApp />
  </AppProviders>,
);
