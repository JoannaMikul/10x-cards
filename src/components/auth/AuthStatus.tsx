import React, { useState } from "react";
import { Button } from "../ui/button";
import { LogOut, User } from "lucide-react";

interface CurrentUser {
  id: string;
  email: string | null;
}

interface AuthStatusProps {
  currentUser: CurrentUser | null;
}

export function AuthStatus({ currentUser }: AuthStatusProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        window.location.href = "/";
      } else {
        // eslint-disable-next-line no-console
        console.error("Logout failed");
        setIsLoggingOut(false);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="sm" asChild>
          <a href="/auth/register">Sign up</a>
        </Button>
        <Button size="sm" asChild>
          <a href="/auth/login">Sign in</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
          {currentUser.email?.charAt(0).toUpperCase() || "U"}
        </div>
        <span className="text-sm font-medium hidden sm:inline-block">{currentUser.email || "Unknown"}</span>
      </div>

      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="sm" asChild>
          <a href="/generator" className="flex items-center">
            <User className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Generator</span>
          </a>
        </Button>

        <Button variant="ghost" size="sm" asChild>
          <a href="/candidates" className="flex items-center">
            <User className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Candidates</span>
          </a>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <LogOut className="mr-1 h-4 w-4" />
          {isLoggingOut ? "..." : ""}
        </Button>
      </div>
    </div>
  );
}
