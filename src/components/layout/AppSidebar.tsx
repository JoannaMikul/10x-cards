import React from "react";
import { FileText, CheckSquare, Users, LogOut } from "lucide-react";
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
} from "../ui/sidebar";

interface AppSidebarProps {
  currentUser: {
    id: string;
    email: string | null;
  };
  children?: React.ReactNode;
}

export function AppSidebar({ currentUser, children }: AppSidebarProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-0 h-14 shrink-0">
          <a
            href="/"
            className="flex items-center justify-start px-2 py-1 h-full transition-all duration-300 ease-in-out"
            aria-label="Go to home page"
          >
            <img
              src="/10xcards_logo.svg"
              alt="10x-cards"
              className="h-[32px] w-auto transition-all duration-300 ease-in-out group-data-[collapsible=icon]:h-[24px]"
            />
          </a>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent className="flex-1 overflow-hidden py-2">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className="justify-start px-2 py-2 h-10!  group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:h-10!"
                  >
                    <a href="/generator" className="flex items-center gap-2 transition-all duration-300 ease-in-out">
                      <div className="w-6 h-6 flex items-center justify-center shrink-0 transition-all duration-300 ease-in-out">
                        <FileText className="w-4 h-4 transition-all duration-300 ease-in-out" />
                      </div>
                      <span className="transition-all duration-300 ease-in-out opacity-100 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:overflow-hidden">
                        Generator
                      </span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className="justify-start px-2 py-2 h-10!  group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:h-10!"
                  >
                    <a href="/candidates" className="flex items-center gap-2 transition-all duration-300 ease-in-out">
                      <div className="w-6 h-6 flex items-center justify-center shrink-0 transition-all duration-300 ease-in-out">
                        <Users className="w-4 h-4 transition-all duration-300 ease-in-out" />
                      </div>
                      <span className="transition-all duration-300 ease-in-out opacity-100 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:overflow-hidden">
                        Candidates
                      </span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className="justify-start px-2 py-2 h-10!  group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:h-10!"
                  >
                    <a href="/flashcards" className="flex items-center gap-2 transition-all duration-300 ease-in-out">
                      <div className="w-6 h-6 flex items-center justify-center shrink-0 transition-all duration-300 ease-in-out">
                        <CheckSquare className="w-4 h-4 transition-all duration-300 ease-in-out" />
                      </div>
                      <span className="transition-all duration-300 ease-in-out opacity-100 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:overflow-hidden">
                        Flashcards
                      </span>
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
              <SidebarMenuButton
                asChild
                className="justify-start px-2 py-2 h-10!  group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:h-10!"
              >
                <div className="flex items-center gap-2 w-full transition-all duration-300 ease-in-out">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ease-in-out">
                    {currentUser.email?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0 transition-all duration-300 ease-in-out opacity-100 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:overflow-hidden">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {currentUser.email || "Unknown"}
                    </p>
                  </div>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="text-red-600 hover:text-red-700 hover:bg-red-50 justify-start px-2 py-2 h-10!  group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:h-10!"
              >
                <button
                  onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(() => (window.location.href = "/"))}
                  className="flex items-center gap-2 w-full transition-all duration-300 ease-in-out"
                >
                  <div className="w-6 h-6 flex items-center justify-center shrink-0 transition-all duration-300 ease-in-out">
                    <LogOut className="w-4 h-4 transition-all duration-300 ease-in-out" />
                  </div>
                  <span className="transition-all duration-300 ease-in-out opacity-100 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:overflow-hidden">
                    Logout
                  </span>
                </button>
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
