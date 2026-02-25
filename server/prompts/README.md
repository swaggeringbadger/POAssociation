# AI Prompt Library — Versioned

This folder contains all 21 prompt templates used for AI-powered features in the POA Association platform, organized into a versioned directory structure.

## Architecture

Each prompt lives in its own directory with numbered version files:

```
server/prompts/
├── registry.json                         # Maps prompt keys → active version numbers
├── promptRegistry.ts                     # Centralized loader (singleton)
├── README.md                             # This file
├── form-generation-system/v1.md          # System prompt for AI form generation
├── form-generation-user/v1.md            # User prompt for AI form generation
├── analysis-system/v1.md                 # System prompt for compliance analysis
├── analysis-user/v1.md                   # User prompt for compliance analysis
├── breakdown-report-system/v1.md         # System prompt for breakdown report
├── breakdown-report-user/v1.md           # User prompt for breakdown report
├── property-research-system/v1.md        # System prompt for property research
├── property-research-user/v1.md          # User prompt for property research
├── public-resources-generation/v1.md     # Public government resource links
├── flux-kontext-uploaded-photo/v1.md     # Flux Kontext: uploaded photo enhancement
├── flux-kontext-satellite/v1.md          # Flux Kontext: satellite-to-street-view
├── mockup-with-photos/v1.md              # Mockup with user-uploaded photos
├── mockup-satellite-only/v1.md           # Mockup with only satellite imagery
├── mockup-no-images/v1.md                # Mockup text-only fallback
├── project-type-snippets/v1.json         # Project-type prompt snippets (JSON map)
├── blueprint-with-satellite/v1.md        # Blueprint/site plan with satellite
├── blueprint-no-satellite/v1.md          # Blueprint/site plan without satellite
├── blueprint-project-snippets/v1.json    # Blueprint project-type snippets (JSON map)
├── landscape-mockup-with-satellite/v1.md # Landscape mockup with satellite
├── landscape-mockup-no-satellite/v1.md   # Landscape mockup without satellite
└── image-sharpening/v1.md                # Image enhancement/sharpening
```

## Usage

```typescript
import { promptRegistry } from './prompts/promptRegistry';

// Load a prompt with variable interpolation
const prompt = promptRegistry.getPrompt('analysis-system');
const prompt = promptRegistry.getPrompt('analysis-user', {
  COMMUNITY_NAME: 'Markland Woods',
  PROJECT_TYPE: 'fence',
});

// Load a JSON prompt (for key→value maps)
const snippets = promptRegistry.getPromptJson('project-type-snippets');

// List available versions
promptRegistry.listVersions('analysis-system'); // [1]

// Switch active version (updates registry.json on disk)
promptRegistry.setActiveVersion('analysis-system', 2);

// Reload registry after manual edits
promptRegistry.reload();
```

## Creating a New Version

1. Copy the current version file to a new version:
   ```bash
   cp server/prompts/analysis-system/v1.md server/prompts/analysis-system/v2.md
   ```
2. Edit `v2.md` with your changes
3. Update `registry.json` to set `"activeVersion": 2` for that prompt
4. Restart the server

## Rolling Back

Edit `registry.json` and change `"activeVersion"` back to the previous number, then restart.

## Prompt Categories

### Form Generation (2 prompts)
- `form-generation-system` — System prompt defining Claude's role, JSON structure, field types
- `form-generation-user` — User prompt with lot type extraction instructions

**Placeholders:** `{APPLICATION_TYPE}`, `{REFERENCE_ARCHITECTURE}`, `{EXAMPLE_FORM}`, `{DESIGN_GUIDELINES_CONTENT}`

### Application Analysis (2 prompts)
- `analysis-system` — Compliance analyst role, scoring guidelines
- `analysis-user` — Application context with form data and bylaws

**Placeholders:** `{COMMUNITY_NAME}`, `{COMMUNITY_TYPE}`, `{APPLICATION_NUMBER}`, `{PROJECT_TYPE}`, `{PROJECT_TITLE}`, `{PROJECT_DESCRIPTION}`, `{PROPERTY_ADDRESS}`, `{SUBMITTED_DATE}`, `{FORM_DATA}`, `{FORM_SCHEMA}`, `{RELEVANT_BYLAWS}`, `{DESIGN_GUIDELINES_CONTENT}`, `{PROPERTY_RESEARCH_SUMMARY}`

### Breakdown Report (2 prompts)
- `breakdown-report-system` — Comprehensive analysis with four score types
- `breakdown-report-user` — Detailed application context with uploaded documents

**Additional placeholders:** `{COUNTY_JURISDICTION}`, `{LOT_TYPE}`, `{APPLICANT_NAME}`, `{UPLOADED_DOCUMENTS}`

### Property Research (2 prompts)
- `property-research-system` — Property research analyst role
- `property-research-user` — Property info with research focus areas

**Additional placeholders:** `{STATE_CODE}`, `{PARCEL_ID}`, `{SUBDIVISION}`, `{LOT_NUMBER}`, `{BLOCK_NUMBER}`, `{SPECIAL_CONSIDERATIONS}`

### Public Resources (1 prompt)
- `public-resources-generation` — Generates government resource links by location

**Placeholders:** `{ADDRESS_PARTS}`

### Image Generation — Mockups (5 prompts + 1 JSON)
- `flux-kontext-uploaded-photo` — Edit-style prompt for uploaded photo enhancement
- `flux-kontext-satellite` — Edit-style prompt for satellite-to-street-view
- `mockup-with-photos` — Full descriptive mockup with user photos
- `mockup-satellite-only` — Conservative mockup from satellite only
- `mockup-no-images` — Text-only fallback mockup
- `project-type-snippets` — JSON map of project-type prompt additions

**Placeholders:** `{UPLOADED_COUNT}`, `{PROPERTY_ADDRESS}`, `{SATELLITE_BLOCK}`, `{NEIGHBORHOOD_BLOCK}`, `{PROJECT_DESCRIPTION}`

### Image Generation — Blueprints (2 prompts + 1 JSON)
- `blueprint-with-satellite` — Site plan tracing satellite image
- `blueprint-no-satellite` — Generic site plan
- `blueprint-project-snippets` — JSON map of blueprint project additions

**Placeholders:** `{BLUEPRINT_PROJECT_PROMPT}`, `{PROJECT_DESCRIPTION}`, `{LANDSCAPE_ELEMENTS}`

### Image Generation — Landscape (2 prompts)
- `landscape-mockup-with-satellite` — Landscape visualization with satellite
- `landscape-mockup-no-satellite` — Landscape visualization without satellite

**Placeholders:** `{PROPERTY_ADDRESS}`, `{PROJECT_TYPE}`, `{PROJECT_CONTEXT}`, `{PROJECT_DESCRIPTION}`

### Image Enhancement (1 prompt)
- `image-sharpening` — Hero image enhancement prompt

## PDF Support

When design guidelines are PDF documents, they are sent to Claude as base64-encoded document blocks rather than being inserted into the `{DESIGN_GUIDELINES_CONTENT}` placeholder.

## Important Notes

- All analysis prompts produce valid JSON output
- Prompts emphasize NOT inventing information — only extract what's explicitly provided
- Always include specific section/page references when citing bylaws
- Issue severity levels (critical/moderate/low) have specific definitions
- The in-memory cache in promptRegistry clears when versions change
