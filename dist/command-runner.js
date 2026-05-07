import { exec } from "node:child_process";
import { promisify } from "node:util";
const execAsync = promisify(exec);
export class CommandRunner {
    async run(command, approvalPolicy) {
        const approved = isCommandApproved(command, approvalPolicy);
        if (!approved) {
            return {
                commandId: command.id,
                command: command.command,
                approved: false,
                status: "skipped",
                summary: `Skipped "${command.name}" because approval policy requires manual confirmation for ${command.category}.`,
            };
        }
        try {
            const { stdout, stderr } = await execAsync(command.command, {
                cwd: process.cwd(),
            });
            const output = [stdout, stderr].filter(Boolean).join("\n").trim();
            return {
                commandId: command.id,
                command: command.command,
                approved: true,
                status: "executed",
                summary: `Executed "${command.name}" successfully.`,
                output,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                commandId: command.id,
                command: command.command,
                approved: true,
                status: "executed",
                summary: `Executed "${command.name}" with errors.`,
                output: message,
            };
        }
    }
}
function isCommandApproved(command, approvalPolicy) {
    if (approvalPolicy.mode === "full_auto") {
        return true;
    }
    if (command.requiresApproval) {
        return false;
    }
    if (approvalPolicy.mode === "manual") {
        return false;
    }
    if (approvalPolicy.requireApprovalFor.includes(command.category)) {
        return false;
    }
    return approvalPolicy.autoApproveFor.includes(command.category);
}
