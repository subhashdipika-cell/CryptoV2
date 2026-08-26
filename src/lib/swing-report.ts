import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

const reportPath=path.join(process.cwd(),"reports","regime-swing-walkforward.json");
export async function getSwingReport(){return JSON.parse(await fs.readFile(reportPath,"utf8"));}
