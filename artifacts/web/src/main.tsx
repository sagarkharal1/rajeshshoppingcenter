import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerPwaServiceWorker } from "./lib/pwa";
import { ErrorBoundary } from "@/components/error-boundary";

registerPwaServiceWorker();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
