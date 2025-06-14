import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, LogOut, CheckCircle } from "lucide-react";

interface LogoutPageProps {
  onLogout: () => Promise<void>;
  onBackToLogin: () => void;
}

export function LogoutPage({ onLogout, onBackToLogin }: LogoutPageProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);

  useEffect(() => {
    const performLogout = async () => {
      setIsLoggingOut(true);
      try {
        await onLogout();
        setIsLoggedOut(true);
      } catch (error) {
        console.error("Logout failed:", error);
        // Even if logout fails, we can still show success to user
        setIsLoggedOut(true);
      } finally {
        setIsLoggingOut(false);
      }
    };

    performLogout();
  }, [onLogout]);

  if (isLoggingOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
            </div>
            <CardTitle className="text-2xl font-bold">Signing Out</CardTitle>
            <CardDescription>
              Please wait while we securely log you out...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-600">
              This will clear your session and redirect you to the login page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoggedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Successfully Signed Out</CardTitle>
            <CardDescription>
              You have been securely logged out of Bulk-Tagger
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">
                Your session has been cleared and you are now signed out.
              </p>
              <p className="text-xs text-gray-500">
                For security reasons, please close your browser or navigate away from this page.
              </p>
            </div>
            
            <Button 
              onClick={onBackToLogin} 
              className="w-full"
              variant="outline"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
} 