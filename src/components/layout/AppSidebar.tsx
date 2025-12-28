import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FileText, CheckSquare, Users, RotateCcw, LogOut, BarChart3, Settings } from "lucide-react";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { SidebarMenuItemComponent, type MenuItemConfig } from "./SidebarMenuItemComponent";
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

const MENU_ITEMS: MenuItemConfig[] = [
  { href: "/generator", label: "Generator", icon: FileText },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/flashcards", label: "Flashcards", icon: CheckSquare },
  { href: "/reviews", label: "Reviews", icon: RotateCcw },
  { href: "/admin/kpi", label: "Admin KPI", icon: BarChart3, adminOnly: true },
  { href: "/admin/categories", label: "Category", icon: Settings, adminOnly: true },
];

export const AppSidebar = React.memo<AppSidebarProps>(({ currentUser, children }) => {
  const { isAdmin } = useIsAdmin();
  const [currentPath, setCurrentPath] = useState("");

  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  const isActive = useCallback((href: string) => currentPath === href, [currentPath]);

  const visibleMenuItems = useMemo(() => MENU_ITEMS.filter((item) => !item.adminOnly || isAdmin), [isAdmin]);

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
                {visibleMenuItems.map((item) => (
                  <SidebarMenuItemComponent key={item.href} item={item} isActive={isActive} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-0 py-2 h-24 shrink-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="rounded-none justify-start px-2 py-2 h-10!  group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:h-10!"
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
                className="rounded-none text-red-600 hover:text-red-700 hover:bg-red-50 justify-start px-2 py-2 h-10!  group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:h-10!"
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
});
