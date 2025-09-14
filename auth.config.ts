import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { env, validateAuthConfig } from "@/lib/env";
import type { AuthUser } from "@/types/auth";

// Validate environment on startup
validateAuthConfig();

export const authConfig = {
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      // Define protected routes
      const protectedRoutes = ["/history", "/profile"];
      const isOnProtectedRoute = protectedRoutes.some(route =>
        pathname.startsWith(route)
      );

      if (isOnProtectedRoute && !isLoggedIn) {
        return false; // Redirect to sign in
      }

      return true;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        // Add provider info to session if available
        if (token.provider) {
          (session.user as any).provider = token.provider;
        }
      }
      return session;
    },
    jwt({ token, user, account }) {
      if (user) {
        token.provider = account?.provider;
      }
      return token;
    },
  },
  providers: [
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                prompt: "consent",
                access_type: "offline",
                response_type: "code",
              },
            },
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<AuthUser | null> {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required");
        }

        try {
          // TODO: Replace with database lookup
          // const user = await getUserByEmail(credentials.email);
          // if (!user || !await bcrypt.compare(credentials.password, user.password)) {
          //   throw new Error("Invalid credentials");
          // }

          // Temporary implementation for testing
          console.log("🔒 Authentication attempt:", credentials.email);

          return {
            id: Date.now().toString(),
            email: credentials.email as string,
            name: "Test User",
            provider: "credentials",
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;
