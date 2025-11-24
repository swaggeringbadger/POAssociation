# Markland POA Application Wizard - Reference Architecture

This document provides a comprehensive guide to the application wizard flow and the data structure that drives dynamic form generation. This is intended for developers building similar multi-community, multi-company application systems.

## Overview

The Markland POA Portal uses a multi-step wizard that guides users through creating property enhancement applications. The system is designed to be **generic and scalable**, with configuration-driven forms that adapt based on project type without requiring code changes.

### Key Principles

1. **Configuration-Driven**: All form fields are defined in JSON files, not hardcoded in components
2. **Modular Architecture**: Clear separation between generic project details and project-type-specific information
3. **Lazy Loaded**: Form configurations are loaded on-demand from the backend
4. **Cached**: Server-side caching prevents repeated file reads for the same project type
5. **Type-Safe**: TypeScript interfaces ensure data consistency between frontend and backend

---

## Application Wizard Flow

The wizard is a **4-step process**:

```
Step 0: Project Type Selection
    ↓
Step 1: Project Details (Generic)
    ↓
Step 2: Additional Information (Project-Type-Specific)
    ↓
Step 3: Documentation Upload + Review & Submit
```

### Step 0: Project Type Selection

Users choose from **6 project types**:

```javascript
const PROJECT_TYPES = [
  {
    id: "exterior-modifications",
    title: "Exterior Modifications",
    description: "Paint colors, siding, trim, windows, doors, roofing",
    icon: "home",
    examples: ["Paint color changes", "Window replacements", "Roofing materials", "Siding modifications"]
  },
  {
    id: "structural-changes",
    title: "Structural Changes",
    description: "Additions, extensions, structural modifications",
    icon: "engineering",
    examples: ["Room additions", "Garage modifications", "Porch/deck additions", "Foundation changes"]
  },
  {
    id: "landscaping",
    title: "Landscaping",
    description: "Trees, plants, irrigation, hardscaping",
    icon: "grass",
    examples: ["Tree removal/planting", "Garden installations", "Irrigation systems", "Walkways/patios"]
  },
  {
    id: "fencing",
    title: "Fencing & Barriers",
    description: "Fences, gates, privacy screens, retaining walls",
    icon: "fence",
    examples: ["Privacy fencing", "Decorative gates", "Retaining walls", "Pool barriers"]
  },
  {
    id: "outdoor-structures",
    title: "Outdoor Structures",
    description: "Sheds, gazebos, pergolas, pools, outdoor kitchens",
    icon: "foundation",
    examples: ["Storage sheds", "Gazebos/pergolas", "Swimming pools", "Outdoor kitchens"]
  },
  {
    id: "signage",
    title: "Signage",
    description: "Address signs, decorative signs, business signage",
    icon: "signpost",
    examples: ["Address markers", "Decorative signs", "Security signs", "Business signage"]
  }
];
```

**Implementation**: These are defined in `client/src/components/ApplicationWizard.tsx` and presented as a visual grid with icons and descriptions for easy mobile selection.

### Step 1: Project Details (Generic)

All applications collect **generic information** regardless of project type:

- **Project Title**: Short descriptive name
- **Property Address**: Where the project is located
- **Project Description**: Detailed narrative covering scope, materials, timeline, and impact on neighbors

This data is captured in the `applications` table under the `title`, `propertyAddress`, and `description` fields.

### Step 2: Additional Information (Project-Type-Specific)

This step dynamically loads a form configuration based on the selected project type. The form is **entirely driven by JSON configuration files**.

### Step 3: Documentation + Review

Users upload supporting documents and then review all submitted information before final submission.

---

## The Data Model for Dynamic Forms

### Core Database Schema

```typescript
// applications table
{
  id: uuid (primary key),
  applicationNumber: string (unique),
  userId: uuid (foreign key to users),
  projectType: string, // References the JSON config filename
  title: string,
  description: string,
  propertyAddress: string,
  status: string,
  completenessScore: integer, // Calculated from additional info
  formData: jsonb, // Stores the additional information JSON
  submittedAt: timestamp,
  updatedAt: timestamp,
  // ... other review fields
}

// applicationDocuments table
{
  id: uuid,
  applicationId: uuid (foreign key),
  filename: string,
  originalName: string,
  mimeType: string,
  fileSize: integer,
  objectPath: string, // Cloud storage path
  category: string, // Document category from config
  uploadedAt: timestamp,
  uploadedBy: uuid
}
```

