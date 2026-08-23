import { haltBot } from "@/lib/autobot";
export async function POST(){return Response.json({halted:true,config:await haltBot()});}
