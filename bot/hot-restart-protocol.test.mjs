import { describe, expect, it } from "vitest";
import { blocksEntries, canDeclareDrained, canDeclareReady, createRestartRequest, RESTART_PHASES } from "./hot-restart-protocol.mjs";

describe("guarded hot restart protocol", () => {
  it("blocks entries throughout drain and replacement verification", () => {
    expect(blocksEntries({phase:RESTART_PHASES.DRAINING}, 10)).toBe(true);
    expect(blocksEntries({phase:"STOPPING"}, 10)).toBe(true);
    expect(blocksEntries({phase:RESTART_PHASES.STARTING,replacementPid:20}, 20)).toBe(true);
    expect(blocksEntries({phase:RESTART_PHASES.ACTIVE,activeWorkerPid:20}, 20)).toBe(false);
  });
  it("never declares drain while an evaluation, order, reconciliation, or error is active", () => {
    const base={evaluationInFlight:false,pendingOrders:[],openOrderCount:0,reconciliationRequired:false,error:null};
    expect(canDeclareDrained(base)).toBe(true);
    expect(canDeclareDrained({...base,evaluationInFlight:true})).toBe(false);
    expect(canDeclareDrained({...base,pendingOrders:[{label:"x"}]})).toBe(false);
    expect(canDeclareDrained({...base,openOrderCount:1})).toBe(false);
    expect(canDeclareDrained({...base,reconciliationRequired:true})).toBe(false);
    expect(canDeclareDrained({...base,error:"timeout"})).toBe(false);
  });
  it("binds readiness to the replacement PID and active exit management", () => {
    const request={phase:RESTART_PHASES.STARTING,replacementPid:22};
    const state={evaluationInFlight:false,pendingOrders:[],openOrderCount:0,reconciliationRequired:false,error:null,workerOnline:true,exitManagementActive:true,degraded:false};
    expect(canDeclareReady(state,22,request)).toBe(true);
    expect(canDeclareReady(state,21,request)).toBe(false);
    expect(canDeclareReady({...state,exitManagementActive:false},22,request)).toBe(false);
  });
  it("creates unique auditable requests", () => {
    expect(createRestartRequest().restartId).not.toBe(createRestartRequest().restartId);
  });
});
