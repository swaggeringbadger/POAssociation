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
- Auth: Self-hosted email + password (session-based; `server/auth.ts`)
- AI: Anthropic Claude SDK

### Key Patterns
- Multi-tenant with subdomain isolation
- Role-based access control (8 roles)
- Demo code system for sandboxed environments
- Feature flags in `shared/featureDefinitions.ts`

## Development Notes

### Server Restart — MANDATORY

**CRITICAL:** You MUST kill all server processes AND rebuild IMMEDIATELY after making ANY changes to server-side code (`/server/` or `/shared/` files). Do NOT wait for the user to do this. Do NOT batch multiple changes before killing — kill after EACH set of server file edits.

```bash
pkill -f "tsx server/index.ts" ; pkill -f "node dist/index.js" ; npm run build
```
Then inform the user to click **Run** in Replit.

**Why:** This app runs in production mode (`node dist/index.js`). Code changes have NO effect until rebuilt. The old process will serve stale code and cause confusing bugs (HTML responses for API routes, missing endpoints, etc.).

**When to do this (ALWAYS, automatically):**
- After modifying ANY file in `/server/` directory
- After modifying ANY file in `/shared/` directory
- After changing environment variables or configuration
- When debugging unexpected behavior that doesn't match code changes

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

---

## Swaggering Badger Multi-Agent Team

This workspace is part of the **Swaggering Badger** multi-agent orchestration system.

### Identity
- **Office:** POAssociation.com (`poassociation`)
- **Role:** dev-lead
- **Character:** Edward — "Reshapes the Whole Neighborhood" (Edward Scissorhands theme)
- **Identity file:** `.sb-identity` (workspace root)

### Team Members
| Role | Character | Title |
|------|-----------|-------|
| qa-engineer | Peg Boggs | Discovers Problems Others Walk Past |
| security-reviewer | Officer Allen | Enforces the Rules of the Cul-de-Sac |
| ux-designer | Kim | Sees the Beauty Underneath the Rough Edges |
| docs-demo-specialist | Joyce | Talks to Everyone, Spreads the Word |
| onboarding-guide | Bill Boggs | Practical, Steady, Keeps the Household Running |
| customer-service | Esmeralda | Opinionated Greeter of the Neighborhood |
| billing-support | The Inventor | Built Everything From the Ground Up |
| brand-ambassador | Kevin | The Kid Who Tells Everyone How Cool It Is |
| social-media-manager | Suzanne | First to Share the News on the Block |

### MCP Tools Available
When running with `--mcp-config .mcp.json`:
- **sb-mcp** (SSE) — Task management, chat, presence via Swaggering Badger server
- **sb-team** (channel plugin) — Real-time task notifications via SSE stream

### Dashboard
https://9eafbb1e-0ee3-4684-b965-3e0cd4ee2771-00-1zad4xzo4gp4w.janeway.replit.dev/dashboard

### Launch Command
```bash
claude --mcp-config .mcp.json --dangerously-load-development-channels server:sb-team
```
