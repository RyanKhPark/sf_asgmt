import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

export const authConfig = {
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    authorized({ auth }) {
      const isLoggedIn = !!auth?.user;
      const isOnProtectedRoute = false; // For now, no protected routes since users can visit home

      if (isOnProtectedRoute) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        return true;
      }
      return true; // Allow access to all routes for now
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // For now, we'll implement a basic check
        // Later this will be replaced with database lookup
        const user = {
          id: "1",
          email: credentials.email as string,
          name: "User",
        };

        return user;
      },
    }),
  ],
} satisfies NextAuthConfig;
