import { calculateBotPerformance, type BotTrade } from "@/lib/bot-performance";
import { getBotStatus } from "@/lib/autobot";
import { getPrivateSnapshot, privateCall } from "@/lib/deribit";
import { deribitFailure } from "@/lib/deribit-response";
import type { DeribitCurrency } from "@/lib/deribit-schema";

type TradesResponse={trades:BotTrade[];has_more:boolean};
type Position={instrument_name:string;floating_profit_loss:number;floating_profit_loss_usd?:number;index_price:number};
let cache:{expiresAt:number;value:unknown}|null=null;

async function trades(currency:DeribitCurrency,historical:boolean){
  const result=await privateCall<TradesResponse>("private/get_user_trades_by_currency",{currency,kind:"option",count:1000,sorting:"desc",historical});
  return result.trades;
}

export async function GET(){
 try{
  if(cache&&cache.expiresAt>Date.now())return Response.json(cache.value);
  const bot=await getBotStatus();
  const state=bot.state as {managedInstruments?:string[]};
  const config=bot.config as {currencies:DeribitCurrency[]};
  const managed=new Set(state.managedInstruments??[]);
  const data=await Promise.all(config.currencies.map(async currency=>{
    const [snapshot,recent,historical]=await Promise.all([getPrivateSnapshot(currency),trades(currency,false),trades(currency,true)]);
    const positions=(snapshot.positions as Position[]).filter(position=>managed.has(position.instrument_name)).map(position=>({floatingPnlUsd:position.floating_profit_loss_usd??position.floating_profit_loss*position.index_price}));
    return{positions,trades:[...recent,...historical]};
  }));
  const performance=calculateBotPerformance(data.flatMap(item=>item.trades),data.flatMap(item=>item.positions));
  const value={environment:"DERIBIT_TESTNET",basis:"UTC",...performance,updatedAt:Date.now()};
  cache={value,expiresAt:Date.now()+30_000};
  return Response.json(value);
 }catch(error){return deribitFailure(error);}
}