The **key field** for dynamic forms is `applications.formData` - a **JSONB column** that stores all answers from the additional information step.

### TypeScript Type Definitions

The frontend and backend share these types:

```typescript
// server/services/additionalInfoService.ts

export interface AdditionalInfoField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'number' | 'date';
  required: boolean;
  options?: string[];               // For select/radio/checkbox
  placeholder?: string;
  description?: string;
  relevantBylaws?: string | object;  // Reference to bylaws/covenants
  scoring?: number;                 // Alternative scoring per field
}

export interface AdditionalInfoSection {
  title: string;
  fields: AdditionalInfoField[];
}

export interface AdditionalInfoConfig {
  title: string;
  description: string;
  sections: AdditionalInfoSection[];
  required_documents: string[];
  scoring_weights: Record<string, number>; // Maps field IDs to weights
}
```

---

## The JSON Configuration Structure

### File Location

```
server/config/additional-info/
├── exterior-modifications.json
├── structural-changes.json
├── landscaping.json
├── fencing.json
├── outdoor-structures.json
└── signage.json
```

### Example Configuration: Structural Changes

Here's a simplified version of what `structural-changes.json` looks like:

```json
{
  "title": "Structural Changes Application",
  "description": "Provide detailed information about your structural modification project",
  "sections": [
    {
      "title": "Project Scope",
      "fields": [
        {
          "id": "project_type_sub",
          "label": "Type of Structural Change",
          "type": "select",
          "required": true,
          "options": [
            "Addition",
            "Deck/Porch Extension",
            "Garage Modification",
            "Foundation Work",
            "Other"
          ],
          "description": "Select the primary type of structural work",
          "relevantBylaws": {
            "primary": "Section 3.1 - Structural Modifications must comply with local building codes...",
            "additionalReferences": [
              "Section 4.2 - Setback Requirements",
              "Section 5.1 - Architectural Standards"
            ]
          }
        },
        {
          "id": "square_footage",
          "label": "Total Square Footage",
          "type": "number",
          "required": true,
          "placeholder": "Enter square footage",
          "description": "Total square footage of the new structure or addition"
        },
        {
          "id": "timeline",
          "label": "Project Timeline",
          "type": "textarea",
          "required": true,
          "placeholder": "Describe project duration, phases, etc.",
          "description": "Expected start date, duration, and any phases"
        }
      ]
    },
    {
      "title": "Design & Specifications",
      "fields": [
        {
          "id": "architectural_plans",
          "label": "Will you provide architectural plans?",
          "type": "radio",
          "required": true,
          "options": ["Yes", "No"],
          "description": "Professional architectural drawings are required for most structural changes"
        },
        {
          "id": "materials",
          "label": "Primary Materials",
          "type": "checkbox",
          "required": true,
          "options": [
            "Wood Framing",
            "Steel Framing",
            "Concrete",
            "Vinyl Siding",
            "Fiber Cement",
            "Brick/Masonry"
          ],
          "description": "Select all materials that will be used"
        },
        {
          "id": "color_selection",
          "label": "Exterior Color",
          "type": "text",
          "required": false,
          "placeholder": "e.g., Beige #D4A574",
          "description": "If known, provide color name and code",
          "relevantBylaws": {
            "primary": "Color must complement existing neighborhood palette...",
            "reference": "See Research tab for approved color standards"
          }
        }
      ]
    }
  ],
  "required_documents": [
    "Architectural plans or detailed drawings",
    "Material specifications and color samples",
    "Site plan showing location and setbacks",
    "Contractor license and insurance",
    "Timeline and construction schedule"
  ],
  "scoring_weights": {
    "project_type_sub": 10,
    "square_footage": 15,
    "timeline": 10,
    "architectural_plans": 20,
    "materials": 15,
    "color_selection": 5
  }
}
```

### Configuration File Structure Explained

| Property | Type | Purpose |
|----------|------|---------|
| `title` | string | Form heading displayed to user |
| `description` | string | Subtitle/helper text for the form |
| `sections` | array | Groups of related fields |
| `sections[].title` | string | Section heading |
| `sections[].fields` | array | Individual form fields in section |
| `required_documents` | array | Lists of documents needed for this project type |
| `scoring_weights` | object | Maps field IDs → numerical weights for completeness scoring |

