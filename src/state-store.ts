import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { CommandCategory, OrchestrationState, ProjectCommand, ProjectProfile } from "./domain.js";

export class FileStateStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<OrchestrationState | null> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return normalizeState(JSON.parse(raw) as Partial<OrchestrationState>);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  async save(state: OrchestrationState): Promise<void> {
    const directory = dirname(this.filePath);
    const tempFilePath = join(
      directory,
      `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
    );

    await mkdir(directory, { recursive: true });
    await writeFile(tempFilePath, JSON.stringify(state, null, 2));
    await rename(tempFilePath, this.filePath);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function normalizeState(state: Partial<OrchestrationState>): OrchestrationState {
  if (!state.workspace || !state.profile || !state.plan) {
    throw new Error("Persisted state is missing required orchestration fields.");
  }

  const normalizedProfile = normalizeProfile(state.profile as Partial<ProjectProfile>);
  const normalizedPlan = {
    ...state.plan,
    approvalPolicy: {
      ...state.plan.approvalPolicy,
      requireApprovalFor: normalizeCategories(state.plan.approvalPolicy.requireApprovalFor ?? []),
      autoApproveFor: normalizeCategories(state.plan.approvalPolicy.autoApproveFor ?? []),
    },
  };

  return {
    workspace: state.workspace,
    profile: normalizedProfile,
    plan: normalizedPlan,
    executionHistory: state.executionHistory ?? [],
    memory: state.memory ?? [],
  };
}

function normalizeProfile(profile: Partial<ProjectProfile>): ProjectProfile {
  return {
    id: profile.id ?? "unknown_profile",
    name: profile.name ?? "Unknown Profile",
    languageHints: profile.languageHints ?? [],
    importantPaths: profile.importantPaths ?? [],
    ignoredPaths: profile.ignoredPaths ?? [],
    commands: normalizeCommands(profile),
    safetyNotes: profile.safetyNotes ?? [],
  };
}

function normalizeCommands(profile: Partial<ProjectProfile>): ProjectCommand[] {
  if (profile.commands) {
    return profile.commands;
  }

  const legacyValidationCommands = (profile as LegacyProjectProfile).validationCommands ?? [];

  return legacyValidationCommands.map((command, index) => ({
    id: `legacy_validation_${index + 1}`,
    name: `Validation ${index + 1}`,
    command,
    category: "validation",
    description: "Migrated legacy validation command.",
  }));
}

interface LegacyProjectProfile {
  validationCommands?: string[];
}

function normalizeCategories(values: string[]): CommandCategory[] {
  const mapped = values
    .map((value) => legacyCategoryMap[value] ?? value)
    .filter(isCommandCategory);

  return Array.from(new Set(mapped));
}

const legacyCategoryMap: Record<string, CommandCategory> = {
  reads: "read",
  searches: "search",
  "scoped validation": "validation",
  "production deploys": "deploy",
  "schema migrations": "migration",
  "commands touching live trading flows": "live_trading",
};

function isCommandCategory(value: string): value is CommandCategory {
  return (
    value === "read" ||
    value === "search" ||
    value === "planning" ||
    value === "validation" ||
    value === "edit" ||
    value === "deploy" ||
    value === "migration" ||
    value === "live_trading"
  );
}
