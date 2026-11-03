import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  createWriteStream,
  createReadStream,
} from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { finished } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compose = ["compose", "-f", "docker-compose.local.yml"];
const localDatabaseUrl =
  "postgresql://app_user:local_dev_only_change_me@localhost:54329/new_host_travel?schema=public";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function fail(message) {
  throw new Error(message);
}

function checkNodeVersion() {
  const actual = process.versions.node.split(".").map(Number);
  const minimum = [22, 18, 0];
  let tooOld = false;
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] < minimum[index]) {
      tooOld = true;
      break;
    }
    if (actual[index] > minimum[index]) break;
  }
  if (tooOld) {
    fail("This project requires Node.js 22.18.0 or newer. Current version: " + process.versions.node);
  }
}

function runDocker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: root,
    stdio: options.silent ? "ignore" : "inherit",
    encoding: "utf8",
  });
  if (result.error) {
    fail("Could not run Docker. Install Docker Desktop and make sure it is running.");
  }
  if (result.status !== 0) {
    fail("Docker command failed. Check Docker Desktop and try again.");
  }
  return result;
}

function runNpm(args) {
  const result = spawnSync(npmCommand, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) fail("Could not run npm: " + result.error.message);
  if (result.status !== 0) fail("npm " + args.join(" ") + " failed.");
}

function setEnvValue(content, key, value) {
  const lines = content.split(/\r?\n/);
  const replacement = key + "=" + JSON.stringify(value);
  const index = lines.findIndex((line) => line.trim().startsWith(key + "="));
  if (index >= 0) lines[index] = replacement;
  else lines.push(replacement);
  return lines.join("\n");
}

function readEnvValue(content, key) {
  const line = content.split(/\r?\n/).find((row) => row.trim().startsWith(key + "="));
  if (!line) return undefined;
  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

function configureLocalEnvironment() {
  const envPath = path.join(root, ".env");

  if (!existsSync(envPath)) {
    const examplePath = path.join(root, ".env.example");
    if (!existsSync(examplePath)) fail("Missing .env.example; cannot prepare local configuration.");

    let content = readFileSync(examplePath, "utf8");
    content = setEnvValue(content, "DATABASE_URL", localDatabaseUrl);
    content = setEnvValue(content, "BETTER_AUTH_SECRET", randomBytes(32).toString("base64url"));
    content = setEnvValue(content, "BETTER_AUTH_URL", "http://localhost:3000");
    content = setEnvValue(content, "BETTER_AUTH_TRUSTED_ORIGINS", "http://localhost:3000");
    content = setEnvValue(content, "SEED_DEMO_DATA", "false");
    writeFileSync(envPath, content, { encoding: "utf8", mode: 0o600 });
    console.log("Created .env with a generated local-only authentication secret.");
    return;
  }

  const content = readFileSync(envPath, "utf8");
  if (readEnvValue(content, "DATABASE_URL") !== localDatabaseUrl) {
    fail(
      "Your existing .env is not configured for the local database. Nothing was changed. " +
        "Back up .env, then set DATABASE_URL to " + localDatabaseUrl
    );
  }
  if (readEnvValue(content, "BETTER_AUTH_URL") !== "http://localhost:3000") {
    fail("For local-first mode, set BETTER_AUTH_URL=http://localhost:3000 in .env.");
  }
  if (readEnvValue(content, "BETTER_AUTH_TRUSTED_ORIGINS") !== "http://localhost:3000") {
    fail("For local-first mode, set BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000 in .env.");
  }
  const secret = readEnvValue(content, "BETTER_AUTH_SECRET");
  if (!secret || secret.includes("replace-with-at-least-32-random-characters")) {
    fail("Set a unique BETTER_AUTH_SECRET in .env; do not use the example placeholder.");
  }
}

function ensureDockerAvailable() {
  const info = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], {
    cwd: root,
    stdio: "ignore",
  });
  if (info.error || info.status !== 0) {
    fail("Docker Desktop is required for this local setup. Install it and start Docker Desktop first.");
  }
  const composeCheck = spawnSync("docker", ["compose", "version"], {
    cwd: root,
    stdio: "ignore",
  });
  if (composeCheck.error || composeCheck.status !== 0) {
    fail("Docker Compose is unavailable. Update Docker Desktop, then retry.");
  }
}

