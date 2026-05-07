# General-Purpose Orchestration Product for Vibe Coders

## Summary

Build v1 as a general orchestration product that helps users turn messy intent into a durable execution loop: a visible plan, the next best step, bounded execution, and continuous iteration without losing context. The system should work across repos and stacks by keeping the core engine generic and loading project-specific behavior through profiles, adapters, and policy packs.

The product should feel like `chat + task board + autonomous project memory`. Users can describe what they want in natural language, inspect a structured plan graph, approve or relax execution gates, and let the system continue iterating on a predetermined detailed plan over time. The central scaling principle is that durable state lives outside the model: plans, memory, artifacts, decisions, and repo knowledge are persisted and retrieved as needed rather than carried in the prompt.

## Product Shape

### 1. Core user experience

The primary experience is a chat interface paired with a task board. Users can describe a goal in natural language, review or edit the generated plan graph, see the current next step and why it was chosen, approve or deny actions, and resume work later without losing progress.

### 2. Core product entities

Use these generic entities across all projects:

- `Workspace`
- `ProjectProfile`
- `Plan`
- `TaskNode`
- `ExecutionRun`
- `Artifact`
- `MemoryRecord`
- `ApprovalPolicy`
- `Blocker`

## Implementation Changes

### 1. Generic orchestration engine

Implement a single `Supervisor` that owns all durable state changes. It loads plan state and relevant memory, chooses the next ready task, assigns bounded worker runs, validates results against acceptance criteria, updates task state, and triggers retry or escalation when needed.

### 2. Memory system for large projects

Implement three memory tiers:

- working memory
- episodic memory
- semantic memory

Use a context assembler that retrieves only task-relevant files, summaries, and decisions rather than relying on long transcripts.

### 3. Project profiles and adapters

Move repo-specific behavior into profiles and adapters:

- `RepoAdapter`
- `CommandAdapter`
- `SearchAdapter`
- `PatchAdapter`
- `PolicyAdapter`

### 4. Worker model

Use bounded workers:

- `PlannerWorker`
- `ResearchWorker`
- `CodeWorker`
- `ValidationWorker`
- `ReviewWorker`

Only the supervisor can write plan state or durable memory.

### 5. Product UX and control surfaces

The first product should expose chat, task board, plan graph, memory, approval controls, and run controls. Default autonomy is approval-gated with presets that can become more autonomous later.

## Test Plan

- selects the correct next task from a dependency graph
- resumes correctly after restart with no transcript dependence
- preserves plan continuity across many iterations
- retrieves only relevant subsystem memory for a task
- supports Rust, TypeScript, and Python profiles through configuration
- pauses sensitive actions for approval under default policy

## Assumptions and Defaults

- The orchestrator is a productized, general-purpose tool, not a Rust-specific tool.
- The main experience is chat plus a visible task board and plan graph.
- Default autonomy is approval-gated.
- Persisted plan and memory state are the source of truth.
- v1 uses a single supervisor with bounded workers.
