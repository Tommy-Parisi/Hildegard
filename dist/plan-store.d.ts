import type { Plan } from "./domain.js";
export declare class PlanStore {
    private readonly filePath;
    constructor(filePath: string);
    load(): Promise<Plan>;
    save(plan: Plan): Promise<void>;
}
