// Temporary diagnostic preload for tracing Next.js CLI/worker shutdowns.
// Safe to remove after the Codespaces startup issue is identified.
const childProcess = require("node:child_process");

const role = process.env.NEXT_PRIVATE_WORKER === "1" ? "next-worker" : "next-cli";
const prefix = `[next-lifecycle pid=${process.pid} ppid=${process.ppid} role=${role}]`;

function write(event, detail) {
  try {
    process.stderr.write(`${prefix} ${event}${detail ? " " + JSON.stringify(detail) : ""}\n`);
  } catch {
    // Diagnostics must never interfere with the process being observed.
  }
}

function activeHandles() {
  try {
    return process._getActiveHandles().map((handle) => {
      const item = { type: handle?.constructor?.name ?? typeof handle };
      if (typeof handle?.hasRef === "function") item.ref = handle.hasRef();
      if (item.type === "Server") {
        item.listening = handle.listening;
        try { item.address = handle.address(); } catch {}
      }
      return item;
    });
  } catch (error) {
    return [{ error: String(error) }];
  }
}

write("started", { argv: process.argv.slice(1) });

process.once("beforeExit", (code) => {
  write("beforeExit", { code, handles: activeHandles() });
});

process.once("exit", (code) => {
  write("exit", { code, handles: activeHandles() });
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.prependListener(signal, () => write("signal-received", { signal }));
}

// Next.js uses child_process.fork() for its actual HTTP server worker.
// Record that child's real exit code/signal, not just the CLI wrapper's.
const originalFork = childProcess.fork;
childProcess.fork = function (...args) {
  const child = Reflect.apply(originalFork, this, args);
  write("forked-child", {
    pid: child.pid,
    file: typeof args[0] === "string" ? args[0] : null,
  });
  child.once("exit", (code, signal) => {
    write("forked-child-exit", { pid: child.pid, code, signal });
  });
  return child;
};
