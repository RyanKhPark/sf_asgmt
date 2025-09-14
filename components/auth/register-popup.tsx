"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { AuthModal } from "./auth-modal";

export function RegisterPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    if (!session && !isDismissed) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000); // Show after 3 seconds

      return () => clearTimeout(timer);
    }
  }, [session, isDismissed]);

  const handleClose = () => {
    setIsVisible(false);
    setIsDismissed(true);
  };

  const handleEmailSignUp = () => {
    setShowAuthModal(true);
    setIsVisible(false);
  };

  const handleGoogleSignUp = () => {
    signIn("google", { callbackUrl: "/" });
    setIsVisible(false);
  };

  if (session || !isVisible) {
    return null;
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        >
          <X className="size-4" />
        </button>

        <div className="pr-6">
          <h3 className="font-semibold text-sm mb-1">
            Get started for free!
          </h3>
          <p className="text-xs text-gray-600 mb-3">
            Sign up to save your chat history and access premium features.
          </p>
          <div className="space-y-2">
            <Button
              onClick={handleGoogleSignUp}
              size="sm"
              className="w-full"
            >
              Continue with Google
            </Button>
            <Button
              onClick={handleEmailSignUp}
              size="sm"
              variant="outline"
              className="w-full"
            >
              Continue with Email
            </Button>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode="signup"
      />
    </>
  );
}