### Field Properties

| Property | Type | Required | Purpose |
|----------|------|----------|---------|
| `id` | string | ✓ | Unique identifier (used as form field name) |
| `label` | string | ✓ | Display text for the label |
| `type` | enum | ✓ | `text`, `textarea`, `select`, `radio`, `checkbox`, `number`, `date` |
| `required` | boolean | ✓ | Whether field must be filled |
| `options` | string[] | For select/radio/checkbox | Available choices |
| `placeholder` | string | | Helper text in empty field |
| `description` | string | | Help text below field |
| `relevantBylaws` | string or object | | Reference to covenants/bylaws |
| `scoring` | number | | Weight for completeness score |

---

## How the System Renders Dynamic Forms

### Frontend: DynamicAdditionalInfoForm Component

The `DynamicAdditionalInfoForm` component (`client/src/components/DynamicAdditionalInfoForm.tsx`) is the engine that renders everything:

```typescript
export function DynamicAdditionalInfoForm({ 
  projectType,           // e.g., "structural-changes"
  initialData = {},      // Previously saved form data
  onDataChange           // Callback when form changes
}) {
  // 1. FETCH CONFIGURATION
  const { data: config, isLoading, error } = useQuery<AdditionalInfoConfig>({
    queryKey: ['/api/additional-info', projectType],
    enabled: !!projectType
  });

  // 2. SET UP FORM STATE
  const form = useForm({
    defaultValues: initialData,
    mode: 'onChange'
  });

  // 3. WATCH ALL CHANGES
  const { watch } = form;
  React.useEffect(() => {
    const subscription = watch((value) => {
      onDataChange(value);  // Propagate changes up
    });
    return () => subscription.unsubscribe();
  }, [watch, onDataChange]);

  // 4. RENDER SECTIONS AND FIELDS
  return (
    config.sections.map(section => (
      <div key={section.title}>
        <h3>{section.title}</h3>
        {section.fields.map(field => renderField(field))}
      </div>
    ))
  );
}
```

### Field Rendering Logic

For each field in the configuration, the `renderField()` function determines what component to render:

```typescript
const renderField = (field: AdditionalInfoField) => {
  switch(field.type) {
    case 'text':
      return <Input placeholder={field.placeholder} />;
    
    case 'textarea':
      return <Textarea />;
    
    case 'number':
      return <Input type="number" />;
    
    case 'date':
      return <Input type="date" />;
    
    case 'select':
      return (
        <Select>
          {field.options.map(opt => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </Select>
      );
    
    case 'radio':
      return (
        <RadioGroup>
          {field.options.map(opt => (
            <RadioGroupItem key={opt} value={opt} />
          ))}
        </RadioGroup>
      );
    
    case 'checkbox':
      return (
        <CheckboxGroup>
          {field.options.map(opt => (
            <Checkbox key={opt} value={opt} />
          ))}
        </CheckboxGroup>
      );
  }
};
```

### Bylaw References

Each field can include a `relevantBylaws` property that shows related covenant information:

```typescript
if (field.relevantBylaws) {
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="ghost" size="sm">
        <Info className="h-4 w-4" /> Relevant Bylaws
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Relevant Bylaws & Covenants</DialogTitle>
      </DialogHeader>
      <div className="mt-4 space-y-4">
        {/* Render bylaw content */}
        {field.relevantBylaws.primary && (
          <div className="prose prose-sm">
            <p>{field.relevantBylaws.primary}</p>
          </div>
        )}
        {field.relevantBylaws.additionalReferences && (
          <div>
            {field.relevantBylaws.additionalReferences.map(ref => (
              <p key={ref}>{ref}</p>
            ))}
          </div>
        )}
      </div>
    </DialogContent>
  </Dialog>
}
```

---

## Backend Implementation

### API Endpoint: Get Additional Info Configuration

