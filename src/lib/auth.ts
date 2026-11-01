import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

const secret = process.env.BETTER_AUTH_SECRET;
if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
  throw new Error("BETTER_AUTH_SECRET must be configured with at least 32 characters in production.");
}

const isDevelopment = process.env.NODE_ENV !== "production";
const configuredOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// In Codespaces the browser uses https://<codespace>-3000.app.github.dev,
// while the app runs behind GitHub's reverse proxy. Resolve the public host
// per request instead of trusting a stale .env URL or an internal container host.
const authBaseURL = isDevelopment
  ? {
      allowedHosts: ["*.app.github.dev", "localhost:*", "127.0.0.1:*"],
      protocol: "auto" as const,
      fallback: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    }
  : process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  appName: "New Host Travel System",
  baseURL: authBaseURL,
  secret: secret ?? "local-development-only-secret-change-before-deploy-2026",
  trustedOrigins: [
    ...configuredOrigins,
    ...(isDevelopment ? ["https://*.app.github.dev"] : []),
  ],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, requireEmailVerification: false, minPasswordLength: 12, maxPasswordLength: 128 },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 12, cookieCache: { enabled: true, maxAge: 60 * 5 } },
  advanced: {
    trustedProxyHeaders: isDevelopment,
    useSecureCookies: process.env.NODE_ENV === "production",
    database: { joins: true },
  },
});
