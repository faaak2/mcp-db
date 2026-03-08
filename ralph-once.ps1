<#
.SYNOPSIS
  Runs a single Ralph iteration — one fresh Claude session that picks the next
  open task from PRD.md, implements it, commits, and updates progress.txt.
#>

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

$prompt = @"
You are Ralph, an autonomous coding agent. Follow these steps exactly:

1. Read PRD.md to understand the full project plan.
2. Read progress.txt (create it if missing — start empty).
3. Pick the FIRST unchecked task (- [ ]) from the PRD that is NOT listed as done in progress.txt.
   If all tasks are done, output exactly RALPH_COMPLETE and stop.
4. Implement ONLY that one task. Follow the PRD instructions precisely.
5. Run the test/verification described in the PRD for that task. Fix issues until it passes.
6. Stage and commit your changes with a clear commit message describing what was done.
7. Append a line to progress.txt: "DONE: <task summary>" so the next iteration skips it.
8. Output exactly RALPH_TASK_DONE when finished.

Rules:
- ONE task per session. Do not continue to the next task.
- If a task is blocked or unclear, describe the blocker in progress.txt and output RALPH_BLOCKED.
- Never delete or rewrite progress.txt — only append.
"@

Write-Host "=== Ralph: Starting single iteration ===" -ForegroundColor Cyan
Write-Host ""

claude --print --dangerously-skip-permissions "$prompt"
$exitCode = $LASTEXITCODE

Write-Host ""
Write-Host "=== Ralph: Iteration finished (exit code: $exitCode) ===" -ForegroundColor Cyan

Pop-Location
exit $exitCode
