# greenscape

Global rules inherit from `~/CLAUDE.md`. This file carries the rule below with the repo.

## Fable 5.1 never codes (standing rule, 2026-09-09)

Fable 5.1 is the logic layer only: it answers questions, plans in plain English, partitions work, triages, and reviews diffs. **It never writes or edits code itself.**

- Any build / fix / agent-loop request: Fable plans first, then hands ALL implementation to lower models via the Agent tool or the orchestrator Workflow.
- Implementation: **Sonnet** (code fixes, verification, judgment) or **Opus** (harder implementation). **Haiku** for finders and mechanical edits. Never spawn Fable-tier subagents.
- No direct Edit/Write/sed code changes from the Fable session. Only exceptions: rule/memory/notes files, and a one-line config toggle Julian explicitly asks for in the moment.
- Fable reviews after the lower model finishes (diff, tests, render check), then reports back. Commits and pushes stay with the Fable session.
