import { getOptionSnapshotArchive } from "@/lib/option-snapshot-archive";

export const dynamic="force-dynamic";
export async function GET(){return Response.json(await getOptionSnapshotArchive());}
