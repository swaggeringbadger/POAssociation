# Claude Code Instructions

**IMPORTANT:** This file tells Claude Code where to find project context and memory.

## Memory System

**Always read these files at the start of each session:**

1. `/home/runner/workspace/persistent-memory/session-handoff.md` - Current session state, active work, next priorities
2. `/home/runner/workspace/persistent-memory/global-memory.md` - Architecture, patterns, conventions
3. `/home/runner/workspace/global-memory.md` - Feature flag system documentation

## Directory Structure

```
/persistent-memory/
├── session-handoff.md          # START HERE - Current state & priorities
├── global-memory.md            # Architecture & patterns
├── feature-*.md                # Active feature documentation
├── completed-features/         # Completed feature docs
└── implementation-guides/      # Step-by-step guides
```

## Quick Reference

| Need to... | Read... |
|------------|---------|
| Understand current work | `persistent-memory/session-handoff.md` |
| Learn architecture | `persistent-memory/global-memory.md` |
| Check feature flags | `global-memory.md` (root) |
| Find implementation guide | `persistent-memory/implementation-guides/` |

## Session Protocol

### At Session Start
1. Read `session-handoff.md` for current state
2. Check git status for uncommitted changes
3. Review any TODO items or next steps

### At Session End
**Update `session-handoff.md` with:**
- What was completed
- What's in progress
- Any new issues found
- Next steps for future sessions

## Project Overview

**POA Association Portal** - Multi-tenant SaaS for HOA/POA community management.

### Tech Stack
- Frontend: React 19 + Vite + TailwindCSS + shadcn/ui
- Backend: Express.js + TypeScript + Drizzle ORM
- Database: PostgreSQL (Neon serverless)
- Storage: Azure Blob Storage
- Auth: Replit Auth
- AI: Anthropic Claude SDK

### Key Patterns
- Multi-tenant with subdomain isolation
- Role-based access control (8 roles)
- Demo code system for sandboxed environments
- Feature flags in `shared/featureDefinitions.ts`

## Development Notes

### Server Restart
After modifying `/server/` files, restart the server:
```bash
pkill -f "tsx server/index.ts"
```
Then click Run in Replit.

### Database Migrations
```bash
npm run db:push
```

### Common Commands
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run check        # TypeScript check
npm run test         # Run tests
```
