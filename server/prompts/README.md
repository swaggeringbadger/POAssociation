# AI Prompt Library

This folder contains all prompt templates used for AI-powered features in the POA Association platform.

## Prompt Categories

### 1. Form Generation Prompts

Used when AI generates application forms from design guidelines.

#### system-prompt.md
The system prompt that defines Claude's role and the structure requirements for generated forms.

**Placeholders:**
- `{APPLICATION_TYPE}` - The type of application (e.g., "exterior-modifications", "landscaping")
- `{REFERENCE_ARCHITECTURE}` - The complete reference architecture documentation
- `{EXAMPLE_FORM}` - An example form JSON for reference

#### user-prompt.md
The user prompt that instructs Claude how to process the design guidelines and extract lot types.

**Placeholders:**
- `{APPLICATION_TYPE}` - The type of application
- `{DESIGN_GUIDELINES_CONTENT}` - The actual design guidelines content (only used for HTML/text, not PDFs)

---

### 2. Application Analysis Prompts

Used for quick compliance analysis of submitted applications.

#### analysis-system-prompt.md
Defines the compliance analyst role and JSON output structure for basic analysis.

**Output includes:**
- Compliance score (0-100)
- Risk level assessment
- Bylaw compliance details
- Risk assessment by category
- Questions/concerns for committee
- Approval recommendations

#### analysis-user-prompt.md
Provides application context for analysis.

**Placeholders:**
- `{COMMUNITY_NAME}`, `{COMMUNITY_TYPE}`
- `{APPLICATION_NUMBER}`, `{PROJECT_TYPE}`, `{PROJECT_TITLE}`
- `{PROJECT_DESCRIPTION}`, `{PROPERTY_ADDRESS}`
- `{SUBMITTED_DATE}`
- `{FORM_DATA}`, `{FORM_SCHEMA}`, `{RELEVANT_BYLAWS}`
- `{DESIGN_GUIDELINES_CONTENT}`

---

### 3. Breakdown Report Prompts (Comprehensive Analysis)

Used for detailed application breakdown reports with issue categorization.

#### breakdown-report-system-prompt.md
Defines comprehensive analysis role with detailed scoring criteria.

**Output includes:**
- **Report Summary**: Overall scores for completeness, correctness, community compliance, regulatory compliance
- **Completeness Analysis**: Required/optional items provided and missing
- **Correctness Analysis**: Verified information and inconsistencies
- **Community Compliance Analysis**: Compliant, non-compliant, and unclear areas
- **Regulatory Compliance Analysis**: Applicable regulations, permits, inspections
- **Issues**: Categorized as Critical, Moderate, or Low with resolution steps
- **Questions for Homeowner**: Clarifications, elaborations, document requests
- **Recommendations**: Primary recommendation with conditions and next steps

#### breakdown-report-user-prompt.md
Provides detailed application context for comprehensive analysis.

**Placeholders:**
- `{COMMUNITY_NAME}`, `{COMMUNITY_TYPE}`, `{COUNTY_JURISDICTION}`
- `{APPLICATION_NUMBER}`, `{PROJECT_TYPE}`, `{PROJECT_TITLE}`
- `{PROJECT_DESCRIPTION}`, `{PROPERTY_ADDRESS}`, `{LOT_TYPE}`
- `{SUBMITTED_DATE}`, `{APPLICANT_NAME}`
- `{FORM_DATA}`, `{FORM_SCHEMA}`, `{RELEVANT_BYLAWS}`
- `{UPLOADED_DOCUMENTS}`
- `{DESIGN_GUIDELINES_CONTENT}`

---

## How PDF Support Works

When the design guidelines URL points to a PDF:
1. The service downloads the PDF as a binary buffer
2. The PDF is sent to Claude as a `document` source (base64-encoded)
3. Claude natively reads and analyzes the PDF content
4. The `{DESIGN_GUIDELINES_CONTENT}` placeholder is NOT used (PDF sent separately)

When the design guidelines URL points to HTML/text:
1. The service downloads and strips HTML tags
2. The text content is inserted into the `{DESIGN_GUIDELINES_CONTENT}` placeholder
3. The complete prompt is sent to Claude as text

---

## Editing Prompts

You can edit these prompts directly without modifying code:
1. Edit the `.md` files in this folder
2. Save your changes
3. Restart the server (or let it hot-reload if watching)
4. New AI operations will use the updated prompts

## Testing Changes

To test prompt changes:
1. Edit the prompt files
2. Trigger the relevant AI feature (form generation, analysis, breakdown report)
3. Review the output to see if your changes had the desired effect
4. Check server logs for any JSON parsing errors

## Important Notes

- All prompts should produce valid JSON output
- The prompts emphasize NOT inventing information - only extracting what's explicitly provided
- Always include specific section/page references when citing bylaws
- Lot types are critical for communities where requirements vary by lot type
- Issue severity levels (critical/moderate/low) have specific definitions - follow them
- Critical issues should block approval; moderate and low should not
