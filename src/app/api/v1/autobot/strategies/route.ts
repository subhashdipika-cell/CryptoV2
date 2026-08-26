import { getOptionsStrategyStatus } from "@/lib/options-strategy-runtime";

export const dynamic="force-dynamic";
export async function GET(){try{return Response.json(await getOptionsStrategyStatus());}catch(error){return Response.json({error:"STRATEGY_STATUS_UNAVAILABLE",detail:error instanceof Error?error.message:"Unknown error"},{status:503});}}
