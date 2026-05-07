import { access } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
const defaultApprovalPolicy = {
    mode: "auto_safe",
    requireApprovalFor: ["deploy", "migration", "live_trading"],
    autoApproveFor: ["read", "search", "planning", "validation"],
};
export async function bootstrapWorkspace(repoPathInput, profiles) {
    const repoPath = resolve(repoPathInput);
    const detectedProfile = await detectProfile(repoPath, profiles);
    const workspace = createWorkspace(repoPath, detectedProfile.id);
    const plan = createStarterPlan(workspace, detectedProfile);
    return {
        workspace,
        profile: detectedProfile,
        plan,
    };
}
async function detectProfile(repoPath, profiles) {
    if (await fileExists(join(repoPath, "Cargo.toml"))) {
        return requireProfile("rust-generic", profiles);
    }
    if (await fileExists(join(repoPath, "package.json"))) {
        return requireProfile("typescript-node", profiles);
    }
    return profiles[0] ?? {
        id: "generic",
        name: "Generic Repository",
        languageHints: [],
        importantPaths: ["src", "docs"],
        ignoredPaths: ["node_modules", "dist", "target"],
        commands: [],
        safetyNotes: ["Review generated commands and profile settings before autonomous execution."],
    };
}
function createWorkspace(repoPath, profileId) {
    const slug = toSlug(basename(repoPath));
    return {
        id: `workspace_${slug}`,
        name: basename(repoPath),
        repoPath,
        profileId,
    };
}
function createStarterPlan(workspace, profile) {
    const repoName = workspace.name;
    return {
        id: `plan_${toSlug(repoName)}_starter`,
        goal: `Understand and begin structured work on ${repoName}.`,
        status: "active",
        workspaceId: workspace.id,
        globalAcceptanceCriteria: [
            "The repo has an active project profile.",
            "The initial architecture and workflow are documented in task memory.",
            "The next implementation-ready task can be selected deterministically.",
        ],
        approvalPolicy: defaultApprovalPolicy,
        tasks: [
            {
                id: "task_repo_map",
                title: "Map repository structure",
                description: `Inspect ${repoName} and identify the main modules, entrypoints, and important directories.`,
                type: "research",
                priority: 3,
                status: "ready",
                dependencies: [],
                acceptanceCriteria: ["Key directories and subsystem boundaries are summarized."],
                estimatedScope: 2,
                retryCount: 0,
            },
            {
                id: "task_profile_review",
                title: "Review active profile",
                description: `Confirm that the ${profile.name} profile matches the repo's build and validation workflow.`,
                type: "planning",
                priority: 3,
                status: "ready",
                dependencies: [],
                acceptanceCriteria: ["The chosen profile is validated or adjusted."],
                estimatedScope: 1,
                retryCount: 0,
            },
            {
                id: "task_seed_plan",
                title: "Seed project-specific execution plan",
                description: `Break the repo's immediate roadmap into concrete tasks with dependencies and acceptance criteria.`,
                type: "planning",
                priority: 2,
                status: "pending",
                dependencies: ["task_repo_map", "task_profile_review"],
                acceptanceCriteria: ["There is at least one ready implementation or validation task."],
                estimatedScope: 3,
                retryCount: 0,
            },
            {
                id: "task_run_validation",
                title: "Run baseline validation",
                description: "Execute the profile's validation commands to establish the current repo baseline.",
                type: "validation",
                priority: 2,
                status: "pending",
                dependencies: ["task_profile_review"],
                acceptanceCriteria: ["Baseline validation output is recorded."],
                estimatedScope: 2,
                retryCount: 0,
            },
        ],
    };
}
async function fileExists(filePath) {
    try {
        await access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
function requireProfile(profileId, profiles) {
    const profile = profiles.find((candidate) => candidate.id === profileId);
    if (!profile) {
        throw new Error(`Profile "${profileId}" is not available.`);
    }
    return profile;
}
function toSlug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
