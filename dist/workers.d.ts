import type { OrchestrationState, TaskNode, WorkerAssignment, WorkerResult } from "./domain.js";
export declare class WorkerRunner {
    private readonly commandRunner;
    supports(task: TaskNode): boolean;
    assign(task: TaskNode): Promise<WorkerAssignment | null>;
    run(assignment: WorkerAssignment, state: OrchestrationState): Promise<WorkerResult>;
}
