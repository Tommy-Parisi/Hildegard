import type { ProjectProfile, RepoAnalysis } from "./domain.js";
export declare function analyzeRepo(repoPath: string, profile: ProjectProfile): Promise<RepoAnalysis>;
export declare function createArchitectureSummary(analysis: RepoAnalysis): string;
export declare function reviewProfileFit(analysis: RepoAnalysis, profile: ProjectProfile): string;
export declare function createSeedTasks(analysis: RepoAnalysis): RepoSeedTask[];
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
export {};
