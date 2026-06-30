import { useRouteError, isRouteErrorResponse, Link } from "react-router-dom";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ErrorPage() {
  const error = useRouteError();
  console.error(error);

  let errorMessage = "An unexpected error occurred.";
  if (isRouteErrorResponse(error)) {
    errorMessage = error.data?.message || error.statusText;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#111b21] flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-white dark:bg-[#202c33] p-8 rounded-2xl shadow-sm border border-[#e9edef] dark:border-[#2a3942] max-w-md w-full">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center rounded-full mx-auto mb-6">
          <AlertTriangle size={32} />
        </div>
        <h1 className="text-[24px] font-bold text-[#111] dark:text-white mb-2">Oops! Something went wrong.</h1>
        <p className="text-[#54656f] dark:text-[#aebac1] text-[14px] mb-8 truncate">
          {errorMessage}
        </p>
        <div className="flex flex-col gap-3">
          <Button 
            className="w-full h-12 bg-[#1099A1] hover:bg-[#0d848b] text-white font-bold rounded-xl flex items-center justify-center gap-2"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={18} /> Try Again
          </Button>
          <Link to="/">
            <Button variant="outline" className="w-full h-12 font-bold rounded-xl flex items-center justify-center gap-2">
              <Home size={18} /> Go Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
