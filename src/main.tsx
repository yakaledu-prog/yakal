
  import { createRoot } from "react-dom/client";
  import { AppRouter } from "./app/Router.tsx";
  import { GoogleOAuthProvider } from "@react-oauth/google";
  import "./styles/index.css";

  const clientId = import.meta.env.VITE_GCP_CLIENT_ID || "";

  createRoot(document.getElementById("root")!).render(
    <GoogleOAuthProvider clientId={clientId}>
      <AppRouter />
    </GoogleOAuthProvider>
  );