export type PlanStatus = "draft" | "active" | "blocked" | "completed";

export type TaskStatus =
  | "pending"
  | "ready"
  | "in_progress"
  | "blocked"
  | "done"
  | "cancelled"
  | "needs_review";

export type TaskType =
  | "research"
  | "planning"
  | "implementation"
  | "validation"
  | "review";

export type ApprovalMode = "manual" | "auto_safe" | "full_auto";

export type ExecutionStatus = "selected" | "completed" | "blocked";

export type MemoryKind = "working" | "episodic" | "semantic";

export type CommandCategory =
  | "read"
  | "search"
  | "planning"
  | "validation"
  | "edit"
  | "deploy"
  | "migration"
  | "live_trading";

export interface Workspace {
  id: string;
  name: string;
  repoPath: string;
  profileId: string;
}

export interface WorkspaceBootstrap {
  workspace: Workspace;
  profile: ProjectProfile;
  plan: Plan;
}

export interface RepoAnalysis {
  repoPath: string;
  profileId: string;
  topLevelDirectories: string[];
  topLevelFiles: string[];
  manifests: string[];
  subsystems: string[];
  summary: string;
}

export interface ProjectProfile {
  id: string;
  name: string;
  languageHints: string[];
  importantPaths: string[];
  ignoredPaths: string[];
  commands: ProjectCommand[];
  safetyNotes: string[];
}

export interface ApprovalPolicy {
  mode: ApprovalMode;
  requireApprovalFor: CommandCategory[];
  autoApproveFor: CommandCategory[];
}

export interface ProjectCommand {
  id: string;
  name: string;
  command: string;
  category: CommandCategory;
  description: string;
  requiresApproval?: boolean;
}

export interface TaskNode {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  priority: number;
  status: TaskStatus;
  dependencies: string[];
  acceptanceCriteria: string[];
  estimatedScope: number;
  owner?: string;
  retryCount: number;
}

export interface Plan {
  id: string;
  goal: string;
  status: PlanStatus;
  workspaceId: string;
  globalAcceptanceCriteria: string[];
  tasks: TaskNode[];
  approvalPolicy: ApprovalPolicy;
}

export interface ExecutionRecord {
  id: string;
  planId: string;
  taskId: string;
  status: ExecutionStatus;
  summary: string;
  timestamp: string;
}

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  taskId?: string;
  summary: string;
  source: string;
  timestamp: string;
}

export interface NextTaskDecision {
  taskId: string;
  reason: string;
}

export interface SupervisorIterationResult {
  decision: NextTaskDecision | null;
  readyTaskIds: string[];
  blockedTaskIds: string[];
  updatedPlan: Plan;
  executionRecord: ExecutionRecord | null;
}

export interface OrchestrationState {
  workspace: Workspace;
  profile: ProjectProfile;
  plan: Plan;
  executionHistory: ExecutionRecord[];
  memory: MemoryRecord[];
}

export interface CommandExecutionResult {
  commandId: string;
  command: string;
  approved: boolean;
  status: "executed" | "skipped";
  summary: string;
  output?: string;
}

export type WorkerKind = "research" | "planner" | "validation" | "code" | "review";

export interface WorkerAssignment {
  workerKind: WorkerKind;
  taskId: string;
  reason: string;
}

export interface WorkerResult {
  workerKind: WorkerKind;
  taskId: string;
  summary: string;
  memoryKind: MemoryKind;
  status: "completed" | "blocked";
  generatedTasks?: TaskNode[];
  memorySource?: string;
}
