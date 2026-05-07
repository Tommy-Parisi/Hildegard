import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { bootstrapWorkspace } from "./bootstrap.js";
import { CommandRunner } from "./command-runner.js";
import { Orchestrator } from "./orchestrator.js";
import { PlanStore } from "./plan-store.js";
import { ProjectProfileStore } from "./project-profile-store.js";
import {
  analyzeRepo,
  createArchitectureSummary,
  createSeedTasks,
  reviewProfileFit,
} from "./repo-analyzer.js";
import { sampleState } from "./sample-plan.js";
import { FileStateStore } from "./state-store.js";
import { Supervisor } from "./supervisor.js";
import { WorkerRunner } from "./workers.js";

async function main(): Promise<void> {
  const dataDir = join(process.cwd(), ".mozart");
  const plansDir = join(process.cwd(), "plans");
  const profilesDir = join(process.cwd(), "profiles");
  await mkdir(dataDir, { recursive: true });

  const profileStore = new ProjectProfileStore(profilesDir);
  const defaultPlanStore = new PlanStore(join(plansDir, "default-plan.json"));
  const orchestrator = new Orchestrator(
    new FileStateStore(join(dataDir, "state.json")),
    new Supervisor(),
    new CommandRunner(),
    new WorkerRunner(),
    join(dataDir, "run.lock"),
  );
  await orchestrator.initialize(sampleState);

  const [command = "status", ...args] = process.argv.slice(2);

  switch (command) {
    case "status":
      await printStatus(orchestrator);
      return;
    case "run-next":
      await runNext(orchestrator);
      return;
    case "run-until-blocked":
      await runUntilBlocked(orchestrator, args);
      return;
    case "complete-task":
      await completeTask(orchestrator, args);
      return;
    case "list-profiles":
      await listProfiles(profileStore);
      return;
    case "use-profile":
      await useProfile(orchestrator, profileStore, args);
      return;
    case "run-validation":
      await runValidation(orchestrator);
      return;
    case "show-plan":
      await showPlan(orchestrator);
      return;
    case "load-plan":
      await loadPlan(orchestrator, args);
      return;
    case "export-plan":
      await exportPlan(orchestrator, args);
      return;
    case "reset-plan":
      await resetPlan(orchestrator, defaultPlanStore);
      return;
    case "add-task":
      await addTask(orchestrator, args);
      return;
    case "set-task-status":
      await setTaskStatus(orchestrator, args);
      return;
    case "set-task-deps":
      await setTaskDependencies(orchestrator, args);
      return;
    case "bootstrap-repo":
      await bootstrapRepo(orchestrator, profileStore, args);
      return;
    case "analyze-repo":
      await analyzeActiveRepo(orchestrator);
      return;
    case "seed-plan-from-analysis":
      await seedPlanFromAnalysis(orchestrator);
      return;
    case "write-architecture-summary":
      await writeArchitectureSummary(orchestrator);
      return;
    case "review-active-profile":
      await reviewActiveProfile(orchestrator);
      return;
    default:
      console.error(
        `Unknown command "${command}". Use status, run-next, run-until-blocked, complete-task, list-profiles, use-profile, run-validation, show-plan, load-plan, export-plan, reset-plan, add-task, set-task-status, set-task-deps, bootstrap-repo, analyze-repo, seed-plan-from-analysis, write-architecture-summary, or review-active-profile.`,
      );
      process.exitCode = 1;
  }
}

void main();

async function printStatus(orchestrator: Orchestrator): Promise<void> {
  const state = await orchestrator.loadState();
  const supervisor = new Supervisor();
  const preview = supervisor.runIteration(state.plan);

  console.log("Workspace:", state.workspace.name);
  console.log("Repo path:", state.workspace.repoPath);
  console.log("Profile:", state.profile.name);
  console.log("Goal:", state.plan.goal);
  console.log("Approval mode:", state.plan.approvalPolicy.mode);
  console.log("Ready tasks:", preview.readyTaskIds.join(", ") || "(none)");
  console.log("Blocked tasks:", preview.blockedTaskIds.join(", ") || "(none)");
  console.log("In-progress tasks:", collectTaskIds(state.plan, "in_progress").join(", ") || "(none)");
  console.log("Done tasks:", collectTaskIds(state.plan, "done").join(", ") || "(none)");
  console.log("Execution history length:", state.executionHistory.length);
  console.log("Memory record length:", state.memory.length);
}

