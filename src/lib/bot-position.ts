export function calculateExitLevels(averagePrice:number, markPrice:number, stopLossPct:number, takeProfitPct:number){
  const stopPrice=averagePrice*(1-stopLossPct/100),takeProfitPrice=averagePrice*(1+takeProfitPct/100);
  const pnlPct=averagePrice>0?(markPrice/averagePrice-1)*100:0;
  const distanceToStopPct=markPrice>0?(markPrice-stopPrice)/markPrice*100:0;
  const distanceToTakeProfitPct=markPrice>0?(takeProfitPrice-markPrice)/markPrice*100:0;
  return{stopPrice,takeProfitPrice,pnlPct,distanceToStopPct,distanceToTakeProfitPct};
}

export function positionPremiumUsd(averagePriceUsd:number|undefined,averagePrice:number,indexPrice:number,size:number){
  const perContract=Number.isFinite(averagePriceUsd)?Number(averagePriceUsd):averagePrice*indexPrice;
  return perContract*Math.abs(size);
}

export function positionGreek(perContract:number|undefined,positionTotal:number|undefined,size:number){
  return Number.isFinite(perContract)?Number(perContract)*Math.abs(size):positionTotal??null;
}
