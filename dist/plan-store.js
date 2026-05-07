import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
export class PlanStore {
    filePath;
    constructor(filePath) {
        this.filePath = filePath;
    }
    async load() {
        const raw = await readFile(this.filePath, "utf8");
        return JSON.parse(raw);
    }
    async save(plan) {
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, JSON.stringify(plan, null, 2));
    }
}
