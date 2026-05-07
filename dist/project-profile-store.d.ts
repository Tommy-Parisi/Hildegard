import type { ProjectProfile } from "./domain.js";
export declare class ProjectProfileStore {
    private readonly profilesDir;
    constructor(profilesDir: string);
    list(): Promise<ProjectProfile[]>;
    getById(profileId: string): Promise<ProjectProfile | null>;
    private loadFromFile;
}
