import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers: [GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID ?? "not-configured",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "not-configured"
  })],
  callbacks: {
    async session({ session, token }) {
      if (session.user) session.user.id = String(token.sub ?? "");
      return session;
    }
  }
};