```typescript
// server/routes.ts
app.get("/api/additional-info/:projectType", async (req, res) => {
  try {
    const { projectType } = req.params;
    const additionalInfoConfig = additionalInfoService.getAdditionalInfoConfig(projectType);
    
    if (!additionalInfoConfig) {
      return res.status(404).json({ error: "Configuration not found" });
    }
    
    res.json(additionalInfoConfig);
  } catch (error) {
    res.status(500).json({ error: "Failed to load configuration" });
  }
});
```

### AdditionalInfoService: Configuration Loading & Caching

```typescript
// server/services/additionalInfoService.ts
export class AdditionalInfoService {
  private configCache: Map<string, AdditionalInfoConfig> = new Map();

  getAdditionalInfoConfig(projectType: string): AdditionalInfoConfig | null {
    try {
      // 1. CHECK CACHE
      if (this.configCache.has(projectType)) {
        return this.configCache.get(projectType)!;
      }

      // 2. LOAD FROM FILE
      const configPath = join(process.cwd(), 'server', 'config', 'additional-info', 
                              `${projectType}.json`);
      const configData = readFileSync(configPath, 'utf-8');
      const config: AdditionalInfoConfig = JSON.parse(configData);

      // 3. CACHE FOR FUTURE REQUESTS
      this.configCache.set(projectType, config);
      
      return config;
    } catch (error) {
      console.error(`Error loading config for ${projectType}:`, error);
      return null;
    }
  }
}
```

### Completeness Scoring

The system calculates how "complete" an application is based on weighted field scores:

```typescript
calculateCompletenessScore(projectType: string, additionalInfo: Record<string, any>): number {
  const config = this.getAdditionalInfoConfig(projectType);
  if (!config) return 0;

  let totalWeight = 0;
  let achievedWeight = 0;

  // For each field with a weight
  for (const [fieldId, weight] of Object.entries(config.scoring_weights)) {
    totalWeight += weight;
    
    const value = additionalInfo[fieldId];
    
    // Award weight if field has been filled
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value) && value.length > 0) {
        achievedWeight += weight;  // At least one checkbox selected
      } else if (!Array.isArray(value)) {
        achievedWeight += weight;  // Any other field type filled
      }
    }
  }

  // Return percentage
  return totalWeight > 0 ? Math.round((achievedWeight / totalWeight) * 100) : 0;
}
```

**Example**: If scoring weights sum to 100, and user fills fields totaling 75 weight points, the score is 75%.

---

## Data Flow: From Form to Database

### Step 1: User Fills Form

```
User fills "structural-changes" form with:
{
  project_type_sub: "Addition",
  square_footage: 850,
  timeline: "3 months starting May 2024",
  architectural_plans: "Yes",
  materials: ["Wood Framing", "Vinyl Siding"],
  color_selection: "Light Gray #A9A9A9"
}
```

### Step 2: Form Component Triggers Callback

The `DynamicAdditionalInfoForm` calls `onDataChange(value)` on every keystroke/change.

### Step 3: Parent Component (ApplicationWizard) Stores in State

```typescript
const [additionalInfoData, setAdditionalInfoData] = useState({});

// DynamicAdditionalInfoForm calls:
onDataChange={(data) => setAdditionalInfoData(data)}
```

### Step 4: User Submits Application

```typescript
// In ApplicationWizard.tsx
const mutation = useMutation({
  mutationFn: async (formData) => {
    return apiRequest('POST', '/api/applications', {
      projectType: selectedProjectType,
      title: formData.title,
      description: formData.description,
      propertyAddress: formData.propertyAddress,
      formData: additionalInfoData,  // ← JSON stored here
      // ... other fields
    });
  }
});
```

### Step 5: Backend Stores in Database

```typescript
// server/routes.ts
app.post("/api/applications", async (req, res) => {
  const { projectType, formData, ...otherFields } = req.body;
  
  // Calculate completeness score
  const completenessScore = additionalInfoService.calculateCompletenessScore(
    projectType,
    formData
  );
  
  // Store in database
  const application = await storage.createApplication({
    ...otherFields,
    projectType,
    formData,  // ← Stored as JSONB
    completenessScore
  });
  
  res.json(application);
});
```

### Step 6: Data Persists in PostgreSQL