async function runNext(orchestrator: Orchestrator): Promise<void> {
  const result = await orchestrator.runNext();
  const afterRun = await orchestrator.loadState();

  console.log("Ready tasks:", result.readyTaskIds.join(", ") || "(none)");
  console.log("Blocked tasks:", result.blockedTaskIds.join(", ") || "(none)");

  if (!result.decision) {
    console.log("No next task could be selected.");
    return;
  }

  console.log("Next task:", result.decision.taskId);
  console.log("Reason:", result.decision.reason);
  console.log("Execution history length:", afterRun.executionHistory.length);
  console.log("Memory record length:", afterRun.memory.length);
}

async function runUntilBlocked(orchestrator: Orchestrator, args: string[]): Promise<void> {
  const [maxIterationsArg] = args;
  const maxIterations = maxIterationsArg ? Number(maxIterationsArg) : 25;
  const results = await orchestrator.runUntilBlocked(maxIterations);
  const finalState = await orchestrator.loadState();

  console.log("Iterations executed:", results.length);

  for (const result of results) {
    if (!result.decision) {
      continue;
    }

    console.log(`- ${result.decision.taskId}: ${result.decision.reason}`);
  }

  console.log(
    "Remaining ready tasks:",
    new Supervisor().runIteration(finalState.plan).readyTaskIds.join(", ") || "(none)",
  );
  console.log("Execution history length:", finalState.executionHistory.length);
  console.log("Memory record length:", finalState.memory.length);
}

async function completeTask(orchestrator: Orchestrator, args: string[]): Promise<void> {
  const [taskId, ...summaryParts] = args;
  const summary = summaryParts.join(" ").trim();

  if (!taskId || !summary) {
    console.error('Usage: npm run complete-task -- <task-id> "<summary>"');
    process.exitCode = 1;
    return;
  }

  const state = await orchestrator.completeTask(taskId, summary);
  const supervisor = new Supervisor();
  const preview = supervisor.runIteration(state.plan);

  console.log("Completed task:", taskId);
  console.log("Next ready tasks:", preview.readyTaskIds.join(", ") || "(none)");
  console.log("Execution history length:", state.executionHistory.length);
  console.log("Memory record length:", state.memory.length);
}

async function listProfiles(profileStore: ProjectProfileStore): Promise<void> {
  const profiles = await profileStore.list();

  for (const profile of profiles) {
    console.log(`${profile.id}: ${profile.name}`);
  }
}

async function useProfile(
  orchestrator: Orchestrator,
  profileStore: ProjectProfileStore,
  args: string[],
): Promise<void> {
  const [profileId] = args;

  if (!profileId) {
    console.error("Usage: npm run use-profile -- <profile-id>");
    process.exitCode = 1;
    return;
  }

  const profile = await profileStore.getById(profileId);

  if (!profile) {
    console.error(`Profile "${profileId}" was not found.`);
    process.exitCode = 1;
    return;
  }

  const state = await orchestrator.setProfile(profile);
  console.log("Active profile:", state.profile.id, `(${state.profile.name})`);
}

async function runValidation(orchestrator: Orchestrator): Promise<void> {
  const results = await orchestrator.runValidation();

  if (results.length === 0) {
    console.log("No validation commands are defined for the active profile.");
    return;
  }

  for (const result of results) {
    console.log(`${result.status.toUpperCase()}: ${result.commandId}`);
    console.log(result.summary);

    if (result.output) {
      console.log(result.output);
    }
  }
}

