import { describe,expect,it } from "vitest";
import { normalizeSnapshotContract,selectSnapshotContracts,snapshotQuality,SNAPSHOT_PUBLIC_METHODS } from "./option-snapshot.mjs";

function instruments(now){const items=[];for(const days of [3,14,30,90])for(const strike of [60,70,80,90,100,110,120,130,140])for(const option_type of ["call","put"])items.push({kind:"option",is_active:true,instrument_name:`BTC-${days}-${strike}-${option_type}`,expiration_timestamp:now+days*86_400_000,strike,option_type,contract_size:1,min_trade_amount:.1,tick_size:.0001});return items;}
describe("read-only option snapshot selection",()=>{
  it("selects seven paired near-ATM strikes from two bounded expiries",()=>{const now=Date.UTC(2026,0,1),selected=selectSnapshotContracts(instruments(now),100,now),expiries=[...new Set(selected.map(item=>item.expiration_timestamp))];expect(selected).toHaveLength(28);expect(expiries).toHaveLength(2);for(const expiry of expiries)expect(new Set(selected.filter(item=>item.expiration_timestamp===expiry).map(item=>item.strike)).size).toBe(7);expect(selected.every(item=>item.strike>=80&&item.strike<=140)).toBe(true);});
  it("normalizes observed market fields and computes coverage",()=>{const instrument=instruments(0)[0],contract=normalizeSnapshotContract(instrument,{open_interest:20},{best_bid_price:.1,best_ask_price:.12,mark_iv:60,greeks:{delta:.5}},0);expect(contract.mid).toBeCloseTo(.11);expect(contract.spreadPct).toBeGreaterThan(0);expect(snapshotQuality([contract])).toMatchObject({contracts:1,twoSidedQuotes:1,ivCoveragePct:100,greeksCoveragePct:100,openInterestCoveragePct:100});});
  it("contains public methods only",()=>{expect(SNAPSHOT_PUBLIC_METHODS.every(method=>method.startsWith("public/"))).toBe(true);});
});