```sql
INSERT INTO applications (
  id, 
  application_number,
  user_id,
  project_type,
  title,
  description,
  property_address,
  form_data,
  completeness_score,
  status,
  submitted_at
) VALUES (
  '123-456...',
  'APP-2024-001',
  'user-123',
  'structural-changes',
  'Swimming Pool Addition',
  'Planning to add a salt-water pool...',
  '123 Oak Street, Markland FL',
  '{
    "project_type_sub": "Addition",
    "square_footage": 850,
    "timeline": "3 months starting May 2024",
    "architectural_plans": "Yes",
    "materials": ["Wood Framing", "Vinyl Siding"],
    "color_selection": "Light Gray #A9A9A9"
  }',
  78,  -- Completeness score
  'pending_mgmt_review',
  NOW()
);
```

---

## Retrieving and Displaying Saved Applications

When loading an existing application, the reverse flow occurs:

```typescript
// Fetch application from backend
const { data: application } = useQuery({
  queryKey: ['/api/applications', applicationId]
});

// Extract form data from JSONB column
const formData = application.formData;  // Plain JavaScript object

// Pass to form component with initialData
<DynamicAdditionalInfoForm
  projectType={application.projectType}
  initialData={formData}  // Repopulates all fields
  onDataChange={setAdditionalInfoData}
/>
```

---

## Adding New Project Types

To add a new project type (e.g., "swimming-pools"):

### 1. Create JSON Configuration File

Create `server/config/additional-info/swimming-pools.json`:

```json
{
  "title": "Swimming Pool Application",
  "description": "Provide details about your pool installation",
  "sections": [
    {
      "title": "Pool Specifications",
      "fields": [
        {
          "id": "pool_type",
          "label": "Type of Pool",
          "type": "select",
          "required": true,
          "options": ["In-ground", "Above-ground", "Saltwater", "Freshwater"],
          "description": "Select pool type"
        },
        // ... more fields
      ]
    }
  ],
  "required_documents": ["Pool plans", "Contractor credentials"],
  "scoring_weights": {
    "pool_type": 20,
    // ... etc
  }
}
```

### 2. Register Project Type in Frontend

Edit `client/src/components/ApplicationWizard.tsx`:

```typescript
const PROJECT_TYPES = [
  // ... existing types
  {
    id: "swimming-pools",
    title: "Swimming Pools",
    description: "Pool installation and modifications",
    icon: "droplet",
    examples: ["Residential pools", "Saltwater systems"]
  }
];
```

### 3. Register Project Type in Backend

Edit `server/services/additionalInfoService.ts`:

```typescript
getAllProjectTypes(): string[] {
  return [
    'exterior-modifications',
    'structural-changes',
    'landscaping',
    'fencing',
    'outdoor-structures',
    'signage',
    'swimming-pools'  // ← Add here
  ];
}
```

That's it! The system will automatically:
- Load the JSON configuration
- Render the dynamic form
- Store responses in JSONB
- Calculate scoring
- Validate required fields

---

## Key Design Decisions

### Why JSONB for formData?

- **Flexibility**: Each project type can have different fields without schema changes
- **Scalability**: Add new project types without database migrations
- **Queryability**: PostgreSQL JSONB supports indexing and queries
- **Type Safety**: TypeScript interfaces verify shape on frontend

### Why Caching?

- **Performance**: JSON files read once per project type per server startup
- **Development**: Cache cleared on config file changes (hot reload)
- **Production**: Cache persists for maximum speed

### Why Separate Generic + Specific?

- **Consistency**: All applications have title, address, description
- **Reusability**: Project details step identical for all project types
- **Maintainability**: Generic fields in database schema, specific fields in JSON
- **Search/Filter**: Can query by generic fields (projectType, title, status)

---

## Frontend Architecture Details

### Component Hierarchy

```
ApplicationWizard (main wizard container)
├── Step 0: Project Type Selector
├── Step 1: Project Details Form
│   └── Shadcn form components (Input, Textarea)
├── Step 2: DynamicAdditionalInfoForm
│   ├── fetch config from /api/additional-info/:projectType
│   └── render fields based on config
│       ├── Text/Textarea inputs
│       ├── Select dropdowns
│       ├── Radio groups
│       ├── Checkbox groups
│       └── Info buttons → bylaw dialogs
├── Step 3: Document Upload
│   └── Uppy dashboard with S3 uploader
└── Step 4: Review & Submit
    └── Read-only display of all data
```

### State Management