async function waitForDatabase() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const probe = spawnSync(
      "docker",
      [...compose, "exec", "-T", "db", "pg_isready", "-U", "app_user", "-d", "new_host_travel"],
      { cwd: root, stdio: "ignore" },
    );
    if (probe.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  fail("The local database did not become ready. Check Docker Desktop logs and retry.");
}

async function prepareLocalDatabase() {
  checkNodeVersion();
  configureLocalEnvironment();
  ensureDockerAvailable();
  runDocker([...compose, "up", "-d", "db"]);
  await waitForDatabase();
}

async function createBackup() {
  const backupDirectory = path.join(root, "backups");
  mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDirectory, "new-host-travel-local-" + timestamp + ".dump");
  const child = spawn(
    "docker",
    [
      ...compose,
      "exec",
      "-T",
      "db",
      "pg_dump",
      "-U",
      "app_user",
      "-d",
      "new_host_travel",
      "--format=custom",
      "--no-owner",
      "--no-acl",
    ],
    { cwd: root, stdio: ["ignore", "pipe", "inherit"] },
  );
  const output = createWriteStream(backupPath, { flags: "wx" });
  child.stdout.pipe(output);
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  await finished(output);
  if (exitCode !== 0) {
    rmSync(backupPath, { force: true });
    fail("Backup failed; an incomplete backup file was removed.");
  }
  console.log("Local database backup created: " + path.relative(root, backupPath));
  return backupPath;
}

async function start() {
  await prepareLocalDatabase();
  if (!existsSync(path.join(root, "node_modules"))) {
    console.log("Installing project dependencies for the first run...");
    runNpm(["install"]);
  }
  runNpm(["run", "db:generate"]);
  runNpm(["run", "db:migrate"]);
  console.log("Starting New Host Travel locally at http://localhost:3000");
  console.log("Press Ctrl+C in this terminal to stop the web app. Database data remains on this computer.");
  const child = spawn(npmCommand, ["run", "dev"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.once("error", (error) => {
    console.error("Could not start the web app: " + error.message);
    process.exitCode = 1;
  });
  child.once("exit", (code) => {
    process.exitCode = code ?? 0;
  });
}

async function stop() {
  ensureDockerAvailable();
  runDocker([...compose, "down"]);
  console.log("Local database container stopped. Your data volume was kept.");
}

async function backup() {
  await prepareLocalDatabase();
  await createBackup();
}

async function restore() {
  const requestedPath = process.argv[3];
  if (!requestedPath) {
    fail('Specify a backup file, for example: npm run local:restore -- "backups/your-backup.dump"');
  }
  const backupPath = path.resolve(process.cwd(), requestedPath);
  if (!existsSync(backupPath)) fail("Backup file not found: " + backupPath);

  const prompt = createInterface({ input: stdin, output: stdout });
  const answer = await prompt.question(
    "WARNING: this replaces data in your local database. Stop the web app first. Type RESTORE to continue: ",
  );
  prompt.close();
  if (answer.trim() !== "RESTORE") {
    console.log("Restore cancelled. No data was changed.");
    return;
  }

  await prepareLocalDatabase();
  console.log("Creating a safety backup before restoring...");
  await createBackup();

  const child = spawn(
    "docker",
    [
      ...compose,
      "exec",
      "-T",
      "db",
      "pg_restore",
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-acl",
      "-U",
      "app_user",
      "-d",
      "new_host_travel",
    ],
    { cwd: root, stdio: ["pipe", "inherit", "inherit"] },
  );
  createReadStream(backupPath).pipe(child.stdin);
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  if (exitCode !== 0) fail("Restore failed. Your safety backup is in the backups folder.");
  console.log("Local database restored successfully.");
}

async function main() {
  const action = process.argv[2];
  if (action === "start") return start();
  if (action === "stop") return stop();
  if (action === "backup") return backup();
  if (action === "restore") return restore();
  console.log("Usage: node scripts/local.mjs <start|stop|backup|restore>");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("\n" + error.message);
  process.exitCode = 1;
});
