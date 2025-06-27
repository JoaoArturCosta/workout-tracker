import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import { env } from "@/env.mjs";

export const authOptions: NextAuthOptions = {
  adapter: SupabaseAdapter({
    url: env.SUPABASE_URL,
    secret: env.SUPABASE_SERVICE_ROLE_KEY,
  }),
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Persist the OAuth access_token and user id to the token right after signin
      if (account && user) {
        token.accessToken = account.access_token;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (token) {
        session.user.id = token.userId as string;
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
    async signIn() {
      // Allow sign in
      return true;
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  events: {
    async signIn({ user }) {
      // Log successful sign in
      console.log(`User ${user.email} signed in`);
    },
    async signOut() {
      // Log sign out
      console.log(`User signed out`);
    },
  },
  debug: env.NODE_ENV === "development",
};

// Types extension for NextAuth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    accessToken?: string;
  }

  interface User {
    id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    accessToken?: string;
  }
}
