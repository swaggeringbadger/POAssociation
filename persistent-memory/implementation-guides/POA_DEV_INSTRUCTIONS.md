# POA: Add Claude-to-Claude Dev Coordination

Copy this to your POA Claude session. This enables Claudes to send instructions to each other.

---

## 1. Create the Database Table

```sql
CREATE TABLE IF NOT EXISTS dev_instructions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    from_app TEXT NOT NULL,
    to_app TEXT NOT NULL,
    type TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    context JSONB,
    related_action TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    acknowledged_at TIMESTAMP,
    implemented_at TIMESTAMP,
    response_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 2. Add to Schema (if using Drizzle)

```typescript
// In shared/schema.ts or equivalent
export const devInstructions = pgTable("dev_instructions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromApp: text("from_app").notNull(),
  toApp: text("to_app").notNull(),
  type: text("type").notNull(),
  priority: text("priority").notNull().default("normal"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  context: jsonb("context"),
  relatedAction: text("related_action"),
  status: text("status").notNull().default("pending"),
  acknowledgedAt: timestamp("acknowledged_at"),
  implementedAt: timestamp("implemented_at"),
  responseNotes: text("response_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

## 3. Add Sync Actions to Registry

In your sync features registry, add:

```typescript
// In receives:
"dev.instruction": {
  description: "Claude-to-Claude dev instruction",
  schema: { type: "string", priority: "string", title: "string", message: "string", context: "object?", relatedAction: "string?" },
},
"dev.instruction.ack": {
  description: "Acknowledge a dev instruction",
  schema: { instructionId: "string", status: "string", responseNotes: "string?" },
},

// In sends:
"dev.instruction": { ... same as above ... },
"dev.instruction.ack": { ... same as above ... },
```

## 4. Add Handlers

```typescript
// In your sync handlers

async function handleDevInstruction(data: any, sourceApp: string) {
  console.log(`[Sync] Dev instruction from ${sourceApp}: ${data.title}`);

  const [instruction] = await db
    .insert(devInstructions)
    .values({
      fromApp: sourceApp,
      toApp: "poassociation",
      type: data.type,
      priority: data.priority || "normal",
      title: data.title,
      message: data.message,
      context: data.context,
      relatedAction: data.relatedAction,
      status: "pending",
    })
    .returning();

  return {
    received: true,
    instructionId: instruction.id,
  };
}

async function handleDevInstructionAck(data: any) {
  await db
    .update(devInstructions)
    .set({
      status: data.status,
      responseNotes: data.responseNotes,
      ...(data.status === "acknowledged" ? { acknowledgedAt: new Date() } : { implementedAt: new Date() }),
    })
    .where(eq(devInstructions.id, data.instructionId));

  return { updated: true };
}
```

## 5. Add API Endpoints

```typescript
// GET /api/sync/dev/instructions - Check for pending instructions
router.get("/dev/instructions", async (req, res) => {
  const status = req.query.status || "pending";
  const instructions = await db
    .select()
    .from(devInstructions)
    .where(and(
      eq(devInstructions.toApp, "poassociation"),
      eq(devInstructions.status, status)
    ))
    .orderBy(desc(devInstructions.createdAt));

  res.json({
    count: instructions.length,
    instructions: instructions.map(i => ({
      id: i.id,
      from: i.fromApp,
      type: i.type,
      priority: i.priority,
      title: i.title,
      message: i.message,
      context: i.context,
      relatedAction: i.relatedAction,
      createdAt: i.createdAt,
    })),
  });
});

// POST /api/sync/dev/instructions - Send instruction to HomeHub
router.post("/dev/instructions", async (req, res) => {
  const { type, priority, title, message, context, relatedAction } = req.body;

  const result = await sendSyncRequest("homehub", "dev.instruction", {
    type,
    priority: priority || "normal",
    title,
    message,
    context,
    relatedAction,
  });

  res.json({ sent: result.success, result });
});

// POST /api/sync/dev/instructions/:id/ack - Acknowledge instruction
router.post("/dev/instructions/:id/ack", async (req, res) => {
  const { id } = req.params;
  const { status, responseNotes } = req.body;

  // Update locally
  await db.update(devInstructions).set({
    status,
    responseNotes,
    ...(status === "acknowledged" ? { acknowledgedAt: new Date() } : { implementedAt: new Date() }),
  }).where(eq(devInstructions.id, id));

  // Notify HomeHub
  const [instruction] = await db.select().from(devInstructions).where(eq(devInstructions.id, id));
  await sendSyncRequest(instruction.fromApp, "dev.instruction.ack", {
    instructionId: id,
    status,
    responseNotes,
  });

  res.json({ updated: true });
});
```

## 6. Session Startup Check

**At the start of each session, check for pending instructions:**
```bash
curl http://localhost:5000/api/sync/dev/instructions
```

---

## Usage

**Send instruction to HomeHub Claude:**
```bash
curl -X POST http://localhost:5000/api/sync/dev/instructions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "schema_change",
    "title": "Added applicationStatus to project.seed response",
    "message": "When you receive project.seed, I now expect you to return applicationStatus in the response so I can update my records."
  }'
```

**Mark instruction as done:**
```bash
curl -X POST http://localhost:5000/api/sync/dev/instructions/{id}/ack \
  -H "Content-Type: application/json" \
  -d '{"status": "implemented", "responseNotes": "Done!"}'
```
