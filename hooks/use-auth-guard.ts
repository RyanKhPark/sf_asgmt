"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";

export function useAuthGuard() {
  const { data: session, status } = useSession();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const requireAuth = (callback?: () => void) => {
    if (status === "loading") return false;

    if (!session) {
      setShowAuthModal(true);
      return false;
    }

    if (callback) callback();
    return true;
  };

  return {
    session,
    status,
    showAuthModal,
    setShowAuthModal,
    requireAuth,
    isAuthenticated: !!session,
  };
}