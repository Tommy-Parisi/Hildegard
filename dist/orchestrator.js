import { open, rm } from "node:fs/promises";
export class Orchestrator {
    stateStore;
    supervisor;
    commandRunner;
    workerRunner;
    lockPath;
    constructor(stateStore, supervisor, commandRunner, workerRunner, lockPath) {
        this.stateStore = stateStore;
        this.supervisor = supervisor;
        this.commandRunner = commandRunner;
        this.workerRunner = workerRunner;
        this.lockPath = lockPath;
    }
    async initialize(initialState) {
        const existingState = await this.stateStore.load();
        if (existingState) {
            return existingState;
        }
        await this.stateStore.save(initialState);
        return initialState;
    }
    async runNext() {
        return this.withRunLock(async () => {
            const state = await this.requireState();
            const result = this.supervisor.runIteration(state.plan);
            if (!result.decision) {
                const nextState = {
                    ...state,
                    plan: result.updatedPlan,
                    executionHistory: appendExecutionRecord(state.executionHistory, result.executionRecord),
                };
                await this.stateStore.save(nextState);
                return result;
            }
            const selectedTask = result.updatedPlan.tasks.find((task) => task.id === result.decision?.taskId);
            const assignment = selectedTask ? await this.workerRunner.assign(selectedTask) : null;
            const workerResult = assignment && selectedTask
                ? await this.workerRunner.run(assignment, {
                    ...state,
                    plan: result.updatedPlan,
                })
                : null;
            const nextState = {
                ...state,
                ...applyWorkerOutcome(state, result.updatedPlan, result.executionRecord, assignment, workerResult),
            };
            await this.stateStore.save(nextState);
            return result;
        });
    }
    async runUntilBlocked(maxIterations = 25) {
        const results = [];
        for (let iteration = 0; iteration < maxIterations; iteration += 1) {
            const state = await this.requireState();
            const preview = this.supervisor.runIteration(state.plan);
            if (!preview.decision) {
                break;
            }
            const nextTask = preview.updatedPlan.tasks.find((task) => task.id === preview.decision?.taskId);
            if (!nextTask) {
                break;
            }
            if (!this.workerRunner.supports(nextTask)) {
                break;
            }
            const result = await this.runNext();
            results.push(result);
        }
        return results;
    }
    async loadState() {
        return this.requireState();
    }
    async replacePlan(plan) {
        return this.replacePlanInternal(plan, false);
    }
    async replacePlanAndClearRuntime(plan) {
        return this.replacePlanInternal(plan, true);
    }
    async replacePlanInternal(plan, clearRuntime) {
        const state = await this.requireState();
        const nextState = {
            ...state,
            plan: updateDerivedTaskStatuses(plan),
            executionHistory: clearRuntime ? [] : state.executionHistory,
            memory: clearRuntime ? [] : state.memory,
        };
        await this.stateStore.save(nextState);
        return nextState;
    }
    async setProfile(profile) {
        const state = await this.requireState();
        const nextState = {
            ...state,
            workspace: {
                ...state.workspace,
                profileId: profile.id,
            },
            profile,
        };
        await this.stateStore.save(nextState);
        return nextState;
    }
    async bootstrapWorkspace(bootstrap) {
        const state = await this.requireState();
        const nextState = {
            ...state,
            workspace: bootstrap.workspace,
            profile: bootstrap.profile,
            plan: updateDerivedTaskStatuses(bootstrap.plan),
            executionHistory: [],
            memory: [],
        };
        await this.stateStore.save(nextState);
        return nextState;
    }
    async recordAnalysis(analysis) {
        const state = await this.requireState();
        const memoryRecord = {
            id: `memory_${Date.now()}`,
            kind: "semantic",
            taskId: hasTask("task_repo_map", state.plan.tasks) ? "task_repo_map" : undefined,
            summary: analysis.summary,
            source: "analyzeRepo",
            timestamp: new Date().toISOString(),
        };
        const nextPlan = hasTask("task_repo_map", state.plan.tasks)
            ? markTaskDone(state.plan, "task_repo_map")
            : state.plan;
        const nextState = {
            ...state,
            plan: updateDerivedTaskStatuses(nextPlan),
            executionHistory: [
                ...state.executionHistory,
                {
                    id: `run_${Date.now()}`,
                    planId: state.plan.id,
                    taskId: "task_repo_map",
                    status: "completed",
                    summary: "Recorded repository structure summary.",
                    timestamp: new Date().toISOString(),
                },
            ],
            memory: [...state.memory, memoryRecord],
        };
        await this.stateStore.save(nextState);
        return nextState;
    }
    async recordArchitectureSummary(summary) {
        const state = await this.requireState();
        const nextPlan = hasTask("task_architecture_summary", state.plan.tasks)
            ? markTaskDone(state.plan, "task_architecture_summary")
            : state.plan;
        const nextState = {
            ...state,
            plan: updateDerivedTaskStatuses(nextPlan),
            executionHistory: [
                ...state.executionHistory,
                {
                    id: `run_${Date.now()}`,
                    planId: state.plan.id,
                    taskId: "task_architecture_summary",
                    status: "completed",
                    summary: "Recorded architecture summary from repo analysis.",
                    timestamp: new Date().toISOString(),
                },
            ],
            memory: [
                ...state.memory,
                {
                    id: `memory_${Date.now()}`,
                    kind: "semantic",
                    taskId: "task_architecture_summary",
                    summary,
                    source: "recordArchitectureSummary",
                    timestamp: new Date().toISOString(),
                },
            ],
        };
        await this.stateStore.save(nextState);
        return nextState;
    }
    async recordProfileReview(summary) {
        const state = await this.requireState();
        const nextPlan = hasTask("task_profile_review", state.plan.tasks)
            ? markTaskDone(state.plan, "task_profile_review")
            : state.plan;
        const nextState = {
            ...state,
            plan: updateDerivedTaskStatuses(nextPlan),
            executionHistory: [
                ...state.executionHistory,
                {
                    id: `run_${Date.now()}`,
                    planId: state.plan.id,
                    taskId: "task_profile_review",
                    status: "completed",
                    summary: "Reviewed active profile against detected repo manifests.",
                    timestamp: new Date().toISOString(),
                },
            ],
            memory: [
                ...state.memory,
                {
                    id: `memory_${Date.now()}`,
                    kind: "semantic",
                    taskId: "task_profile_review",
                    summary,
                    source: "recordProfileReview",
                    timestamp: new Date().toISOString(),
                },
            ],
        };
        await this.stateStore.save(nextState);
        return nextState;
    }
    async seedPlanTasks(tasks) {
        const state = await this.requireState();
        const existingIds = new Set(state.plan.tasks.map((task) => task.id));
        const newTasks = tasks.filter((task) => !existingIds.has(task.id));
        const seededPlan = markTaskDone({
            ...state.plan,
            tasks: [...state.plan.tasks, ...newTasks],
        }, "task_seed_plan");
        const nextState = {
            ...state,
            plan: updateDerivedTaskStatuses(seededPlan),
            executionHistory: [
                ...state.executionHistory,
                {
                    id: `run_${Date.now()}`,
                    planId: state.plan.id,
                    taskId: "task_seed_plan",
                    status: "completed",
                    summary: `Seeded ${newTasks.length} project-specific tasks from repo analysis.`,
                    timestamp: new Date().toISOString(),
                },
            ],
            memory: [
                ...state.memory,
                {
                    id: `memory_${Date.now()}`,
                    kind: "episodic",
                    taskId: "task_seed_plan",
                    summary: `Added tasks: ${newTasks.map((task) => task.id).join(", ") || "(none)"}.`,
                    source: "seedPlanTasks",
                    timestamp: new Date().toISOString(),
                },
            ],
        };
        await this.stateStore.save(nextState);
        return nextState;
    }
    async addTask(task) {
        const state = await this.requireState();
        if (state.plan.tasks.some((existingTask) => existingTask.id === task.id)) {
            throw new Error(`Task "${task.id}" already exists.`);
        }
        validateDependencies(task.dependencies, state.plan.tasks);
        return this.replacePlan({
            ...state.plan,
            tasks: [...state.plan.tasks, task],
        });
    }
    async updateTaskStatus(taskId, status) {
        const state = await this.requireState();
        ensureTaskExists(taskId, state.plan.tasks);
        return this.replacePlan({
            ...state.plan,
            tasks: state.plan.tasks.map((task) => task.id === taskId
                ? {
                    ...task,
                    status,
                }
                : task),
        });
    }
    async updateTaskDependencies(taskId, dependencies) {
        const state = await this.requireState();
        ensureTaskExists(taskId, state.plan.tasks);
        if (dependencies.includes(taskId)) {
            throw new Error(`Task "${taskId}" cannot depend on itself.`);
        }
        validateDependencies(dependencies, state.plan.tasks);
        return this.replacePlan({
            ...state.plan,
            tasks: state.plan.tasks.map((task) => task.id === taskId
                ? {
                    ...task,
                    dependencies,
                }
                : task),
        });
    }
    async completeTask(taskId, summary) {
        const state = await this.requireState();
        const taskExists = state.plan.tasks.some((task) => task.id === taskId);
        if (!taskExists) {
            throw new Error(`Task "${taskId}" does not exist.`);
        }
        const plan = {
            ...state.plan,
            tasks: state.plan.tasks.map((task) => task.id === taskId
                ? {
                    ...task,
                    status: "done",
                }
                : task),
        };
        const completedRecord = {
            id: `run_${Date.now()}`,
            planId: state.plan.id,
            taskId,
            status: "completed",
            summary,
            timestamp: new Date().toISOString(),
        };
        const memoryRecord = {
            id: `memory_${Date.now()}`,
            kind: "episodic",
            taskId,
            summary,
            source: "completeTask",
            timestamp: new Date().toISOString(),
        };
        const nextState = {
            ...state,
            plan: updateDerivedTaskStatuses(plan),
            executionHistory: [...state.executionHistory, completedRecord],
            memory: [...state.memory, memoryRecord],
        };
        await this.stateStore.save(nextState);
        return nextState;
    }
    async runValidation() {
        const state = await this.requireState();
        const validationCommands = state.profile.commands.filter((command) => command.category === "validation");
        const results = await Promise.all(validationCommands.map((command) => this.commandRunner.run(command, state.plan.approvalPolicy)));
        const nextState = {
            ...state,
            executionHistory: [
                ...state.executionHistory,
                ...results.map((result) => ({
                    id: `run_${Date.now()}_${result.commandId}`,
                    planId: state.plan.id,
                    taskId: `validation:${result.commandId}`,
                    status: (result.approved ? "completed" : "blocked"),
                    summary: result.summary,
                    timestamp: new Date().toISOString(),
                })),
            ],
            memory: [
                ...state.memory,
                ...results.map((result) => ({
                    id: `memory_${Date.now()}_${result.commandId}`,
                    kind: "working",
                    summary: result.summary,
                    source: result.command,
                    timestamp: new Date().toISOString(),
                })),
            ],
        };
        await this.stateStore.save(nextState);
        return results;
    }
    async requireState() {
        const state = await this.stateStore.load();
        if (!state) {
            throw new Error("Orchestration state is not initialized.");
        }
        return state;
    }
    async withRunLock(operation) {
        const handle = await this.acquireRunLock();
        try {
            return await operation();
        }
        finally {
            await handle.close();
            await rm(this.lockPath, { force: true });
        }
    }
    async acquireRunLock() {
        try {
            return await open(this.lockPath, "wx");
        }
        catch (error) {
            if (error instanceof Error && "code" in error && error.code === "EEXIST") {
                throw new Error("Another orchestrator run is already in progress.");
            }
            throw error;
        }
    }
}
function appendExecutionRecord(existingRecords, record) {
    if (!record) {
        return existingRecords;
    }
    return [...existingRecords, record];
}
function applyWorkerOutcome(state, plan, executionRecord, assignment, workerResult) {
    const baseHistory = appendExecutionRecord(state.executionHistory, executionRecord);
    if (!assignment || !workerResult) {
        return {
            plan,
            executionHistory: baseHistory,
            memory: state.memory,
        };
    }
    const updatedPlan = workerResult.status === "completed"
        ? mergeGeneratedTasks(markTaskDone(plan, workerResult.taskId), workerResult.generatedTasks)
        : restoreTaskAfterBlockedWorker(plan, workerResult.taskId);
    return {
        plan: updateDerivedTaskStatuses(updatedPlan),
        executionHistory: [
            ...baseHistory,
            {
                id: `run_${Date.now()}_${workerResult.taskId}`,
                planId: plan.id,
                taskId: workerResult.taskId,
                status: workerResult.status,
                summary: `${assignment.reason} ${workerResult.summary}`,
                timestamp: new Date().toISOString(),
            },
        ],
        memory: [
            ...state.memory,
            {
                id: `memory_${Date.now()}_${workerResult.taskId}`,
                kind: workerResult.memoryKind,
                taskId: workerResult.taskId,
                summary: workerResult.summary,
                source: workerResult.memorySource ?? assignment.workerKind,
                timestamp: new Date().toISOString(),
            },
        ],
    };
}
function restoreTaskAfterBlockedWorker(plan, taskId) {
    return {
        ...plan,
        tasks: plan.tasks.map((task) => task.id === taskId
            ? {
                ...task,
                status: "ready",
            }
            : task),
    };
}
function mergeGeneratedTasks(plan, generatedTasks) {
    if (!generatedTasks || generatedTasks.length === 0) {
        return plan;
    }
    const existingIds = new Set(plan.tasks.map((task) => task.id));
    const newTasks = generatedTasks.filter((task) => !existingIds.has(task.id));
    return {
        ...plan,
        tasks: [...plan.tasks, ...newTasks],
    };
}
function ensureTaskExists(taskId, tasks) {
    if (!tasks.some((task) => task.id === taskId)) {
        throw new Error(`Task "${taskId}" does not exist.`);
    }
}
function hasTask(taskId, tasks) {
    return tasks.some((task) => task.id === taskId);
}
function validateDependencies(dependencies, tasks) {
    const taskIds = new Set(tasks.map((task) => task.id));
    for (const dependencyId of dependencies) {
        if (!taskIds.has(dependencyId)) {
            throw new Error(`Dependency "${dependencyId}" does not exist.`);
        }
    }
}
function markTaskDone(plan, taskId) {
    if (!hasTask(taskId, plan.tasks)) {
        return plan;
    }
    return {
        ...plan,
        tasks: plan.tasks.map((task) => task.id === taskId
            ? {
                ...task,
                status: "done",
            }
            : task),
    };
}
function updateDerivedTaskStatuses(plan) {
    const tasksById = new Map(plan.tasks.map((task) => [task.id, task]));
    return {
        ...plan,
        tasks: plan.tasks.map((task) => {
            if (task.status !== "pending" && task.status !== "ready") {
                return task;
            }
            const dependenciesSatisfied = task.dependencies.every((dependencyId) => tasksById.get(dependencyId)?.status === "done");
            return {
                ...task,
                status: dependenciesSatisfied ? "ready" : "pending",
            };
        }),
    };
}
