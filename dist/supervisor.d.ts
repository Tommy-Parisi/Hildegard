import type { Plan, SupervisorIterationResult } from "./domain.js";
import { WorkerRunner } from "./workers.js";
export declare class Supervisor {
    private readonly workerRunner;
    constructor(workerRunner?: WorkerRunner);
    runIteration(plan: Plan): SupervisorIterationResult;
    private chooseNextTask;
    private applyDecision;
    private createExecutionRecord;
}
