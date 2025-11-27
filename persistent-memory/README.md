# Persistent Memory System

This directory contains the project's **persistent memory** - documentation and knowledge that persists across development sessions.

## Purpose

The persistent memory system helps maintain context, patterns, and decisions across:
- Development sessions with AI assistants
- Team member onboarding
- Feature implementation
- Bug fixes and maintenance

## Directory Structure

### 📄 Core Files

- **global-memory.md** - System architecture, tech stack, design patterns, conventions
- **session-handoff.md** - Current session state, active work, known issues, next priorities

### 🎯 Feature Documentation

- **feature-application-workflow.md** - Application review workflow system
- **feature-sandbox-demo.md** - Demo/sandbox environment features
- **feature-tenant-context.md** - Multi-tenant architecture
- **feature-gaps-triage.md** - Known issues and feature gaps

### ✅ Completed Features (`completed-features/`)

Documentation for fully implemented features:
- **QR_CODE_UPLOAD_FEATURE.md** - QR code mobile document upload system
- **FORM_GENERATION_UPDATE.md** - AI form generation with PDF support

### 📚 Implementation Guides (`implementation-guides/`)

Step-by-step guides for implementing complex features:
- **implementation-isolated-demo-ecosystems.md** - Demo ecosystem isolation
- **implementation-gated-demo.md** - Demo access control
- **workflow-system-implementation.md** - Workflow engine implementation
- **subdomain-deployment-guide.md** - Multi-tenant subdomain setup
- **demo-system-guide.md** - Demo system architecture

## Usage Guidelines

### For Development Sessions

**At Start of Session:**
1. Read `session-handoff.md` to understand current state
2. Review relevant feature docs for context
3. Check `feature-gaps-triage.md` for known issues

**During Session:**
- Update `session-handoff.md` with progress
- Reference `global-memory.md` for patterns
- Check implementation guides for how-tos

**At End of Session:**
- Update `session-handoff.md` with:
  - What was completed
  - What's in progress
  - Any new issues found
  - Next steps

### When Completing a Feature

1. Create comprehensive documentation in `completed-features/`
2. Include:
   - Overview and purpose
   - Architecture and design decisions
   - Code structure
   - Testing approach
   - Known limitations
   - Future enhancements
3. Move feature from in-progress to completed in `session-handoff.md`
4. Update `global-memory.md` if new patterns were established

### When Adding Implementation Guides

Create guides in `implementation-guides/` when:
- Feature is complex and multi-step
- Implementation requires architectural decisions
- Future features will follow similar patterns
- Onboarding needs detailed how-tos

Include:
- Prerequisites
- Step-by-step instructions
- Code examples
- Common pitfalls
- Testing approach

## File Naming Conventions

- **global-memory.md** - Singular, core system file
- **session-handoff.md** - Singular, current session context
- **feature-{name}.md** - Active feature documentation
- **implementation-{name}.md** - Implementation guides
- **{FEATURE_NAME}.md** - Completed feature docs (UPPERCASE)

## Maintenance

### Regular Updates

- **global-memory.md** - Update when:
  - Architecture changes
  - New patterns established
  - Tech stack changes
  - Major conventions adopted

- **session-handoff.md** - Update:
  - At start of each session
  - After completing tasks
  - When discovering issues
  - Before ending session

### Cleanup

- Archive old feature docs when deprecated
- Remove outdated implementation guides
- Keep global-memory.md current
- Consolidate redundant documentation

## Best Practices

1. **Be Specific** - Include code examples, file paths, line numbers
2. **Be Current** - Update docs as code changes
3. **Be Complete** - Include why, not just what
4. **Be Consistent** - Follow established patterns
5. **Be Helpful** - Write for future you and teammates

## Quick Reference

| Need to... | Check... |
|------------|----------|
| Understand the system | `global-memory.md` |
| See current work | `session-handoff.md` |
| Learn how to implement X | `implementation-guides/` |
| Reference completed feature | `completed-features/` |
| Find known issues | `feature-gaps-triage.md` |
| Understand multi-tenancy | `feature-tenant-context.md` |
| Work with workflows | `feature-application-workflow.md` |

---

**Remember**: This documentation is your project's long-term memory. Keep it accurate, current, and helpful!
