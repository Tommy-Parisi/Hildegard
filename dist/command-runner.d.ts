import type { ApprovalPolicy, CommandExecutionResult, ProjectCommand } from "./domain.js";
export declare class CommandRunner {
    run(command: ProjectCommand, approvalPolicy: ApprovalPolicy): Promise<CommandExecutionResult>;
}
