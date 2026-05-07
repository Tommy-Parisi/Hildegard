import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";

import type { ProjectProfile, RepoAnalysis } from "./domain.js";

const manifestCandidates = [
  "Cargo.toml",
  "package.json",
  "tsconfig.json",
  "pyproject.toml",
  "go.mod",
  "README.md",
];

export async function analyzeRepo(
  repoPath: string,
  profile: ProjectProfile,
): Promise<RepoAnalysis> {
  const entries = await readdir(repoPath, { withFileTypes: true });
  const visibleEntries = entries.filter((entry) => !entry.name.startsWith("."));

  const topLevelDirectories = visibleEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !profile.ignoredPaths.includes(name))
    .sort();

  const topLevelFiles = visibleEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();

  const manifests = manifestCandidates.filter((name) =>
    topLevelFiles.includes(name),
  );
  const subsystems = await discoverSubsystems(repoPath, profile);

  return {
    repoPath,
    profileId: profile.id,
    topLevelDirectories,
    topLevelFiles,
    manifests,
    subsystems,
    summary: createSummary(
      repoPath,
      profile,
      topLevelDirectories,
      topLevelFiles,
      manifests,
      subsystems,
    ),
  };
}

export function createArchitectureSummary(analysis: RepoAnalysis): string {
  const subsystemSummary = analysis.subsystems.length
    ? analysis.subsystems.join(", ")
    : "no subsystem hints detected";
  const manifestSummary = analysis.manifests.length
    ? analysis.manifests.join(", ")
    : "no common manifests detected";

  return [
    `Architecture summary for ${basename(analysis.repoPath)}.`,
    `Primary profile: ${analysis.profileId}.`,
    `Detected manifests: ${manifestSummary}.`,
    `Likely subsystem entry points: ${subsystemSummary}.`,
    `Top-level directories: ${analysis.topLevelDirectories.join(", ") || "(none)"}.`,
  ].join(" ");
}

export function reviewProfileFit(
  analysis: RepoAnalysis,
  profile: ProjectProfile,
): string {
  const hasValidationCommands = profile.commands.some(
    (command) => command.category === "validation",
  );
  const profileMatchesPackageJson =
    profile.id === "typescript-node" && analysis.manifests.includes("package.json");
  const profileMatchesCargo =
    profile.id === "rust-generic" && analysis.manifests.includes("Cargo.toml");
  const manifestMatch = profileMatchesPackageJson || profileMatchesCargo;

  return [
    `Profile review for ${basename(analysis.repoPath)} using ${profile.name}.`,
    manifestMatch
      ? "Detected manifests are consistent with the active profile."
      : "Detected manifests only partially match the active profile.",
    hasValidationCommands
      ? "Validation commands are configured for this profile."
      : "No validation commands are configured for this profile.",
    `Detected manifests: ${analysis.manifests.join(", ") || "(none)"}.`,
  ].join(" ");
}

export function createSeedTasks(analysis: RepoAnalysis): RepoSeedTask[] {
  const repoName = basename(analysis.repoPath);
  const sourceHint = analysis.subsystems[0] ?? analysis.topLevelDirectories[0] ?? "src";
  const validationHint = analysis.manifests[0] ?? "project manifests";

  return [
    {
      id: "task_architecture_summary",
      title: "Write architecture summary",
      description: `Summarize the main subsystems in ${repoName}, starting from ${sourceHint} and the detected manifests.`,
      type: "research",
      priority: 2,
      dependencies: ["task_repo_map"],
      acceptanceCriteria: ["The main modules and responsibilities are documented."],
      estimatedScope: 2,
    },
    {
      id: "task_validation_baseline_followup",
      title: "Review validation baseline",
      description: `Inspect the active profile commands and ${validationHint} to capture what currently passes, fails, or is missing.`,
      type: "validation",
      priority: 2,
      dependencies: ["task_profile_review", "task_run_validation"],
      acceptanceCriteria: ["Validation outcomes are summarized with follow-up actions."],
      estimatedScope: 2,
    },
    {
      id: "task_first_work_slice",
      title: "Define first work slice",
      description: `Choose the first implementation-ready slice inside ${repoName}, starting from ${sourceHint}, and break it into concrete subtasks.`,
      type: "planning",
      priority: 2,
      dependencies: ["task_architecture_summary", "task_seed_plan"],
      acceptanceCriteria: ["At least one project-specific implementation task is ready."],
      estimatedScope: 3,
    },
  ];
}

interface RepoSeedTask {
  id: string;
  title: string;
  description: string;
  type: "research" | "planning" | "implementation" | "validation" | "review";
  priority: number;
  dependencies: string[];
  acceptanceCriteria: string[];
  estimatedScope: number;
}

function createSummary(
  repoPath: string,
  profile: ProjectProfile,
  topLevelDirectories: string[],
  topLevelFiles: string[],
  manifests: string[],
  subsystems: string[],
): string {
  const repoName = basename(repoPath);
  const directorySummary = topLevelDirectories.length
    ? topLevelDirectories.join(", ")
    : "no top-level directories";
  const fileSummary = topLevelFiles.length ? topLevelFiles.join(", ") : "no top-level files";
  const manifestSummary = manifests.length ? manifests.join(", ") : "no common manifests detected";
  const subsystemSummary = subsystems.length ? subsystems.join(", ") : "no subsystem hints detected";

  return [
    `Repository ${repoName} is currently using the ${profile.name} profile.`,
    `Top-level directories: ${directorySummary}.`,
    `Top-level files: ${fileSummary}.`,
    `Detected manifests: ${manifestSummary}.`,
    `Important subsystems: ${subsystemSummary}.`,
  ].join(" ");
}

async function discoverSubsystems(repoPath: string, profile: ProjectProfile): Promise<string[]> {
  const subsystemHints: string[] = [];

  for (const importantPath of profile.importantPaths) {
    const fullPath = join(repoPath, importantPath);

    try {
      const entries = await readdir(fullPath, { withFileTypes: true });
      const interestingEntries = entries
        .filter((entry) => !entry.name.startsWith("."))
        .filter((entry) => !profile.ignoredPaths.includes(entry.name))
        .slice(0, 6)
        .map((entry) => `${importantPath}/${entry.name}`);

      if (interestingEntries.length > 0) {
        subsystemHints.push(...interestingEntries);
      } else {
        subsystemHints.push(importantPath);
      }
    } catch {
      continue;
    }
  }

  return Array.from(new Set(subsystemHints));
}
