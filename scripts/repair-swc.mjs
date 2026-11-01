import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextPackagePath = path.join(root, "node_modules", "next", "package.json");
const packageName = "@next/swc-linux-x64-gnu";
const packageDirectory = path.join(root, "node_modules", "@next", "swc-linux-x64-gnu");
const binaryPath = path.join(packageDirectory, "next-swc.linux-x64-gnu.node");
const minimumExpectedBytes = 80 * 1024 * 1024;

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with code ${result.status ?? "unknown"}`);
  }
}

function probeNativeBinding() {
  const result = spawnSync(
    process.execPath,
    ["-e", `require(${JSON.stringify(packageName)})`],
    { cwd: root, encoding: "utf8", stdio: "pipe" }
  );

  return {
    ok: result.status === 0 && result.signal === null,
    status: result.status,
    signal: result.signal,
    output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
  };
}

if (process.platform !== "linux" || process.arch !== "x64" ||
    !process.report?.getReport?.().header?.glibcVersionRuntime) {
  console.log("[swc-repair] Skipped: this repair targets Linux x64 with glibc (GitHub Codespaces).");
  process.exit(0);
}

if (!existsSync(nextPackagePath)) {
  throw new Error("Next.js is not installed. Run npm install before this repair.");
}

const nextVersion = JSON.parse(readFileSync(nextPackagePath, "utf8")).version;
const installedBytes = existsSync(binaryPath) ? statSync(binaryPath).size : 0;
const currentProbe = installedBytes >= minimumExpectedBytes
  ? probeNativeBinding()
  : { ok: false, status: null, signal: null, output: "Native file is missing or unexpectedly small." };

if (currentProbe.ok) {
  console.log(`[swc-repair] SWC ${nextVersion} is present and loads successfully (${Math.round(installedBytes / 1024 / 1024)} MiB).`);
  process.exit(0);
}

console.error("[swc-repair] The installed GNU SWC binary is incomplete or cannot be loaded.");
console.error(`[swc-repair] Current file size: ${Math.round(installedBytes / 1024 / 1024)} MiB; expected at least 80 MiB for this package line.`);
if (currentProbe.signal) console.error(`[swc-repair] Load probe ended with signal: ${currentProbe.signal}`);
if (currentProbe.output) console.error(currentProbe.output);

console.log("[swc-repair] Clearing npm's cached package data and reinstalling the exact SWC version from the official npm registry...");
rmSync(packageDirectory, { recursive: true, force: true });
run("npm", ["cache", "clean", "--force"]);
run("npm", [
  "install",
  "--no-save",
  "--force",
  "--prefer-online",
  "--registry=https://registry.npmjs.org",
  `${packageName}@${nextVersion}`,
]);

if (!existsSync(binaryPath)) {
  throw new Error("SWC reinstall completed but the GNU native binary is still missing.");
}

const repairedBytes = statSync(binaryPath).size;
if (repairedBytes < minimumExpectedBytes) {
  throw new Error(`The downloaded SWC binary is still too small (${repairedBytes} bytes). Check the Codespaces network or npm registry proxy.`);
}

const repairedProbe = probeNativeBinding();
if (!repairedProbe.ok) {
  if (repairedProbe.signal) {
    throw new Error(`The repaired SWC binary still exits with ${repairedProbe.signal}. ${repairedProbe.output}`);
  }
  throw new Error(`The repaired SWC binary could not be loaded (exit code ${repairedProbe.status}). ${repairedProbe.output}`);
}

console.log(`[swc-repair] SUCCESS: SWC ${nextVersion} is healthy (${Math.round(repairedBytes / 1024 / 1024)} MiB).`);
