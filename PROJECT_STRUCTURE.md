# POA Association Portal - Project Structure

## Directory Organization

```
poassociation/
├── client/                          # React frontend application
│   ├── src/
│   │   ├── components/             # Reusable UI components
│   │   ├── pages/                  # Page components (routes)
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── lib/                    # Utilities and API client
│   │   └── App.tsx                 # Main app component
│   └── public/                     # Static assets
│
├── server/                          # Express backend application
│   ├── routes.ts                   # API route definitions
│   ├── storage.ts                  # Database access layer
│   ├── replitAuth.ts               # Authentication middleware
│   ├── azureBlobStorage.ts         # Azure Blob Storage integration
│   ├── aiFormGenerationService.ts  # AI-powered form generation
│   └── prompts/                    # AI prompt templates
│       ├── system-prompt.md
│       ├── user-prompt.md
│       └── README.md
│
├── shared/                          # Shared code between client/server
│   ├── schema.ts                   # Database schema (Drizzle ORM)
│   ├── formTypes.ts                # Form type definitions
│   └── additionalInfoTypes.ts      # Dynamic form schemas
│
├── persistent-memory/               # Project knowledge base
│   ├── global-memory.md            # System architecture & patterns
│   ├── session-handoff.md          # Session context & current work
│   ├── completed-features/         # Documentation of implemented features
│   │   ├── QR_CODE_UPLOAD_FEATURE.md
│   │   └── FORM_GENERATION_UPDATE.md
│   ├── implementation-guides/      # How-to guides for major features
│   │   ├── implementation-isolated-demo-ecosystems.md
│   │   ├── implementation-gated-demo.md
│   │   ├── workflow-system-implementation.md
│   │   ├── subdomain-deployment-guide.md
│   │   └── demo-system-guide.md
│   ├── feature-application-workflow.md
│   ├── feature-sandbox-demo.md
│   ├── feature-tenant-context.md
│   └── feature-gaps-triage.md
│
├── docs/                            # General documentation
│   ├── replit.md                   # Replit deployment guide
│   └── examples/                   # Example data & configurations
│       └── markland_structural_changes_example.json
│
├── scripts/                         # One-off utility scripts
│   └── add-emily-admin-role.ts     # Admin role assignment script
│
├── assets/                          # Project assets
│   └── generated_images/           # AI-generated images
│
├── dist/                            # Production build output
├── node_modules/                   # NPM dependencies
│
├── drizzle.config.ts               # Database ORM configuration
├── vite.config.ts                  # Vite build configuration
├── tsconfig.json                   # TypeScript configuration
├── package.json                    # NPM package manifest
└── .replit                         # Replit configuration

```

## Key Directories Explained

### `/persistent-memory`
**Purpose**: Long-term project knowledge that persists across sessions

- **global-memory.md** - System architecture, tech stack, patterns, conventions
- **session-handoff.md** - Current session state, what's being worked on, known issues
- **completed-features/** - Documentation of finished features with architecture details
- **implementation-guides/** - Step-by-step guides for implementing complex features
- **feature-*.md** - Active feature documentation and requirements

### `/server/prompts`
**Purpose**: AI prompt templates for form generation

Contains externalized prompt templates that can be edited without modifying code:
- `system-prompt.md` - Defines Claude's role and output structure
- `user-prompt.md` - Instructions for processing design guidelines

### `/docs`
**Purpose**: General documentation and reference materials

- Deployment guides
- API documentation
- Example data and configurations

### `/scripts`
**Purpose**: One-off utility scripts and maintenance tasks

Contains standalone scripts for database migrations, data fixes, admin tasks, etc.

### `/assets`
**Purpose**: Project assets and generated content

- Generated images
- Design assets
- Media files

## File Naming Conventions

### Markdown Documentation
- `UPPERCASE_FEATURE.md` - Major feature documentation in root folders
- `lowercase-guide.md` - Implementation guides
- `feature-name.md` - Feature specifications
- `implementation-name.md` - Implementation details

### TypeScript/JavaScript
- `camelCase.ts` - Services, utilities, configs
- `PascalCase.tsx` - React components
- `kebab-case.ts` - Scripts and utilities

### Directories
- `lowercase/` - All directories use lowercase
- `kebab-case/` - Multi-word directories use hyphens

## Development Workflow

### Adding New Features
1. Document requirements in `/persistent-memory/feature-{name}.md`
2. Implement code in appropriate directories
3. Update `/persistent-memory/session-handoff.md` with progress
4. Upon completion, create documentation in `/persistent-memory/completed-features/`

### AI Prompt Management
1. Edit prompts in `/server/prompts/*.md`
2. Test changes without modifying code
3. Version control prompt changes separately

### Database Changes
1. Update `/shared/schema.ts`
2. Run `npm run db:push` to apply migrations
3. Update `/persistent-memory/global-memory.md` if schema patterns change

## Quick Reference

### Start Development
```bash
npm run dev              # Start dev server (client + server)
npm run build           # Build for production
npm run db:push         # Apply database schema changes
```

### Key Files to Know
- `/persistent-memory/global-memory.md` - Start here to understand the system
- `/persistent-memory/session-handoff.md` - See current work and issues
- `/shared/schema.ts` - Database schema
- `/server/routes.ts` - API endpoints

### Documentation Updates
- **After implementing a feature**: Add to `/persistent-memory/completed-features/`
- **When fixing a bug**: Update `/persistent-memory/session-handoff.md`
- **New architectural pattern**: Update `/persistent-memory/global-memory.md`

## Cleanup Guidelines

### Files That Should NOT Be in Root
- ❌ Feature documentation (→ `/persistent-memory/completed-features/`)
- ❌ Implementation guides (→ `/persistent-memory/implementation-guides/`)
- ❌ One-off scripts (→ `/scripts/`)
- ❌ Example data (→ `/docs/examples/`)
- ❌ Temporary files (delete them!)

### Files That CAN Be in Root
- ✅ Configuration files (tsconfig.json, vite.config.ts, etc.)
- ✅ Package management (package.json, package-lock.json)
- ✅ Environment files (.env, .env.example)
- ✅ README.md
- ✅ PROJECT_STRUCTURE.md (this file)

## Recent Reorganization (2025-11-27)

Cleaned up root directory and organized documentation:
- Moved `QR_CODE_UPLOAD_FEATURE.md` → `persistent-memory/completed-features/`
- Moved `FORM_GENERATION_UPDATE.md` → `persistent-memory/completed-features/`
- Moved implementation guides → `persistent-memory/implementation-guides/`
- Moved `add-emily-admin-role.ts` → `scripts/`
- Moved `replit.md` → `docs/`
- Renamed `attached_assets/` → `assets/`
- Moved example JSON → `docs/examples/`
- Removed temporary files

Result: Clean root directory with logical organization!
