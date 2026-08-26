import { getSwingReport } from "@/lib/swing-report";

export const dynamic="force-dynamic";
export async function GET(){try{return Response.json(await getSwingReport());}catch(error){return Response.json({error:"SWING_REPORT_UNAVAILABLE",detail:error instanceof Error?error.message:"Unknown error"},{status:503});}}
