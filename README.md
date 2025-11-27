# POA Association Portal

Multi-tenant SaaS platform for Property Owners Associations (POA) and Homeowners Associations (HOA) to manage architectural review applications, workflows, and community governance.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your DATABASE_URL, ANTHROPIC_API_KEY, AZURE_STORAGE credentials

# Apply database schema
npm run db:push

# Start development server
npm run dev
```

Visit `http://localhost:5000`

## 🏗️ Tech Stack

- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4 + shadcn/ui
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **Storage**: Azure Blob Storage
- **AI**: Anthropic Claude (Sonnet 4.5)
- **Auth**: Replit Auth

## 📁 Project Structure

See **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)** for detailed directory organization.

```
├── client/              # React frontend
├── server/              # Express backend
├── shared/              # Shared types & schemas
├── persistent-memory/   # Project knowledge base
├── docs/                # Documentation
├── scripts/             # Utility scripts
└── assets/              # Project assets
```

## 🎯 Key Features

- **Multi-Tenant Architecture**: Subdomain-based tenant isolation
- **AI-Powered Form Generation**: Dynamic forms from design guidelines
- **Application Workflow System**: Customizable review workflows
- **Role-Based Access Control**: Fine-grained permissions (Super Admin → Homeowner)
- **Document Management**: Azure Blob Storage with GUID paths
- **QR Code Mobile Upload**: Revolutionary mobile-to-desktop document upload
- **Demo Ecosystem**: Isolated sandboxes with persona-based testing
- **Property Filtering**: Global filtering for management users

## 🧑‍💻 Development

### Available Scripts

```bash
npm run dev          # Start dev server (client + server)
npm run build        # Build for production
npm run db:push      # Apply database migrations
npm run preview      # Preview production build
```

### Database Management

```bash
# Apply schema changes
npm run db:push

# Studio (if configured)
npm run db:studio
```

## 📖 Documentation

- **[Project Structure](./PROJECT_STRUCTURE.md)** - Directory organization
- **[Global Memory](./persistent-memory/global-memory.md)** - Architecture & patterns
- **[Session Handoff](./persistent-memory/session-handoff.md)** - Current work & issues
- **[Completed Features](./persistent-memory/completed-features/)** - Feature documentation
- **[Implementation Guides](./persistent-memory/implementation-guides/)** - How-to guides

## 🔑 Environment Variables

Required environment variables:

```env
DATABASE_URL=postgresql://...           # Neon PostgreSQL connection
ANTHROPIC_API_KEY=sk-ant-...           # Claude API key
AZURE_STORAGE_ACCOUNT_NAME=...         # Azure Storage account
AZURE_STORAGE_ACCOUNT_KEY=...          # Azure Storage key
REPLIT_AUTH_SECRET=...                 # Replit Auth secret (auto-configured on Replit)
```

## 🎭 Demo System

Access demo mode with pre-configured personas:

**Demo Codes**:
- `TEST2024` (expires 2025-11-28)
- `DEMO2024` (expires 2025-12-21)

**Demo Personas**:
- Emily Chen (Management Manager)
- Sarah Johnson (POA Board Member)
- James Wilson (Homeowner)
- Alex Rodriguez (POA Board Contributor)

Visit `/demo` to enter a demo code and select a persona.

## 🏃 Deployment

### Replit
1. Fork this project on Replit
2. Configure environment variables
3. Run `npm install && npm run db:push`
4. Click "Run"

See **[docs/replit.md](./docs/replit.md)** for detailed deployment guide.

### Production Checklist
- [ ] Set production environment variables
- [ ] Run database migrations
- [ ] Configure Azure Blob Storage
- [ ] Set up custom domain/subdomains
- [ ] Enable HTTPS
- [ ] Configure backup strategy

## 🤝 Contributing

1. Check **[persistent-memory/session-handoff.md](./persistent-memory/session-handoff.md)** for current work
2. Review **[persistent-memory/feature-gaps-triage.md](./persistent-memory/feature-gaps-triage.md)** for known issues
3. Follow existing patterns in **[persistent-memory/global-memory.md](./persistent-memory/global-memory.md)**
4. Document new features in **persistent-memory/completed-features/**

## 📝 License

Proprietary - All Rights Reserved

## 🆘 Support

For issues or questions:
1. Check **[persistent-memory/session-handoff.md](./persistent-memory/session-handoff.md)** for known issues
2. Review **[persistent-memory/feature-gaps-triage.md](./persistent-memory/feature-gaps-triage.md)**
3. Consult **[persistent-memory/global-memory.md](./persistent-memory/global-memory.md)** for architecture

---

**Built with** ❤️ **using Claude Code**

Last Updated: 2025-11-27