```typescript
const [currentStep, setCurrentStep] = useState(0);
const [selectedProjectType, setSelectedProjectType] = useState('');
const [projectDetails, setProjectDetails] = useState({});
const [additionalInfoData, setAdditionalInfoData] = useState({});
const [uploadedDocuments, setUploadedDocuments] = useState([]);
```

All state is local to the component until final submission.

---

## Backend Architecture Details

### Route Structure

```
POST   /api/applications               Create new application
GET    /api/applications               List applications (with pagination)
GET    /api/applications/:id           Get single application
PATCH  /api/applications/:id           Update application
GET    /api/additional-info/:type      Get form config for project type
POST   /api/documents                  Upload application documents
GET    /api/documents/:id              Get document download URL
```

### Database Relationships

```
Users (1) ──────────────── (∞) Applications
           created by        |
                            └─── (∞) ApplicationDocuments
                            └─── (∞) ApplicationComments
                            └─── (∞) ApplicationStatusHistory
```

---

## Testing the Dynamic Form System

### Unit Tests

Test `AdditionalInfoService`:

```typescript
describe('AdditionalInfoService', () => {
  it('should load and cache configuration', () => {
    const config1 = service.getAdditionalInfoConfig('structural-changes');
    const config2 = service.getAdditionalInfoConfig('structural-changes');
    expect(config1).toBe(config2); // Same object reference
  });

  it('should calculate completeness score', () => {
    const score = service.calculateCompletenessScore('structural-changes', {
      project_type_sub: 'Addition',
      square_footage: 850,
      architectural_plans: 'Yes'
    });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should validate required fields', () => {
    const result = service.validateAdditionalInfo('structural-changes', {
      project_type_sub: 'Addition'
      // Missing other required fields
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

Test the full flow:

```typescript
describe('Application Wizard', () => {
  it('should submit complete application', async () => {
    // 1. Select project type
    // 2. Fill project details
    // 3. Fill additional info
    // 4. Upload documents
    // 5. Submit
    // 6. Verify stored in database
  });
});
```

---

## Scaling to Multiple Communities/Companies

This architecture is designed for multi-community systems:

### For Multiple Communities

Add a `communityId` field to applications:

```typescript
const applications = pgTable("applications", {
  // ...
  communityId: varchar("community_id"),  // e.g., "markland", "oak-grove"
  managementCompanyId: varchar("mgmt_company_id"),
  // ...
});
```

Each community can have different project types and configurations by organizing:

```
server/config/additional-info/
├── markland/
│   ├── exterior-modifications.json
│   ├── structural-changes.json
│   └── ...
├── oak-grove/
│   ├── exterior-modifications.json
│   ├── structural-changes.json
│   └── ...
```

### For Multiple Management Companies

The same configuration can be shared or customized per company. Modify the service to resolve by (communityId, projectType):

```typescript
getAdditionalInfoConfig(communityId: string, projectType: string): AdditionalInfoConfig | null {
  const configPath = join(
    process.cwd(), 
    'server', 
    'config', 
    'additional-info',
    communityId,
    `${projectType}.json`
  );
  // ... load and cache
}
```

---

## Performance Considerations

### Current Optimizations

- **Server-side caching**: Configs loaded once
- **Client-side caching**: TanStack Query caches API responses
- **Lazy loading**: Forms only fetch when step is active
- **JSONB indexing**: PostgreSQL can index JSONB columns

### Future Optimizations

- **CDN for configs**: Serve JSON files from CDN if hosting multiple communities
- **Gzip compression**: Compress large JSONB payloads
- **Pagination**: List endpoints support pagination for large application volumes
- **Incremental saves**: Save form progress without requiring full submission

---

## Summary

The Markland POA Application Wizard demonstrates a **scalable, configuration-driven architecture** for building multi-step, project-type-specific form systems. By separating generic project details from configuration-driven additional information, the system achieves:

1. **Maximum flexibility** without code changes
2. **Type safety** through TypeScript interfaces
3. **Performance** through caching and lazy loading
4. **Maintainability** through clear separation of concerns
5. **Scalability** to support multiple communities and companies

The JSON configuration files are the single source of truth for form structure, validation rules, required documents, and scoring logic. The frontend generically renders whatever configuration it receives, making the system infinitely extensible.
