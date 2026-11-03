import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
let content = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
function readValue(source, key) {
  const line = source.split(/\r?\n/).find((item) => item.trim().startsWith(key + "="));
  if (!line) return undefined;
  return line.slice(line.indexOf("=") + 1).trim().replace(/^[\"']|[\"']$/g, "");
}
function setValue(source, key, value) {
  const lines = source.split(/\r?\n/);
  const replacement = key + "=" + JSON.stringify(value);
  const index = lines.findIndex((item) => item.trim().startsWith(key + "="));
  if (index >= 0) lines[index] = replacement;
  else lines.push(replacement);
  return lines.join("\n");
}
const codespaceName = process.env.CODESPACE_NAME;
const portDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
const baseUrl = codespaceName && portDomain
  ? "https://" + codespaceName + "-3000." + portDomain
  : "http://localhost:3000";
content = setValue(content, "DATABASE_URL", "postgresql://app_user:codespaces_dev_only_change_me@db:5432/new_host_travel?schema=public");
let secret = readValue(content, "BETTER_AUTH_SECRET");
if (!secret || secret.length < 32 || secret.includes("replace-with-at-least-32-random-characters")) {
  secret = randomBytes(32).toString("base64url");
}
content = setValue(content, "BETTER_AUTH_SECRET", secret);
content = setValue(content, "BETTER_AUTH_URL", baseUrl);
content = setValue(content, "BETTER_AUTH_TRUSTED_ORIGINS", "http://localhost:3000," + baseUrl);
content = setValue(content, "SEED_DEMO_DATA", "false");
writeFileSync(envPath, content.replace(/\n*$/, "\n"), { encoding: "utf8", mode: 0o600 });
console.log("Prepared an ignored .env for this Codespace. No secrets are written to Git.");
