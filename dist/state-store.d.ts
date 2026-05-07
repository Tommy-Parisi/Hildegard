import type { OrchestrationState } from "./domain.js";
export declare class FileStateStore {
    private readonly filePath;
    constructor(filePath: string);
    load(): Promise<OrchestrationState | null>;
    save(state: OrchestrationState): Promise<void>;
}
