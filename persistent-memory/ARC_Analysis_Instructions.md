# ARC Meeting Analysis Report Generation

## Overview

This document describes the process for generating comprehensive Architectural Review Committee (ARC) meeting analysis reports. The system analyzes submitted applications, cross-references them against community governing documents and local regulations, and produces a professional summary packet for board members.

---

## Input Sources

### 1. Community Configuration (Pre-loaded)

Each community instance should have the following documents indexed and available:

- **Design Standards and Guidelines** - The primary governing document for architectural requirements
- **Declaration of Covenants, Conditions & Restrictions (CC&Rs)**
- **Articles of Incorporation**
- **Bylaws**
- **Any Amendments** to the above documents
- **Fee/Deposit Schedules**
- **Approved Materials Lists** (fence types, paint colors, roofing materials, etc.)
- **Lot Classification Maps** (lot types, special conditions, phases)

### 2. Local/County Regulations (Pre-loaded per Jurisdiction)

- Fence height and setback requirements
- Building permit requirements
- Pool/spa regulations
- Signage restrictions
- Any relevant zoning ordinances
- Setback requirements by zoning district

### 3. Meeting-Specific Inputs

For each ARC meeting, the system receives:

| Input Type | Format | Description |
|------------|--------|-------------|
| Meeting Agenda | PDF/DOCX/Structured Data | List of items to be reviewed |
| Previous Meeting Minutes | PDF/DOCX/Structured Data | For tracking tabled/denied items and conditions |
| Application Forms | Structured Data (preferred) or PDF | Homeowner submissions with project details |
| Supporting Documents | PDF/Images | Surveys, plot plans, contractor estimates, emails, photos |

---

## Processing Pipeline

### Step 1: Agenda Parsing

Extract from the meeting agenda:

```
For each agenda item:
  - Property address
  - Lot number (if available)
  - Homeowner name
  - Request type (fence, paint, pool, landscape, etc.)
  - Category (Old Business, New Business, Final Inspection, etc.)
```

**Key Distinction:**
- **Old Business** = Previously reviewed items returning (likely tabled or denied)
- **New Business** = First-time submissions
- **Final Inspections** = Completed projects requesting deposit return

### Step 2: Historical Context Lookup

For each agenda item, query previous meeting minutes:

```
Search previous_minutes WHERE:
  - property_address MATCHES current_item.address
  - OR lot_number MATCHES current_item.lot
  
If found:
  - Extract previous decision (approved/denied/tabled)
  - Extract vote count
  - Extract conditions or concerns noted
  - Extract any required follow-up actions
```

**Critical for Old Business items:** The analysis MUST reference what changed between the original submission and the revised submission.

### Step 3: Document Classification and Extraction

For each supporting document attached to an application:

#### 3a. Document Type Detection

| Document Type | Identification Signals | Key Data to Extract |
|---------------|----------------------|---------------------|
| **Application Form** | Standard form header, checkbox fields | Owner info, project description, contractor, dates |
| **Survey/Plot Plan** | Scale notation, lot dimensions, north arrow, surveyor stamp | Property boundaries, setback lines, easements, existing structures |
| **Contractor Estimate** | Company letterhead, line items, pricing | Contractor name, license/insurance info, materials, scope of work |
| **Email Correspondence** | Email headers (From/To/Date/Subject) | Clarifications, measurement confirmations, approval conditions |
| **Material Samples/Specs** | Product photos, color swatches, spec sheets | Color names/codes, manufacturers, dimensions |
| **Property Photos** | EXIF data, visual content | Current conditions, context for proposed changes |
| **Insurance Certificate** | Policy numbers, coverage limits, dates | Contractor insurance validity, coverage amounts |

#### 3b. Extraction by Document Type

**From Application Forms:**
```
- homeowner_name
- property_address
- lot_number
- project_type
- project_description
- proposed_materials (color, type, manufacturer)
- contractor_name
- contractor_contact
- application_date
- deposit_amount
- check_number (if provided)
```

**From Surveys/Plot Plans:**
```
- lot_dimensions
- existing_structures (location, footprint)
- proposed_improvements (location, dimensions)
- setback_measurements
- easement_locations
- distance_from_property_lines
- distance_from_existing_structures
- surveyor_name
- survey_date
```

