import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { atomicWriteJson } from "./state-store.mjs";

const roots = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive:true, force:true }); });

describe("atomicWriteJson", () => {
  it("replaces JSON without leaving temporary files", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cryptov2-state-")); roots.push(root);
    const file = path.join(root, "state.json");
    atomicWriteJson(file, { sequence:1 });
    atomicWriteJson(file, { sequence:2 });
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ sequence:2 });
    expect(fs.readdirSync(root)).toEqual(["state.json"]);
  });
});
