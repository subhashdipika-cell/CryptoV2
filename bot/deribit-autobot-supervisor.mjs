import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const worker = path.join(root, "bot", "deribit-autobot-v2.mjs");
let child;
let stopping = false;
let restartCount = 0;

function start() {
  child = spawn(process.execPath, [worker], { cwd:root, env:process.env, stdio:"inherit", windowsHide:true });
  console.log(`[AUTOBOT_SUPERVISOR] Worker started pid=${child.pid}`);
  child.once("exit", (code, signal) => {
    if (stopping) return;
    restartCount += 1;
    const delay = Math.min(30_000, 2_000 * restartCount);
    console.error(`[AUTOBOT_SUPERVISOR] Worker exited code=${code} signal=${signal}; restarting in ${delay}ms`);
    setTimeout(start, delay);
  });
  child.once("spawn", () => { restartCount = 0; });
}

function shutdown(signal) {
  stopping = true;
  if (child && !child.killed) child.kill(signal);
  setTimeout(() => process.exit(0), 1_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
start();