**From Contractor Estimates:**
```
- contractor_company
- contractor_license (if shown)
- scope_of_work (itemized)
- materials_specified
- project_cost
- estimate_date
- estimate_validity_period
```

**From Email Correspondence:**
```
- sender
- recipient
- date
- subject
- key_clarifications (measurements, material changes, etc.)
- any_commitments_made
```

### Step 4: Guideline Compliance Analysis

For each application, perform compliance checking:

#### 4a. Identify Applicable Guidelines

Based on `project_type`, load relevant guideline sections:

| Project Type | Guideline Sections to Check |
|--------------|---------------------------|
| Fence | Fence types, height limits, material requirements, setback limits, location restrictions by lot type |
| Exterior Paint | Color restrictions, material requirements, coordination requirements |
| Pool/Spa | Setbacks, equipment screening, enclosure requirements, landscape requirements |
| Landscape | Plant palette, tree requirements, irrigation, mulch standards |
| Driveway | Width limits, material requirements, location restrictions |
| Outbuilding | Size limits, setbacks, architectural consistency requirements |
| Screen Enclosure | Color requirements, material requirements, setbacks |

#### 4b. Compliance Check Process

```
For each applicable_guideline:
  
  1. Extract the requirement (quote the specific guideline text)
  
  2. Extract the proposed specification from application
  
  3. Compare:
     - If COMPLIANT: Note as ✓ COMPLIANT with brief explanation
     - If NON-COMPLIANT: Note as ✗ NON-COMPLIANT with specific violation
     - If UNCLEAR: Note as ⚠ NEEDS CLARIFICATION with what information is missing
  
  4. For subjective guidelines (aesthetic judgment):
     - Flag as "ARC DISCRETION REQUIRED"
     - Provide relevant context and precedent if available
```

#### 4c. Local Regulation Cross-Check

```
For each applicable_local_regulation:
  
  1. Identify the jurisdiction requirement
  
  2. Compare against proposed specifications
  
  3. Note any conflicts between community guidelines and local regulations
     (Local regulations typically supersede, but note for board awareness)
```

### Step 5: Risk Assessment

Assign a risk level to each application:

| Risk Level | Criteria |
|------------|----------|
| **LOW** | All guidelines clearly met, complete documentation, straightforward request |
| **MEDIUM** | Minor clarifications needed, subjective judgment required, or incomplete documentation that doesn't affect core compliance |
| **HIGH** | Potential guideline violations, variance likely required, significant missing documentation, or previous denial for similar reasons |

### Step 6: Recommendation Generation

For each application, generate:

```
recommendation:
  decision: APPROVE | APPROVE WITH CONDITIONS | DENY | TABLE | REQUEST MORE INFO
  
  rationale:
    - List of compliance points supporting decision
    - Reference to specific guideline sections
    
  conditions: (if applicable)
    - Specific conditions to attach to approval
    - Timeline requirements
    - Inspection requirements
    
  concerns: (if any)
    - Items for board discussion
    - Subjective judgment calls
    - Precedent considerations
    
  missing_documentation: (if any)
    - List of documents or information needed
```

---

## Output Report Structure

### Report Sections

```
1. COVER PAGE
   - Community name
   - Meeting date/time/location
   - Report generation timestamp

2. EXECUTIVE SUMMARY
   - Summary table of all agenda items
   - Quick view: Item | Type | Risk Level | Recommendation

3. OLD BUSINESS (if any)
   - Full analysis with historical context
   - What changed since last review
   - Updated recommendation

4. NEW BUSINESS
   - Full analysis for each new application
   - Guideline compliance breakdown
   - Supporting documentation review
   - Recommendation with rationale

5. FINAL INSPECTIONS
   - Checklist of items to verify
   - Any known issues from original approval conditions
   - Recommendation for deposit release

6. DISCUSSION ITEMS (if any)
   - Non-application items from agenda
   - Background information
   - Questions for board consideration

7. REFERENCE APPENDIX
   - Quick reference tables (fence types, deposit schedule, etc.)
   - Key contacts
   - Relevant guideline excerpts
```

### Formatting Standards

- Use tables for structured data comparison
- Use color-coding or shading for status indicators:
  - Green: Compliant / Approve
  - Yellow: Caution / Needs Review
  - Red: Non-compliant / Deny
