import { WorkerRunner } from "./workers.js";
function isDependencySatisfied(tasksById, dependencyId) {
    return tasksById.get(dependencyId)?.status === "done";
}
function isReadyTask(task, tasksById) {
    if (task.status !== "pending" && task.status !== "ready") {
        return false;
    }
    return task.dependencies.every((dependencyId) => isDependencySatisfied(tasksById, dependencyId));
}
function compareTasks(a, b, workerRunner) {
    if (a.priority !== b.priority) {
        return b.priority - a.priority;
    }
    const aSupported = workerRunner.supports(a);
    const bSupported = workerRunner.supports(b);
    if (aSupported !== bSupported) {
        return aSupported ? -1 : 1;
    }
    if (a.estimatedScope !== b.estimatedScope) {
        return a.estimatedScope - b.estimatedScope;
    }
    return a.id.localeCompare(b.id);
}
export class Supervisor {
    workerRunner;
    constructor(workerRunner = new WorkerRunner()) {
        this.workerRunner = workerRunner;
    }
    runIteration(plan) {
        const tasksById = new Map(plan.tasks.map((task) => [task.id, task]));
        const readyTasks = plan.tasks
            .filter((task) => isReadyTask(task, tasksById))
            .sort((a, b) => compareTasks(a, b, this.workerRunner));
        const blockedTaskIds = plan.tasks
            .filter((task) => task.status === "blocked" || task.status === "needs_review")
            .map((task) => task.id);
        const decision = this.chooseNextTask(readyTasks);
        const updatedPlan = this.applyDecision(plan, decision);
        const executionRecord = this.createExecutionRecord(plan.id, decision, updatedPlan);
        return {
            decision,
            readyTaskIds: readyTasks.map((task) => task.id),
            blockedTaskIds,
            updatedPlan,
            executionRecord,
        };
    }
    chooseNextTask(readyTasks) {
        const nextTask = readyTasks[0];
        if (!nextTask) {
            return null;
        }
        return {
            taskId: nextTask.id,
            reason: `Selected "${nextTask.title}" because it is ready, has priority ${nextTask.priority}, and estimated scope ${nextTask.estimatedScope}.`,
        };
    }
    applyDecision(plan, decision) {
        if (!decision) {
            return plan;
        }
        return {
            ...plan,
            tasks: plan.tasks.map((task) => task.id === decision.taskId
                ? {
                    ...task,
                    status: "in_progress",
                }
                : task),
        };
    }
    createExecutionRecord(planId, decision, updatedPlan) {
        if (!decision) {
            return null;
        }
        const selectedTask = updatedPlan.tasks.find((task) => task.id === decision.taskId);
        if (!selectedTask) {
            return null;
        }
        return {
            id: `run_${Date.now()}`,
            planId,
            taskId: selectedTask.id,
            status: "selected",
            summary: decision.reason,
            timestamp: new Date().toISOString(),
        };
    }
}
