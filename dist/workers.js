import { CommandRunner } from "./command-runner.js";
import { analyzeRepo, createArchitectureSummary, createSeedTasks, reviewProfileFit, } from "./repo-analyzer.js";
export class WorkerRunner {
    commandRunner = new CommandRunner();
    supports(task) {
        const workerKind = chooseWorkerKind(task);
        if (workerKind === "research") {
            return true;
        }
        if (workerKind === "planner") {
            return supportsPlannerTask(task.id);
        }
        if (workerKind === "validation") {
            return supportsValidationTask(task.id);
        }
        return false;
    }
    async assign(task) {
        const workerKind = chooseWorkerKind(task);
        if (!workerKind) {
            return null;
        }
        return {
            workerKind,
            taskId: task.id,
            reason: `Assigned ${workerKind} worker for ${task.type} task "${task.title}".`,
        };
    }
    async run(assignment, state) {
        switch (assignment.workerKind) {
            case "research":
                return runResearchWorker(assignment, state);
            case "planner":
                return runPlannerWorker(assignment, state);
            case "validation":
                return runValidationWorker(assignment, state, this.commandRunner);
            default:
                return {
                    workerKind: assignment.workerKind,
                    taskId: assignment.taskId,
                    summary: `No worker implementation exists yet for ${assignment.workerKind}.`,
                    memoryKind: "working",
                    status: "blocked",
                };
        }
    }
}
async function runResearchWorker(assignment, state) {
    const analysis = await analyzeRepo(state.workspace.repoPath, state.profile);
    if (assignment.taskId === "task_architecture_summary") {
        return {
            workerKind: "research",
            taskId: assignment.taskId,
            summary: createArchitectureSummary(analysis),
            memoryKind: "semantic",
            status: "completed",
            memorySource: "recordArchitectureSummary",
        };
    }
    return {
        workerKind: "research",
        taskId: assignment.taskId,
        summary: `Research summary for ${state.workspace.name}: ${analysis.summary}`,
        memoryKind: "semantic",
        status: "completed",
        memorySource: "analyzeRepo",
    };
}
async function runPlannerWorker(assignment, state) {
    const analysis = await analyzeRepo(state.workspace.repoPath, state.profile);
    switch (assignment.taskId) {
        case "task_profile_review":
            return {
                workerKind: "planner",
                taskId: assignment.taskId,
                summary: reviewProfileFit(analysis, state.profile),
                memoryKind: "semantic",
                status: "completed",
                memorySource: "recordProfileReview",
            };
        case "task_seed_plan":
            return {
                workerKind: "planner",
                taskId: assignment.taskId,
                summary: `Seeded project plan from repo analysis for ${state.workspace.name}.`,
                memoryKind: "episodic",
                status: "completed",
                generatedTasks: createSeedTasks(analysis).map((task) => ({
                    ...task,
                    status: "pending",
                    retryCount: 0,
                })),
                memorySource: "seedPlanTasks",
            };
        case "task_first_work_slice":
            return {
                workerKind: "planner",
                taskId: assignment.taskId,
                summary: createFirstWorkSliceSummary(state.workspace.name, analysis.subsystems),
                memoryKind: "episodic",
                status: "completed",
                generatedTasks: createFirstWorkSliceTasks(analysis.subsystems),
                memorySource: "recordFirstWorkSlice",
            };
        default:
            return {
                workerKind: "planner",
                taskId: assignment.taskId,
                summary: `No planner workflow exists yet for ${assignment.taskId}.`,
                memoryKind: "working",
                status: "blocked",
            };
    }
}
function chooseWorkerKind(task) {
    switch (task.type) {
        case "research":
            return "research";
        case "planning":
            return "planner";
        case "validation":
            return "validation";
        case "implementation":
            return "code";
        case "review":
            return "review";
        default:
            return null;
    }
}
function supportsPlannerTask(taskId) {
    return (taskId === "task_profile_review" ||
        taskId === "task_seed_plan" ||
        taskId === "task_first_work_slice");
}
function supportsValidationTask(taskId) {
    return taskId === "task_run_validation" || taskId === "task_validation_baseline_followup";
}
function createFirstWorkSliceSummary(workspaceName, subsystems) {
    const focusArea = subsystems[0] ?? "src";
    return [
        `Defined the first work slice for ${workspaceName}.`,
        `Recommended focus area: ${focusArea}.`,
        "Generated concrete implementation and review tasks for the first slice.",
    ].join(" ");
}
function createFirstWorkSliceTasks(subsystems) {
    const focusArea = subsystems[0] ?? "src";
    const sliceId = toTaskSlug(focusArea);
    return [
        {
            id: `task_impl_${sliceId}`,
            title: `Implement first slice in ${focusArea}`,
            description: `Make the first bounded implementation improvement in ${focusArea}.`,
            type: "implementation",
            priority: 2,
            status: "pending",
            dependencies: ["task_first_work_slice"],
            acceptanceCriteria: ["A small implementation change is prepared for review."],
            estimatedScope: 3,
            retryCount: 0,
        },
        {
            id: `task_review_${sliceId}`,
            title: `Review first slice in ${focusArea}`,
            description: `Review the first implementation slice for ${focusArea} against acceptance criteria.`,
            type: "review",
            priority: 1,
            status: "pending",
            dependencies: [`task_impl_${sliceId}`],
            acceptanceCriteria: ["The first implementation slice is reviewed and validated."],
            estimatedScope: 2,
            retryCount: 0,
        },
    ];
}
function toTaskSlug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
async function runValidationWorker(assignment, state, commandRunner) {
    if (assignment.taskId === "task_run_validation") {
        return runBaselineValidation(state, commandRunner);
    }
    if (assignment.taskId === "task_validation_baseline_followup") {
        return summarizeValidationBaseline(state);
    }
    return {
        workerKind: "validation",
        taskId: assignment.taskId,
        summary: `No validation workflow exists yet for ${assignment.taskId}.`,
        memoryKind: "working",
        status: "blocked",
    };
}
async function runBaselineValidation(state, commandRunner) {
    const validationCommands = state.profile.commands.filter((command) => command.category === "validation");
    if (validationCommands.length === 0) {
        return {
            workerKind: "validation",
            taskId: "task_run_validation",
            summary: "No validation commands are configured for the active profile.",
            memoryKind: "working",
            status: "blocked",
        };
    }
    const results = await Promise.all(validationCommands.map((command) => commandRunner.run(command, state.plan.approvalPolicy)));
    const blocked = results.some((result) => !result.approved);
    return {
        workerKind: "validation",
        taskId: "task_run_validation",
        summary: summarizeValidationResults(results),
        memoryKind: "working",
        status: blocked ? "blocked" : "completed",
        memorySource: "validationWorker",
    };
}
function summarizeValidationBaseline(state) {
    const validationHistory = state.executionHistory.filter((record) => record.taskId === "task_run_validation" || record.taskId.startsWith("validation:"));
    if (validationHistory.length === 0) {
        return {
            workerKind: "validation",
            taskId: "task_validation_baseline_followup",
            summary: "No validation baseline has been recorded yet.",
            memoryKind: "working",
            status: "blocked",
        };
    }
    const latestSummaries = validationHistory
        .slice(-3)
        .map((record) => record.summary)
        .join(" ");
    return {
        workerKind: "validation",
        taskId: "task_validation_baseline_followup",
        summary: `Validation baseline follow-up: ${latestSummaries}`,
        memoryKind: "episodic",
        status: "completed",
        memorySource: "validationFollowupWorker",
    };
}
function summarizeValidationResults(results) {
    return results
        .map((result) => `${result.commandId}: ${result.summary}`)
        .join(" ");
}
