import { calculateExitLevels, positionGreek, positionPremiumUsd } from "@/lib/bot-position";
import { getBotStatus } from "@/lib/autobot";
import { getInstrument, getPrivateSnapshot, getTicker } from "@/lib/deribit";
import { deribitFailure } from "@/lib/deribit-response";
import type { DeribitCurrency } from "@/lib/deribit-schema";

type Position={instrument_name:string;direction:string;size:number;average_price:number;average_price_usd?:number;mark_price:number;index_price:number;floating_profit_loss:number;floating_profit_loss_usd?:number;total_profit_loss:number;delta?:number;gamma?:number;vega?:number;theta?:number};
type Ticker={mark_price?:number;mark_iv?:number;best_bid_price?:number;best_ask_price?:number;index_price?:number;greeks?:{delta?:number;gamma?:number;vega?:number;theta?:number;rho?:number}};

export async function GET(){
 try{
  const bot=await getBotStatus();const state=bot.state as {managedInstruments?:string[]};const managed=new Set(state.managedInstruments??[]);const config=bot.config as {currencies:DeribitCurrency[];stopLossPct:number;takeProfitPct:number};
  const snapshots=await Promise.all(config.currencies.map(async currency=>({currency,snapshot:await getPrivateSnapshot(currency)})));
  const owned=snapshots.flatMap(({currency,snapshot})=>(snapshot.positions as Position[]).filter(position=>managed.has(position.instrument_name)).map(position=>({currency,position})));
  const positions=await Promise.all(owned.map(async({currency,position})=>{const [tickerRaw,instrument]=await Promise.all([getTicker(position.instrument_name),getInstrument(position.instrument_name)]);const ticker=tickerRaw as Ticker;const markPrice=ticker.mark_price??position.mark_price;return{currency,instrumentName:position.instrument_name,direction:position.direction,size:position.size,averagePrice:position.average_price,averagePriceUsd:positionPremiumUsd(position.average_price_usd,position.average_price,position.index_price,position.size),markPrice,indexPrice:ticker.index_price??position.index_price,markIv:ticker.mark_iv??null,bestBid:ticker.best_bid_price??null,bestAsk:ticker.best_ask_price??null,floatingPnl:position.floating_profit_loss,floatingPnlUsd:position.floating_profit_loss_usd??position.floating_profit_loss*position.index_price,totalPnl:position.total_profit_loss,expirationTimestamp:instrument.expiration_timestamp,greeks:{delta:positionGreek(ticker.greeks?.delta,position.delta,position.size),gamma:positionGreek(ticker.greeks?.gamma,position.gamma,position.size),vega:positionGreek(ticker.greeks?.vega,position.vega,position.size),theta:positionGreek(ticker.greeks?.theta,position.theta,position.size),rho:positionGreek(ticker.greeks?.rho,undefined,position.size)},exit:calculateExitLevels(position.average_price,markPrice,config.stopLossPct,config.takeProfitPct)};}));
  return Response.json({environment:"DERIBIT_TESTNET",positions,stopLossPct:config.stopLossPct,takeProfitPct:config.takeProfitPct,updatedAt:Date.now()});
 }catch(error){return deribitFailure(error);}
}