async function showPlan(orchestrator: Orchestrator): Promise<void> {
  const state = await orchestrator.loadState();

  console.log("Plan:", state.plan.id);
  console.log("Goal:", state.plan.goal);
  console.log("Status:", state.plan.status);
  console.log("Tasks:");

  for (const task of state.plan.tasks) {
    console.log(`- ${task.id} [${task.status}] p${task.priority} ${task.title}`);
  }
}

async function loadPlan(orchestrator: Orchestrator, args: string[]): Promise<void> {
  const [planPath, mode] = args;

  if (!planPath) {
    console.error("Usage: npm run load-plan -- <path-to-plan-json> [preserve-runtime]");
    process.exitCode = 1;
    return;
  }

  const planStore = new PlanStore(resolvePath(planPath));
  const plan = await planStore.load();
  const state =
    mode === "preserve-runtime"
      ? await orchestrator.replacePlan(plan)
      : await orchestrator.replacePlanAndClearRuntime(plan);

  console.log("Loaded plan:", state.plan.id);
  console.log("Task count:", state.plan.tasks.length);
  console.log("Execution history length:", state.executionHistory.length);
  console.log("Memory record length:", state.memory.length);
}

async function exportPlan(orchestrator: Orchestrator, args: string[]): Promise<void> {
  const [planPath] = args;

  if (!planPath) {
    console.error("Usage: npm run export-plan -- <path-to-plan-json>");
    process.exitCode = 1;
    return;
  }

  const state = await orchestrator.loadState();
  const planStore = new PlanStore(resolvePath(planPath));
  await planStore.save(state.plan);

  console.log("Exported plan:", state.plan.id);
  console.log("Destination:", resolvePath(planPath));
}

async function resetPlan(orchestrator: Orchestrator, defaultPlanStore: PlanStore): Promise<void> {
  const plan = await defaultPlanStore.load();
  const state = await orchestrator.replacePlanAndClearRuntime(plan);

  console.log("Reset plan to:", state.plan.id);
  console.log("Task count:", state.plan.tasks.length);
  console.log("Execution history length:", state.executionHistory.length);
  console.log("Memory record length:", state.memory.length);
}

async function addTask(orchestrator: Orchestrator, args: string[]): Promise<void> {
  const [taskId, type, priorityValue, estimatedScopeValue, title, ...rest] = args;

  if (!taskId || !type || !priorityValue || !estimatedScopeValue || !title) {
    console.error(
      'Usage: npm run add-task -- <task-id> <type> <priority> <estimated-scope> "<title>" [description] [dep1,dep2] [criterion1|criterion2]',
    );
    process.exitCode = 1;
    return;
  }

  const [description = "", dependencyArg = "", criteriaArg = ""] = rest;
  const priority = Number(priorityValue);
  const estimatedScope = Number(estimatedScopeValue);

  const state = await orchestrator.addTask({
    id: taskId,
    title,
    description,
    type: type as (typeof sampleState.plan.tasks)[number]["type"],
    priority,
    status: "pending",
    dependencies: parseList(dependencyArg),
    acceptanceCriteria: parsePipeList(criteriaArg),
    estimatedScope,
    retryCount: 0,
  });

  console.log("Added task:", taskId);
  console.log("Task count:", state.plan.tasks.length);
}

async function setTaskStatus(orchestrator: Orchestrator, args: string[]): Promise<void> {
  const [taskId, status] = args;

  if (!taskId || !status) {
    console.error("Usage: npm run set-task-status -- <task-id> <status>");
    process.exitCode = 1;
    return;
  }

  const state = await orchestrator.updateTaskStatus(
    taskId,
    status as (typeof sampleState.plan.tasks)[number]["status"],
  );

  console.log("Updated task status:", taskId, "->", status);
  console.log("Ready tasks:", new Supervisor().runIteration(state.plan).readyTaskIds.join(", ") || "(none)");
}

async function setTaskDependencies(orchestrator: Orchestrator, args: string[]): Promise<void> {
  const [taskId, dependencyArg = ""] = args;

  if (!taskId) {
    console.error("Usage: npm run set-task-deps -- <task-id> [dep1,dep2]");
    process.exitCode = 1;
    return;
  }

  const state = await orchestrator.updateTaskDependencies(taskId, parseList(dependencyArg));
  const task = state.plan.tasks.find((candidate) => candidate.id === taskId);

  console.log("Updated dependencies for:", taskId);
  console.log("Dependencies:", task?.dependencies.join(", ") || "(none)");
}

