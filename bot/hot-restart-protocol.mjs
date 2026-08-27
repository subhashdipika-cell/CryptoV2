import fs from "node:fs";
import crypto from "node:crypto";
import { atomicWriteJson } from "./state-store.mjs";

export const RESTART_PHASES = Object.freeze({
  REQUESTED:"REQUESTED", DRAINING:"DRAINING", DRAINED:"DRAINED", PREFLIGHT:"PREFLIGHT",
  STARTING:"STARTING", READY:"READY", ACTIVE:"ACTIVE", FAILED:"FAILED", ROLLED_BACK:"ROLLED_BACK",
});

export function readRestart(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

export function writeRestart(file, value) {
  atomicWriteJson(file, { ...value, updatedAt:new Date().toISOString() });
}

export function createRestartRequest(reason = "USER_APPROVED_HOT_RESTART") {
  return {
    protocolVersion:1,
    restartId:crypto.randomUUID(),
    phase:RESTART_PHASES.REQUESTED,
    reason,
    requestedAt:new Date().toISOString(),
  };
}

export function blocksEntries(request, pid) {
  if (!request) return false;
  if ([RESTART_PHASES.REQUESTED, RESTART_PHASES.DRAINING, RESTART_PHASES.DRAINED, RESTART_PHASES.PREFLIGHT, "STOPPING"].includes(request.phase)) return true;
  if ([RESTART_PHASES.STARTING, RESTART_PHASES.READY].includes(request.phase)) return Number(request.replacementPid) === Number(pid);
  return false;
}

export function canDeclareDrained(state) {
  return !state.evaluationInFlight && !(state.pendingOrders?.length) && Number(state.openOrderCount ?? 0) === 0 && !state.reconciliationRequired && !state.error;
}

export function canDeclareReady(state, pid, request) {
  return Number(request?.replacementPid) === Number(pid) && canDeclareDrained(state) && state.workerOnline === true && state.exitManagementActive === true && state.degraded !== true;
}