- Include page headers with community name and meeting date
- Include page numbers and "Page X of Y" footers
- Use consistent heading hierarchy

---

## Special Handling Rules

### Tabled Items Returning

When an item was previously tabled:
1. MUST reference the original tabling decision
2. MUST list the specific concerns/conditions from original review
3. MUST explicitly state whether each concern has been addressed
4. Highlight what documentation is new vs. original

### Denied Items Returning

When a previously denied item returns:
1. MUST reference the denial and vote count
2. MUST identify what changed in the new submission
3. If requesting variance, note that ARC cannot grant variances (must go to POA board)
4. Assess whether changes address the denial reasons

### Final Inspections with Prior Conditions

When reviewing final inspection requests:
1. Pull the original approval conditions
2. Create checklist from conditions
3. Note any items that were flagged during the approval process
4. If project was "conditionally approved," those conditions MUST be verified

### Subjective/Aesthetic Judgments

For guidelines involving aesthetic discretion (e.g., "colors shall harmonize"):
1. Do not make definitive compliance determination
2. Provide factual context (what colors are proposed, what exists on home)
3. Reference any objective standards that apply
4. Flag as "ARC DISCRETION REQUIRED"
5. Provide any relevant precedent from community if available

### Near-Boundary Compliance

When a specification is close to but within limits:
1. Note the proximity to the limit
2. Recommend verification method (e.g., "recommend field measurement to confirm")
3. Consider suggesting condition for as-built verification

---

## Image/Scan Analysis Guidelines

### Survey/Plot Plan Analysis

When analyzing survey or plot plan images:

1. **Identify scale** - Look for scale notation (e.g., 1"=20')
2. **Locate the proposed improvement** - Usually marked in red, highlighted, or annotated
3. **Measure relevant distances:**
   - From property lines
   - From existing structures
   - From easements
   - From setback lines (if shown)
4. **Check for annotations** - Hand-written notes often contain critical clarifications
5. **Verify lot number and address** match the application

### Email/Correspondence Analysis

When analyzing email screenshots or scans:

1. **Extract the thread chronology** - Note dates and who said what
2. **Identify key commitments** - Specific measurements, material changes, timelines
3. **Note who made the commitment** - Homeowner, contractor, or board member
4. **Flag any conflicting information** between email and formal application

### Photo Analysis

When analyzing property photos:

1. **Current condition documentation** - What exists today
2. **Context for proposed changes** - Adjacent properties, sight lines
3. **Potential concerns** - Anything visible that might affect approval
4. **Verify address** - Look for visible house numbers, street signs

### Material Sample Analysis

When analyzing color swatches or material specs:

1. **Extract exact specifications** - Color codes, manufacturer, product name
2. **Note the context** - What element the material applies to
3. **Compare to restricted colors** - Check against any prohibited color lists
4. **Assess coordination** - If multiple colors proposed, note the relationship

---

## Error Handling

### Missing Information

When required information is not found in submitted documents:

```
missing_info:
  field: [what's missing]
  impact: [how it affects analysis]
  recommendation: TABLE pending receipt of [specific document/info needed]
```

### Conflicting Information

When documents contain conflicting data:

```
conflict:
  field: [what field conflicts]
  source_1: [document] states [value]
  source_2: [document] states [value]
  recommendation: Request clarification before proceeding
```

### Unclear Scans/Images

When image quality prevents accurate analysis:

```
image_quality_issue:
  document: [which document]
  issue: [illegible text / unclear measurements / etc.]
  recommendation: Request clearer copy or original document
```

---

## Integration Notes

### Application Form Data

When applications are submitted through the POA app (structured data):
- Direct field mapping eliminates OCR/extraction errors
- Validation rules catch missing required fields at submission
- Automatic lot type and guideline applicability lookup
- Pre-populated checklists based on project type

### Legacy/Scanned Documents

When supporting documents are scanned images or PDFs:
- Apply OCR with confidence scoring
- Flag low-confidence extractions for human review
- Use template matching for common document types (standard application forms, common surveyor formats)
- Maintain original image reference for verification

### Continuous Learning

Track correction patterns to improve extraction:
- When board corrects an analysis, log the correction
- Identify systematic extraction errors
- Update document templates and extraction rules accordingly

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | December 2025 | Initial documentation |

