import React from "react";
import { FileText, CheckSquare, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "./ui/sidebar";

interface AppSidebarProps {
  currentUser: {
    id: string;
    email: string | null;
  };
  children?: React.ReactNode;
}

export function AppSidebar({ currentUser, children }: AppSidebarProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-0 h-14 shrink-0">
          <div className="flex items-center justify-start px-2 py-1 h-full">
            <img
              src="/10xcards_logo.svg"
              alt="10x-cards"
              className="h-[32px] w-auto transition-all duration-300 ease-out"
            />
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent className="flex-1 overflow-hidden py-2">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="/generator">
                      <FileText />
                      <span>Generator</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="/candidates">
                      <CheckSquare />
                      <span>Candidates</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-0 py-2 h-24 shrink-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center justify-start gap-2 px-2 py-2 transition-all duration-300 ease-out">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                  {currentUser.email?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0 transition-opacity duration-300 delay-150 ease-out opacity-100 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{currentUser.email || "Unknown"}</p>
                </div>
              </div>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(() => (window.location.href = "/"))}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="h-screen flex flex-col">
        <header className="flex h-10 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 pt-0 pb-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
