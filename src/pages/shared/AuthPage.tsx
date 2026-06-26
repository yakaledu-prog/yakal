import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { userService } from "@/services/userService";

type RoleType = "admin" | "tutor" | "student" | "parent";

export function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const handleLogin = async (role: RoleType) => {
    setLoading(role);
    try {
      // Simulate network request
      await userService.getCurrentUser(role);
      // In a real app we'd set Auth Context here. 
      // For now, simply navigate to their respective dashboard route.
      navigate(`/${role}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <img src="/src/assets/images/logo.webp" alt="Yakal" className="h-12 object-contain" />
          </div>
          <CardTitle className="text-2xl">Welcome to Yakal</CardTitle>
          <CardDescription>Select a demo role to view the dashboard</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button 
            variant="outline" 
            className="h-14 justify-start px-6"
            onClick={() => handleLogin("admin")}
            disabled={!!loading}
          >
            <div className="flex flex-col items-start">
              <span className="font-semibold">Admin Portal</span>
              <span className="text-xs text-muted-foreground font-normal">Manage platform and users</span>
            </div>
            {loading === "admin" && <span className="ml-auto animate-pulse">Loading...</span>}
          </Button>
          
          <Button 
            variant="outline" 
            className="h-14 justify-start px-6"
            onClick={() => handleLogin("tutor")}
            disabled={!!loading}
          >
            <div className="flex flex-col items-start">
              <span className="font-semibold">Tutor Portal</span>
              <span className="text-xs text-muted-foreground font-normal">Manage sessions and students</span>
            </div>
            {loading === "tutor" && <span className="ml-auto animate-pulse">Loading...</span>}
          </Button>
          
          <Button 
            variant="outline" 
            className="h-14 justify-start px-6"
            onClick={() => handleLogin("student")}
            disabled={!!loading}
          >
            <div className="flex flex-col items-start">
              <span className="font-semibold">Student Portal</span>
              <span className="text-xs text-muted-foreground font-normal">View tasks and learning progress</span>
            </div>
            {loading === "student" && <span className="ml-auto animate-pulse">Loading...</span>}
          </Button>

          <Button 
            variant="outline" 
            className="h-14 justify-start px-6"
            onClick={() => handleLogin("parent")}
            disabled={!!loading}
          >
            <div className="flex flex-col items-start">
              <span className="font-semibold">Parent Portal</span>
              <span className="text-xs text-muted-foreground font-normal">Monitor children and billing</span>
            </div>
            {loading === "parent" && <span className="ml-auto animate-pulse">Loading...</span>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
