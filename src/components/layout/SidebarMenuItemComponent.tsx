import React from "react";
import type { LucideIcon } from "lucide-react";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

export interface MenuItemConfig {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export interface SidebarMenuItemComponentProps {
  item: MenuItemConfig;
  isActive: (href: string) => boolean;
}

const BASE_MENU_CLASSES =
  "rounded-none justify-start px-2 py-2 h-10! group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:h-10!";

const ICON_CLASSES = "w-4 h-4 transition-all duration-300 ease-in-out";

const LINK_CLASSES = "flex items-center gap-2 transition-all duration-300 ease-in-out";

const ICON_CONTAINER_CLASSES =
  "w-6 h-6 flex items-center justify-center shrink-0 transition-all duration-300 ease-in-out";

const TEXT_CLASSES =
  "transition-all duration-300 ease-in-out opacity-100 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:overflow-hidden";

export const SidebarMenuItemComponent = React.memo<SidebarMenuItemComponentProps>(({ item, isActive }) => {
  const activeClasses = isActive(item.href)
    ? "bg-primary/10 text-primary border-l-2 border-primary"
    : "hover:bg-accent hover:text-accent-foreground";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild className={`${BASE_MENU_CLASSES} ${activeClasses}`}>
        <a href={item.href} className={LINK_CLASSES}>
          <div className={ICON_CONTAINER_CLASSES}>
            <item.icon className={`${ICON_CLASSES} ${isActive(item.href) ? "text-primary" : ""}`} />
          </div>
          <span className={TEXT_CLASSES}>{item.label}</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});