async function bootstrapRepo(
  orchestrator: Orchestrator,
  profileStore: ProjectProfileStore,
  args: string[],
): Promise<void> {
  const [repoPath = process.cwd()] = args;
  const profiles = await profileStore.list();
  const bootstrap = await bootstrapWorkspace(repoPath, profiles);
  const state = await orchestrator.bootstrapWorkspace(bootstrap);

  console.log("Bootstrapped workspace:", state.workspace.name);
  console.log("Repo path:", state.workspace.repoPath);
  console.log("Active profile:", state.profile.id, `(${state.profile.name})`);
  console.log("Plan:", state.plan.id);
  console.log("Ready tasks:", new Supervisor().runIteration(state.plan).readyTaskIds.join(", ") || "(none)");
}

async function analyzeActiveRepo(orchestrator: Orchestrator): Promise<void> {
  const state = await orchestrator.loadState();
  const analysis = await analyzeRepo(state.workspace.repoPath, state.profile);
  const nextState = await orchestrator.recordAnalysis(analysis);

  console.log("Analyzed repo:", analysis.repoPath);
  console.log("Top-level directories:", analysis.topLevelDirectories.join(", ") || "(none)");
  console.log("Top-level files:", analysis.topLevelFiles.join(", ") || "(none)");
  console.log("Detected manifests:", analysis.manifests.join(", ") || "(none)");
  console.log("Summary:", analysis.summary);
  console.log("Memory record length:", nextState.memory.length);
}

async function seedPlanFromAnalysis(orchestrator: Orchestrator): Promise<void> {
  const state = await orchestrator.loadState();
  const analysis = await analyzeRepo(state.workspace.repoPath, state.profile);
  const generatedTasks = createSeedTasks(analysis).map((task) => ({
    ...task,
    status: "pending" as const,
    retryCount: 0,
  }));
  const nextState = await orchestrator.seedPlanTasks(generatedTasks);

  console.log("Seeded tasks from analysis:", generatedTasks.map((task) => task.id).join(", "));
  console.log(
    "Ready tasks:",
    new Supervisor().runIteration(nextState.plan).readyTaskIds.join(", ") || "(none)",
  );
}

async function writeArchitectureSummary(orchestrator: Orchestrator): Promise<void> {
  const state = await orchestrator.loadState();
  const analysis = await analyzeRepo(state.workspace.repoPath, state.profile);
  const summary = createArchitectureSummary(analysis);
  const nextState = await orchestrator.recordArchitectureSummary(summary);

  console.log("Architecture summary recorded.");
  console.log("Summary:", summary);
  console.log(
    "Ready tasks:",
    new Supervisor().runIteration(nextState.plan).readyTaskIds.join(", ") || "(none)",
  );
}

async function reviewActiveProfile(orchestrator: Orchestrator): Promise<void> {
  const state = await orchestrator.loadState();
  const analysis = await analyzeRepo(state.workspace.repoPath, state.profile);
  const summary = reviewProfileFit(analysis, state.profile);
  const nextState = await orchestrator.recordProfileReview(summary);

  console.log("Profile review recorded.");
  console.log("Summary:", summary);
  console.log(
    "Ready tasks:",
    new Supervisor().runIteration(nextState.plan).readyTaskIds.join(", ") || "(none)",
  );
}

function collectTaskIds(
  plan: typeof sampleState.plan,
  status: (typeof sampleState.plan.tasks)[number]["status"],
): string[] {
  return plan.tasks.filter((task) => task.status === status).map((task) => task.id);
}

function resolvePath(filePath: string): string {
  return filePath.startsWith("/") ? filePath : join(process.cwd(), filePath);
}

function parseList(value: string): string[] {
  if (!value.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePipeList(value: string): string[] {
  if (!value.trim()) {
    return [];
  }

  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}
