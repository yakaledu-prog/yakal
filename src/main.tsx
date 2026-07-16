
  import { createRoot } from "react-dom/client";
  import { AppRouter } from "./app/Router.tsx";
  import { GoogleOAuthProvider } from "@react-oauth/google";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import "./styles/index.css";

  const clientId = import.meta.env.VITE_GCP_CLIENT_ID || "";
  const queryClient = new QueryClient();

  createRoot(document.getElementById("root")!).render(
    <GoogleOAuthProvider clientId={clientId}>
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );