import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

console.error("[dev-diagnostic] Node:", process.version);
console.error("[dev-diagnostic] stdin TTY:", Boolean(process.stdin.isTTY));
console.error("[dev-diagnostic] stdout TTY:", Boolean(process.stdout.isTTY));
console.error("[dev-diagnostic] parent PID:", process.pid);

const child = spawn(
  process.execPath,
  [nextBin, "dev", "--hostname", "0.0.0.0", "--webpack"],
  { cwd: root, env: process.env, stdio: "inherit" }
);

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    console.error(`[dev-diagnostic] wrapper received ${signal}; forwarding to Next.js`);
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  });
}

child.once("error", (error) => {
  console.error("[dev-diagnostic] Could not start Next.js:", error);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  console.error(`[dev-diagnostic] Next.js stopped: exitCode=${code}, signal=${signal ?? "none"}`);
  process.exitCode = code ?? 1;
});
