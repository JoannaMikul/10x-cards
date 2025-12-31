import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

interface AuthLayoutCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function AuthLayoutCard({ title, description, children }: AuthLayoutCardProps) {
  return (
    <Card className="w-full max-w-md mx-auto" data-testid="auth-layout-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
