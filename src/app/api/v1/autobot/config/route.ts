import { NextRequest } from "next/server";
import { getBotConfig, saveBotConfig } from "@/lib/autobot";
export async function GET(){return Response.json(await getBotConfig());}
export async function POST(request:NextRequest){try{return Response.json(await saveBotConfig(await request.json()));}catch(error){return Response.json({error:error instanceof Error?error.message:"INVALID_CONFIG"},{status:400});}}
