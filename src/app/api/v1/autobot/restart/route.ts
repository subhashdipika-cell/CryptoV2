import { requestBotHotRestart } from "@/lib/autobot";

export async function POST(request:Request){
  try{return Response.json(await requestBotHotRestart(await request.json()));}
  catch(error){return Response.json({error:error instanceof Error?error.message:"HOT_RESTART_REJECTED"},{status:400});}
}
