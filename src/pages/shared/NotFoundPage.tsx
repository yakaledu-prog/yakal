import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <div className="mb-8 flex items-center justify-center">
        <img src="/src/assets/images/logo.webp" alt="Yakal" className="h-32 object-contain" />
      </div>

      <h1 className="text-6xl sm:text-8xl font-bold text-primary mb-4">404</h1>
      <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4">Page Not Found</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        Sorry, the page you're looking for doesn't exist or has been moved.
      </p>

      <Button
        onClick={() => navigate(-1)}
        className="px-8 h-12 text-lg"
      >
        Go Back
      </Button>
    </div>
  );
}
