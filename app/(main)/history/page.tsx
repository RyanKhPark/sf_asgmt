"use client";

import { useAuthGuard } from "@/hooks/use-auth-guard";
import { AuthModal } from "@/components/auth/auth-modal";
import { useEffect } from "react";

export default function HistoryPage() {
  const { requireAuth, showAuthModal, setShowAuthModal, isAuthenticated } = useAuthGuard();

  useEffect(() => {
    requireAuth();
  }, []);

  if (!isAuthenticated) {
    return (
      <>
        <div className="p-6 flex items-center justify-center h-full">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">History Library</h1>
            <p className="text-gray-600 mb-4">Sign in to view your chat history</p>
          </div>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          mode="signin"
        />
      </>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">History Library</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* History Card list */}
        <p className="text-gray-500">Your chat history will appear here.</p>
      </div>
    </div>
  );
}
