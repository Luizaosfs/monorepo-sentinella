import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/hooks/useTheme";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initSentry } from "@/lib/sentry";
import App from "./App.tsx";
import "./index.css";

// QW-19: inicializa Sentry antes de montar a árvore React.
// Inativo se VITE_SENTRY_DSN não estiver configurado.
initSentry();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </ErrorBoundary>
);
