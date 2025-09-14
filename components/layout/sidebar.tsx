"use client";

import Link from "next/link";
import {
  BookOpen,
  PanelLeftCloseIcon,
  PanelLeftIcon,
  ChevronRightIcon,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { AuthModal } from "@/components/auth/auth-modal";
import { sidebarTextAnimation, sidebarIconAnimation, sidebarAvatarAnimation } from "@/lib/sidebar-animations";

const menuItems = [
  {
    label: "History",
    href: "/history",
    icon: BookOpen,
  },
];

export default function HomeSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { data: session } = useSession();

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleAuthClick = () => {
    if (session) {
      signOut();
    } else {
      setShowAuthModal(true);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-border transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center px-4 py-4 border-b border-border min-h-[73px]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="overflow-hidden">
            <Link href="/" className="flex items-center gap-2">
              <h1
                className={sidebarTextAnimation(isCollapsed, "text-2xl font-semibold")}
              >
                pdfChat
              </h1>
            </Link>
          </div>
        </div>
        <button
          className="p-2 hover:bg-sidebar-accent rounded transition-colors flex-shrink-0"
          onClick={toggleSidebar}
          type="button"
        >
          {isCollapsed ? (
            <PanelLeftIcon className="size-4" />
          ) : (
            <PanelLeftCloseIcon className="size-4" />
          )}
        </button>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 px-4 py-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.label}>
              {item.label === "History" ? (
                <button
                  onClick={() => {
                    if (session) {
                      window.location.href = item.href;
                    } else {
                      setShowAuthModal(true);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left",
                    pathname === item.href && "bg-sidebar-accent"
                  )}
                >
                  <item.icon
                    className={sidebarIconAnimation(isCollapsed, "size-5")}
                  />
                  <div className="overflow-hidden ml-3">
                    <span
                      className={sidebarTextAnimation(isCollapsed, "text-sm font-medium")}
                    >
                      {item.label}
                    </span>
                  </div>
                </button>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors",
                    pathname === item.href && "bg-sidebar-accent"
                  )}
                >
                  <item.icon
                    className={sidebarIconAnimation(isCollapsed, "size-5")}
                  />
                  <div className="overflow-hidden ml-3">
                    <span
                      className={sidebarTextAnimation(isCollapsed, "text-sm font-medium")}
                    >
                      {item.label}
                    </span>
                  </div>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer - User Profile */}
      <div className="border-t border-border p-4">
        <button
          className="w-full flex items-center px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors"
          onClick={handleAuthClick}
        >
          {session ? (
            <>
              <div
                className={sidebarAvatarAnimation(isCollapsed, "w-8 h-8 border border-black rounded-full flex items-center justify-center text-black text-sm font-semibold")}
              >
                {session.user?.name?.[0] || session.user?.email?.[0] || "U"}
              </div>
              <div className="overflow-hidden ml-3 flex flex-col items-start">
                <div
                  className={sidebarTextAnimation(isCollapsed, "text-sm font-medium")}
                >
                  {session.user?.name || "User"}
                </div>
                <div
                  className={sidebarTextAnimation(isCollapsed, "text-xs text-muted-foreground")}
                >
                  {session.user?.email}
                </div>
              </div>
              <div className="overflow-hidden ml-auto">
                <ChevronRightIcon
                  className={sidebarTextAnimation(isCollapsed, "size-4 flex-shrink-0")}
                />
              </div>
            </>
          ) : (
            <>
              <div
                className={sidebarAvatarAnimation(isCollapsed, "w-8 h-8 border border-black rounded-full flex items-center justify-center text-black text-sm")}
              >
                <LogIn className="size-4" />
              </div>
              <div className="overflow-hidden ml-3 flex flex-col items-start">
                <div
                  className={sidebarTextAnimation(isCollapsed, "text-sm font-medium")}
                >
                  Sign In
                </div>
                <div
                  className={sidebarTextAnimation(isCollapsed, "text-xs text-muted-foreground")}
                >
                  Get started
                </div>
              </div>
              <div className="overflow-hidden ml-auto">
                <ChevronRightIcon
                  className={sidebarTextAnimation(isCollapsed, "size-4 flex-shrink-0")}
                />
              </div>
            </>
          )}
        </button>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode="signin"
      />
    </div>
  );
}
