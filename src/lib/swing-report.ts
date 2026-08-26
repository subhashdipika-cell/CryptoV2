import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

const reportPath=path.join(process.cwd(),"reports","swing-backtest.json");
export async function getSwingReport(){return JSON.parse(await fs.readFile(reportPath,"utf8"));}
