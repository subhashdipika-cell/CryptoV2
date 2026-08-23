import { getBotStatus } from "@/lib/autobot";
export async function GET(){return Response.json(await getBotStatus());}
