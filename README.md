# Mozart Orchestrator

General-purpose orchestration product for vibe coders.

## Current scope

This initial scaffold focuses on:

- a durable orchestration domain model
- a saved product plan
- a supervisor loop that selects the next ready task deterministically
- a file-backed state store with execution history and memory records
- project profiles and an approval-aware validation runner
- plan files that can be shown, loaded, exported, and reset
- CLI plan editing for adding tasks, changing status, and updating dependencies
- existing-repo bootstrap that detects a profile and seeds a starter plan
- repo analysis and analysis-based plan seeding for existing codebases
- executable onboarding commands for profile review and architecture summaries
- first worker loop with automatic research-task execution through `run-next`
- automatic multi-step execution through `run-until-blocked` for supported workers
- a small CLI that can inspect, advance, complete, and validate work

## Commands

```bash
npm install
npm run check
npm run build
npm run list-profiles
npm run use-profile -- <profile-id>
npm run status
npm run show-plan
npm run run-next
npm run run-until-blocked -- [max-iterations]
npm run complete-task -- <task-id> "<summary>"
npm run run-validation
npm run load-plan -- <path-to-plan-json> [preserve-runtime]
npm run export-plan -- <path-to-plan-json>
npm run reset-plan
npm run add-task -- <task-id> <type> <priority> <estimated-scope> "<title>" [description] [dep1,dep2] [criterion1|criterion2]
npm run set-task-status -- <task-id> <status>
npm run set-task-deps -- <task-id> [dep1,dep2]
npm run bootstrap-repo -- [path-to-existing-repo]
npm run analyze-repo
npm run seed-plan-from-analysis
npm run review-active-profile
npm run write-architecture-summary
```
