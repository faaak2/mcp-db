## Scope Rule
- Thorough inside the task boundary, hands-off outside it
- Within scope: find root causes, don't patch symptoms
- Outside scope: don't touch it, even if it's ugly

## Plan Mode
- Use plan mode when there are multiple valid approaches or architectural decisions
- If something goes sideways, STOP and re-plan — don't keep pushing
- Skip plan mode when the path is obvious, even if many steps

## Self-Improvement Loop
- After ANY correction, update auto-memory (MEMORY.md or topic files)
- Write rules that prevent the same mistake recurring
- Keep MEMORY.md as concise index, use topic files for details

## Verification
- Never mark a task complete without proving it works
- Run tests, check logs, demonstrate correctness
- "Would a staff engineer approve this?"

## Bug Fixing
- When given a bug: fix it autonomously
- Follow logs and errors to root cause, then resolve

## Deployment

### Transport-Logik (`src/index.ts`)
- `PORT` env var gesetzt → Streamable HTTP
- Kein `PORT` → stdio (lokale Nutzung via Claude Desktop/Claude Code)

### Lokaler Test HTTP-Modus
```bash
npm run serve   # startet auf PORT=3000
```
