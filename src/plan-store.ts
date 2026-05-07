import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { Plan } from "./domain.js";

export class PlanStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<Plan> {
    const raw = await readFile(this.filePath, "utf8");
    return JSON.parse(raw) as Plan;
  }

  async save(plan: Plan): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(plan, null, 2));
  }
}
