import { cn } from "@/lib/utils";

export const sidebarTextAnimation = (
  isCollapsed: boolean,
  additionalClasses: string = ""
) =>
  cn(
    "whitespace-nowrap transition-all duration-300",
    isCollapsed
      ? "opacity-0 translate-x-4 w-0"
      : "opacity-100 translate-x-0 w-auto",
    additionalClasses
  );

export const sidebarIconAnimation = (
  isCollapsed: boolean,
  additionalClasses: string = ""
) =>
  cn(
    "flex-shrink-0 transition-transform duration-300",
    isCollapsed ? "-translate-x-1.5" : "translate-x-0",
    additionalClasses
  );

export const sidebarAvatarAnimation = (
  isCollapsed: boolean,
  additionalClasses: string = ""
) =>
  cn(
    "flex-shrink-0 transition-transform duration-300",
    isCollapsed ? "-translate-x-3" : "translate-x-0",
    additionalClasses
  );
