import type {
  ApprovalPolicy,
  OrchestrationState,
  Plan,
  ProjectProfile,
  Workspace,
} from "./domain.js";

export const sampleWorkspace: Workspace = {
  id: "workspace_mozart",
  name: "Mozart",
  repoPath: "/Users/tommy/Projects/GotGuessr/Mozart",
  profileId: "typescript-node",
};

export const sampleApprovalPolicy: ApprovalPolicy = {
  mode: "auto_safe",
  requireApprovalFor: ["deploy", "migration", "live_trading"],
  autoApproveFor: ["read", "search", "planning", "validation"],
};

export const sampleProfile: ProjectProfile = {
  id: "typescript-node",
  name: "TypeScript Node Service",
  languageHints: ["typescript", "node"],
  importantPaths: ["src", "docs"],
  ignoredPaths: ["dist", "node_modules"],
  commands: [
    {
      id: "npm-check",
      name: "Typecheck",
      command: "npm run check",
      category: "validation",
      description: "Run the TypeScript compiler in no-emit mode.",
    },
    {
      id: "npm-build",
      name: "Build",
      command: "npm run build",
      category: "validation",
      description: "Compile the TypeScript project.",
    },
  ],
  safetyNotes: [
    "Require explicit approval before enabling autonomous commands that can change production behavior.",
    "Prefer scoped validation before whole-repo validation for large projects.",
  ],
};

export const samplePlan: Plan = {
  id: "plan_v1",
  goal: "Ship the first reusable orchestration engine for vibe coders.",
  status: "active",
  workspaceId: sampleWorkspace.id,
  globalAcceptanceCriteria: [
    "The orchestrator can store a durable plan graph.",
    "The supervisor can choose the next ready task deterministically.",
    "The project can be extended with stack-specific profiles later.",
  ],
  approvalPolicy: sampleApprovalPolicy,
  tasks: [
    {
      id: "task_foundation",
      title: "Create domain model",
      description: "Define the core plan, task, workspace, and profile contracts.",
      type: "planning",
      priority: 3,
      status: "done",
      dependencies: [],
      acceptanceCriteria: ["Core orchestration types exist."],
      estimatedScope: 1,
      retryCount: 0,
    },
    {
      id: "task_supervisor",
      title: "Implement supervisor selection loop",
      description: "Pick the next ready task from a plan graph using deterministic rules.",
      type: "implementation",
      priority: 3,
      status: "pending",
      dependencies: ["task_foundation"],
      acceptanceCriteria: ["A ready task is selected deterministically."],
      estimatedScope: 1,
      retryCount: 0,
    },
    {
      id: "task_memory",
      title: "Design durable memory layer",
      description: "Add memory tiers and artifact references for large-project continuity.",
      type: "research",
      priority: 2,
      status: "pending",
      dependencies: ["task_supervisor"],
      acceptanceCriteria: ["Memory contracts are defined."],
      estimatedScope: 2,
      retryCount: 0,
    },
    {
      id: "task_ui",
      title: "Outline chat and task board UX",
      description: "Describe the first visible product surfaces for the orchestrator.",
      type: "planning",
      priority: 2,
      status: "ready",
      dependencies: ["task_foundation"],
      acceptanceCriteria: ["The first product surfaces are named and scoped."],
      estimatedScope: 3,
      retryCount: 0,
    },
  ],
};

export const sampleState: OrchestrationState = {
  workspace: sampleWorkspace,
  profile: sampleProfile,
  plan: samplePlan,
  executionHistory: [],
  memory: [],
};
