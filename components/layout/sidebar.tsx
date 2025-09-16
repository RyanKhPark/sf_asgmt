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
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { AuthModal } from "@/components/auth/auth-modal";
import {
  sidebarTextAnimation,
  sidebarIconAnimation,
  sidebarAvatarAnimation,
} from "@/lib/sidebar-animations";

const menuItems = [
  {
    label: "History",
    href: "#",
    icon: BookOpen,
  },
];

export default function HomeSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { data: session } = useSession();
  const [recentDocs, setRecentDocs] = useState<
    Array<{
      id: string;
      title: string;
      uploadedAt: string;
      processingStatus: string | null;
      totalPages: number | null;
    }>
  >([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

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

  // Load recent documents for logged-in users
  useEffect(() => {
    const loadRecent = async () => {
      if (!session?.user?.id) {
        setRecentDocs([]);
        return;
      }
      setLoadingDocs(true);
      try {
        const res = await fetch("/api/documents?limit=10");
        if (res.ok) {
          const data = await res.json();
          setRecentDocs(data.documents || []);
        } else {
          setRecentDocs([]);
        }
      } catch (error) {
        console.error("Failed to load recent documents:", error);
        setRecentDocs([]);
      } finally {
        setLoadingDocs(false);
      }
    };
    loadRecent();
  }, [session?.user?.id]);

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-border transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center px-4 h-14 border-b border-border">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="overflow-hidden">
            <Link href="/" className="flex items-center gap-2">
              <h1
                className={sidebarTextAnimation(
                  isCollapsed,
                  "text-2xl font-semibold"
                )}
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
                      // Show auth modal when logged out
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
                      className={sidebarTextAnimation(
                        isCollapsed,
                        "text-sm font-medium"
                      )}
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
                      className={sidebarTextAnimation(
                        isCollapsed,
                        "text-sm font-medium"
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                </Link>
              )}
            </li>
          ))}
          {session && (
            <li className="mt-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground px-3 mb-2">
                Recent PDFs
              </div>
              {loadingDocs ? (
                <div className="px-3 py-1 text-xs text-muted-foreground">
                  Loading…
                </div>
              ) : recentDocs.length === 0 ? (
                <div className="px-3 py-1 text-sm text-muted-foreground">
                  Try your first!.
                </div>
              ) : (
                <ul className="space-y-1">
                  {recentDocs.map((doc, idx) => (
                    <li key={doc.id}>
                      <Link
                        href={`/pdfchat/${doc.id}`}
                        className={cn(
                          "w-full flex items-center px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-left min-w-0",
                          pathname === `/pdfchat/${doc.id}` &&
                            "bg-sidebar-accent"
                        )}
                        title={doc.title}
                      >
                        <span className="text-sm truncate max-w-full">
                          {idx === 0 ? `• ${doc.title}` : doc.title}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )}
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
                className={sidebarAvatarAnimation(
                  isCollapsed,
                  "w-8 h-8 border border-black rounded-full flex items-center justify-center text-black text-sm font-semibold"
                )}
              >
                {session.user?.name?.[0] || session.user?.email?.[0] || "U"}
              </div>
              <div className="overflow-hidden ml-3 flex flex-col items-start">
                <div
                  className={sidebarTextAnimation(
                    isCollapsed,
                    "text-sm font-medium"
                  )}
                >
                  {session.user?.name || "User"}
                </div>
                <div
                  className={sidebarTextAnimation(
                    isCollapsed,
                    "text-xs text-muted-foreground"
                  )}
                >
                  {session.user?.email}
                </div>
              </div>
              <div className="overflow-hidden ml-auto">
                <ChevronRightIcon
                  className={sidebarTextAnimation(
                    isCollapsed,
                    "size-4 flex-shrink-0"
                  )}
                />
              </div>
            </>
          ) : (
            <>
              <div
                className={sidebarAvatarAnimation(
                  isCollapsed,
                  "w-8 h-8 border border-black rounded-full flex items-center justify-center text-black text-sm"
                )}
              >
                <LogIn className="size-4" />
              </div>
              <div className="overflow-hidden ml-3 flex flex-col items-start">
                <div
                  className={sidebarTextAnimation(
                    isCollapsed,
                    "text-sm font-medium"
                  )}
                >
                  Sign In
                </div>
                <div
                  className={sidebarTextAnimation(
                    isCollapsed,
                    "text-xs text-muted-foreground"
                  )}
                >
                  Get started
                </div>
              </div>
              <div className="overflow-hidden ml-auto">
                <ChevronRightIcon
                  className={sidebarTextAnimation(
                    isCollapsed,
                    "size-4 flex-shrink-0"
                  )}
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
