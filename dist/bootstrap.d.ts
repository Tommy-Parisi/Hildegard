import type { ProjectProfile, WorkspaceBootstrap } from "./domain.js";
export declare function bootstrapWorkspace(repoPathInput: string, profiles: ProjectProfile[]): Promise<WorkspaceBootstrap>;
