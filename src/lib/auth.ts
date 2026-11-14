import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { sendAuthEmail } from "@/lib/email";

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
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const ownerEmail = process.env.SYSTEM_OWNER_EMAIL?.trim().toLowerCase();
      const submittedEmail = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase() : "";
      if (!ownerEmail || submittedEmail !== ownerEmail) {
        throw new APIError("FORBIDDEN", { message: "Public registration is disabled. Contact your system administrator for an account." });
      }
    }),
  },
  emailVerification: {
    sendOnSignUp: !isDevelopment,
    sendOnSignIn: !isDevelopment,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail(user.email, "verify", url);
    }
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: isDevelopment,
    requireEmailVerification: !isDevelopment,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail(user.email, "reset", url);
    }
  },
  // Apply stricter limits to password authentication and registration.
  // Production rate limiting is explicitly enabled; local development remains convenient.
  rateLimit: {
    enabled: !isDevelopment,
    window: 60,
    max: 120,
    storage: "database",
    modelName: "rateLimit",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 60, max: 3 },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 12, cookieCache: { enabled: true, maxAge: 60 * 5 } },
  advanced: {
    trustedProxyHeaders: isDevelopment,
    useSecureCookies: process.env.NODE_ENV === "production",
    database: { joins: true },
  },
});
