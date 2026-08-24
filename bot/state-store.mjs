import fs from "node:fs";

let sequence = 0;
const waitArray = new Int32Array(new SharedArrayBuffer(4));

function wait(ms) {
  Atomics.wait(waitArray, 0, 0, ms);
}

export function atomicWriteJson(file, value, options = {}) {
  const attempts = options.attempts ?? 7;
  const temp = `${file}.${process.pid}.${Date.now()}.${++sequence}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2));
  try {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        fs.renameSync(temp, file);
        return;
      } catch (error) {
        const retryable = error && ["EPERM", "EBUSY", "EACCES"].includes(error.code);
        if (!retryable || attempt === attempts - 1) throw error;
        wait(Math.min(400, 25 * (2 ** attempt)));
      }
    }
  } finally {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch { /* best-effort cleanup */ }
  }
}
