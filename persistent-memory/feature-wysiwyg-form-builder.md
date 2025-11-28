# Feature: WYSIWYG Form Builder

**Feature ID**: FRM-001
**Epic**: Form Management & Customization
**Priority**: High
**Status**: Planning
**Created**: 2025-01-28

---

## Executive Summary

A visual, drag-and-drop form builder that allows property managers and administrators to create and edit custom application forms without writing JSON. This feature replaces manual JSON editing with an intuitive WYSIWYG interface while maintaining backward compatibility with AI-generated forms.

### Business Value
- **Reduced Technical Barrier**: Non-technical users can create forms without understanding JSON
- **Faster Iteration**: Edit forms in real-time with visual feedback
- **Improved Accuracy**: Reduce syntax errors and schema violations
- **Enhanced Flexibility**: Combine AI-generated forms with manual customization
- **Better UX**: Intuitive drag-and-drop interface matching modern form builders

---

## Current State Analysis

### Existing Form Structure
Forms are currently stored as JSON in the `formTemplates.schema` (JSONB) column with this structure:

```typescript
interface AdditionalInfoConfig {
  title: string;
  description: string;
  relevantBylaws?: RelevantBylaws;
  sections: AdditionalInfoSection[];
  required_documents: string[];
  documents?: DocumentRequirement[];
  scoring_weights: Record<string, number>;
  complianceNotes?: ComplianceNotes;
  arbProcessNotes?: ARBProcessNotes;
}

interface AdditionalInfoSection {
  title: string;
  fields: AdditionalInfoField[];
}

interface AdditionalInfoField {
  id: string;                      // snake_case identifier
  label: string;                   // Display text
  type: FormFieldType;             // text, textarea, select, radio, checkbox, number, date
  required: boolean;
  options?: string[];              // For select/radio/checkbox
  placeholder?: string;
  description?: string;
  relevantBylaws?: BylawReference;
  scoring?: number;
}
```

### Current Workflow
1. Navigate to Form Wizard page (`/form-wizard`)
2. Click on a form type card (e.g., "Exterior Modifications")
3. View form versions in a dialog
4. Click ellipsis menu (⋮) on a version row
5. Currently shows: Preview Form, Set as Active, Delete Version
6. **NEW**: Add "Edit Form" option to launch the WYSIWYG builder

### Current Pages
- **FormWizard.tsx** (`/form-wizard`): Main page showing all form types
- **Dialog**: Shows versions table for selected form type
- **Preview Dialog**: Shows read-only form preview

---

## Feature Requirements

### Epic
**Epic**: Visual Form Builder
**As a** property manager or admin,
**I want** to visually create and edit custom application forms,
**So that** I can tailor forms to my property's specific needs without technical knowledge.

---

## User Stories

### 🎯 US-1: Access Form Editor
**As a** property manager,
**I want** to access the form editor from the versions list,
**So that** I can edit an existing form version.

**Acceptance Criteria:**
- [ ] Ellipsis menu on version row shows "Edit Form" option
- [ ] "Edit Form" option appears for all versions (active and inactive)
- [ ] Clicking "Edit Form" navigates to `/form-builder/:templateId`
- [ ] User can navigate back to Form Wizard without losing changes (with confirmation if unsaved)
- [ ] URL is shareable and can be bookmarked

**Technical Notes:**
- Add route: `/form-builder/:templateId`
- Route should load template data and initialize editor
- Implement navigation guards for unsaved changes

---

### 🎯 US-2: View Form Structure
**As a** property manager,
**I want** to see the entire form structure at a glance,
**So that** I understand the organization and can navigate easily.

**Acceptance Criteria:**
- [ ] Left sidebar shows collapsible tree of sections
- [ ] Tree shows section titles and field counts
- [ ] Clicking a section scrolls to it in the main canvas
- [ ] Active section is highlighted in the sidebar
- [ ] Sections can be reordered via drag-and-drop in sidebar
- [ ] Visual indicators show required fields count per section

**UI Components:**
- FormBuilderSidebar: Tree view with drag-drop
- SectionNode: Collapsible section with metadata
- FieldCountBadge: Shows field count and required count

---

### 🎯 US-3: Edit Form Metadata
**As a** property manager,
**I want** to edit the form's title and description,
**So that** applicants understand the form's purpose.

**Acceptance Criteria:**
- [ ] Top header shows form title as editable field
- [ ] Description shown below title as editable textarea
- [ ] Changes update in real-time in preview mode
- [ ] Validation: Title required, max 200 chars
- [ ] Validation: Description max 1000 chars
- [ ] Unsaved changes indicator appears

**UI Components:**
- FormMetadataEditor: Header component with inline editing
- EditableTitle: Click-to-edit title field
- EditableDescription: Click-to-edit description field

---

### 🎯 US-4: Add New Section
**As a** property manager,
**I want** to add new sections to organize fields,
**So that** I can group related questions together.

**Acceptance Criteria:**
- [ ] "Add Section" button visible at bottom of form and between sections
- [ ] Click opens inline section creation form
- [ ] Form requires section title (max 100 chars)
- [ ] New section appears immediately in canvas and sidebar
- [ ] New section is empty with "Add Field" prompt
- [ ] Can cancel section creation

**UI Components:**
- AddSectionButton: Icon button with label
- SectionCreateForm: Inline form with title input
- EmptySectionPlaceholder: Shows when section has no fields

---

### 🎯 US-5: Edit Section Properties
**As a** property manager,
**I want** to edit section titles,
**So that** I can rename sections as needs change.

**Acceptance Criteria:**
- [ ] Section header shows title with edit icon
- [ ] Click title or icon to enable inline editing
- [ ] Press Enter to save, Esc to cancel
- [ ] Changes update immediately in sidebar
- [ ] Validation: Title required, max 100 chars
- [ ] Empty title reverts to previous value

**UI Components:**
- SectionHeader: Header with inline edit
- InlineEditableText: Reusable text editor component

---

### 🎯 US-6: Delete Section
**As a** property manager,
**I want** to delete sections I no longer need,
**So that** I can remove outdated or unnecessary groupings.

**Acceptance Criteria:**
- [ ] Section header shows delete icon
- [ ] Click triggers confirmation dialog
- [ ] Confirmation shows field count and warns about data loss
- [ ] Confirm deletes section and all fields
- [ ] Undo button appears for 5 seconds after deletion
- [ ] Deleted section removed from sidebar

**UI Components:**
- DeleteSectionButton: Trash icon in section header
- ConfirmationDialog: Modal with warning message
- UndoToast: Temporary undo notification

---

### 🎯 US-7: Reorder Sections
**As a** property manager,
**I want** to reorder sections via drag-and-drop,
**So that** I can control the flow of the application.

**Acceptance Criteria:**
- [ ] Sections have drag handles in both sidebar and canvas
- [ ] Dragging shows ghost preview of new position
- [ ] Drop updates order in both sidebar and canvas
- [ ] Smooth animation when reordering
- [ ] Touch-friendly for tablet devices
- [ ] Keyboard accessible (Alt+Up/Down to reorder)

**UI Components:**
- DragHandle: Visual indicator for draggable items
- DragDropContext: React DnD provider
- SortableSection: Wrapper with drag-drop behavior

**Technical Notes:**
- Use `@dnd-kit/core` for drag-and-drop
- Implement keyboard navigation per WCAG 2.1

---

### 🎯 US-8: Add New Field
**As a** property manager,
**I want** to add fields to a section,
**So that** I can collect specific information from applicants.

**Acceptance Criteria:**
- [ ] "Add Field" button visible at bottom of each section
- [ ] Click opens field creation modal/panel
- [ ] Modal shows field type selector with icons
- [ ] Each type shows description and example
- [ ] Selecting type opens type-specific configuration
- [ ] Required fields: ID, Label, Type
- [ ] ID auto-generated from label (snake_case), editable
- [ ] Field preview updates as properties change
- [ ] Save button validates and adds field
- [ ] Cancel button discards changes

**Supported Field Types:**
1. **Text** - Single-line text input
2. **Textarea** - Multi-line text input
3. **Number** - Numeric input with optional min/max
4. **Date** - Date picker
5. **Select** - Dropdown with options
6. **Radio** - Single choice from options
7. **Checkbox** - Multiple choice from options

**UI Components:**
- AddFieldButton: Icon button in section
- FieldTypeSelector: Grid of type cards with icons
- FieldConfigPanel: Dynamic form based on field type
- FieldPreview: Live preview of configured field

**Validation Rules:**
- ID: Required, unique within form, snake_case, max 50 chars
- Label: Required, max 200 chars
- Type: Required, must be valid FieldType
- Options: Required for select/radio/checkbox, min 2 options
- Placeholder: Max 200 chars
- Description: Max 500 chars

---

### 🎯 US-9: Edit Field Properties
**As a** property manager,
**I want** to edit existing field properties,
**So that** I can update questions and validation rules.

**Acceptance Criteria:**
- [ ] Click field in canvas to open properties panel
- [ ] Properties panel shows all editable attributes
- [ ] Changes apply in real-time to preview
- [ ] ID cannot be changed if form has submissions
- [ ] Warning shown when changing field type
- [ ] Validation errors shown inline
- [ ] Save button commits changes
- [ ] Cancel button reverts changes

**Editable Properties:**
- Label (text)
- Type (dropdown, with confirmation)
- Required (toggle)
- Placeholder (text)
- Description (textarea)
- Options (list editor for select/radio/checkbox)
- Relevant Bylaws (structured editor)
- Scoring Weight (number)

**UI Components:**
- FieldPropertiesPanel: Right sidebar with property editors
- PropertyEditor: Generic property input wrapper
- OptionsListEditor: Add/remove/reorder options
- BylawsEditor: Structured bylaw reference editor

**Business Rules:**
- Cannot change ID if applications exist using this form
- Changing field type shows warning about data compatibility
- Deleting options shows warning if applications have that value

---

### 🎯 US-10: Delete Field
**As a** property manager,
**I want** to delete fields I no longer need,
**So that** I can remove unnecessary questions.

**Acceptance Criteria:**
- [ ] Field card shows delete icon on hover
- [ ] Click triggers confirmation dialog
- [ ] Warning if form has submissions using this field
- [ ] Confirm deletes field from section
- [ ] Undo button appears for 5 seconds
- [ ] Scoring weights updated automatically

**UI Components:**
- DeleteFieldButton: Trash icon in field card
- FieldDeletionDialog: Confirmation with impact warning

**Business Rules:**
- Cannot delete fields referenced in workflows or automations
- Show warning if field has data in existing applications
- Update scoring_weights map when field deleted

---

### 🎯 US-11: Reorder Fields
**As a** property manager,
**I want** to reorder fields within a section,
**So that** I can control the question sequence.

**Acceptance Criteria:**
- [ ] Fields have drag handles
- [ ] Drag within section to reorder
- [ ] Drag to different section to move
- [ ] Drop indicators show valid drop zones
- [ ] Smooth animation during drag
- [ ] Keyboard accessible (Alt+Up/Down)

**UI Components:**
- FieldDragHandle: Visual drag indicator
- DraggableField: Field card with drag behavior
- DropZone: Visual indicator for valid drop targets

---

### 🎯 US-12: Configure Field Validation
**As a** property manager,
**I want** to set validation rules on fields,
**So that** I can ensure data quality.

**Acceptance Criteria:**
- [ ] Required toggle in properties panel
- [ ] Number fields: min, max, step controls
- [ ] Text fields: min length, max length, pattern controls
- [ ] Date fields: min date, max date controls
- [ ] Custom validation message input
- [ ] Preview shows validation in action
- [ ] Validation rules saved with field

**UI Components:**
- ValidationRulesEditor: Conditional editor based on field type
- NumberRangeInput: Min/max controls
- TextLengthInput: Character limits
- PatternInput: Regex pattern with tester

**Validation Types by Field:**
- **Text**: required, minLength, maxLength, pattern
- **Textarea**: required, minLength, maxLength
- **Number**: required, min, max, step
- **Date**: required, minDate, maxDate
- **Select**: required
- **Radio**: required
- **Checkbox**: required, minSelected, maxSelected

---

### 🎯 US-13: Add Bylaw References
**As a** property manager,
**I want** to link fields to relevant bylaws and covenants,
**So that** applicants understand the legal requirements.

**Acceptance Criteria:**
- [ ] Properties panel has "Bylaw References" section
- [ ] Can add reference text
- [ ] Can add requirement description
- [ ] Can add multiple requirement bullets
- [ ] Can add note and quote
- [ ] Can add key restrictions list
- [ ] Can add approved materials list
- [ ] Can add prohibited items
- [ ] Preview shows bylaw info icon
- [ ] Click icon in preview shows formatted bylaw dialog

**UI Components:**
- BylawReferenceEditor: Multi-section structured editor
- BulletListEditor: Add/remove/edit list items
- BylawPreviewDialog: Shows formatted bylaw info

**Data Structure:**
```typescript
interface BylawReference {
  reference?: string;           // e.g., "Section 4.2.1"
  requirement?: string;          // Main requirement text
  requirements?: string[];       // Bullet list of requirements
  note?: string;                // Additional notes
  quote?: string;               // Direct quote from document
  keyRestrictions?: string[];   // List of restrictions
  approvedMaterials?: string[]; // Approved material list
  prohibited?: string;          // Prohibited items/actions
  preferredStyles?: string[];   // Preferred style list
}
```

---

### 🎯 US-14: Configure Form-Level Bylaws
**As a** property manager,
**I want** to add general bylaw references at the form level,
**So that** applicants see overall legal context.

**Acceptance Criteria:**
- [ ] Form settings panel has "Relevant Bylaws" section
- [ ] Can configure primary bylaw with section, document, summary, requirements, quote
- [ ] Can add additional bylaw references
- [ ] Preview shows bylaws at top of form
- [ ] Bylaws display in collapsible alert box

**UI Components:**
- FormLevelBylawsEditor: Structured editor for form-level bylaws
- PrimaryBylawEditor: Editor for main bylaw reference
- AdditionalReferencesEditor: List of secondary references

**Data Structure:**
```typescript
interface RelevantBylaws {
  primary: {
    section: string;
    document: string;
    summary: string;
    keyRequirements: string[];
    quote?: string;
  };
  additionalReferences?: Array<{
    section: string;
    document: string;
    summary: string;
    keyProvisions: string[];
  }>;
}
```

---

### 🎯 US-15: Manage Document Requirements
**As a** property manager,
**I want** to specify required and optional documents,
**So that** applicants know what to upload.

**Acceptance Criteria:**
- [ ] Form settings has "Document Requirements" section
- [ ] Can add new document requirement
- [ ] Each requirement has: name, required toggle, description
- [ ] Can reorder requirements via drag-drop
- [ ] Can edit requirement inline
- [ ] Can delete requirements
- [ ] Preview shows documents section
- [ ] Required documents marked with red indicator

**UI Components:**
- DocumentRequirementsEditor: List editor for documents
- DocumentRequirementItem: Single document configuration
- RequiredToggle: Switch for required/optional

**Data Structure:**
```typescript
interface DocumentRequirement {
  name: string;         // e.g., "Site Plan"
  required: boolean;    // true/false
  description?: string; // e.g., "Must show property boundaries"
}
```

---

### 🎯 US-16: Configure Scoring Weights
**As a** property manager,
**I want** to assign point values to fields,
**So that** completeness scores accurately reflect importance.

**Acceptance Criteria:**
- [ ] Each field properties panel shows scoring weight input
- [ ] Default weight is 1 for required fields, 0 for optional
- [ ] Can set custom weight (0-100)
- [ ] Form shows total possible score
- [ ] Preview shows completeness percentage calculation
- [ ] Weights saved in scoring_weights map

**UI Components:**
- ScoringWeightInput: Number input with slider
- TotalScoreDisplay: Shows max possible score
- CompletenessCalculator: Preview of scoring logic

**Business Rules:**
- Total possible score = sum of all field weights
- Completeness = (filled fields score / total) * 100
- Default weight: required fields = 1, optional = 0.5
- Custom weights override defaults

---

### 🎯 US-17: Add Compliance Notes
**As a** property manager,
**I want** to add compliance reminders and common violations,
**So that** applicants avoid mistakes.

**Acceptance Criteria:**
- [ ] Form settings has "Compliance Notes" section
- [ ] Can add critical reminders list
- [ ] Can add common violations list
- [ ] Can add approval process steps list
- [ ] Notes display in info box on application form
- [ ] Notes editable with rich text

**UI Components:**
- ComplianceNotesEditor: Multi-section editor
- BulletListEditor: Reusable list editor

**Data Structure:**
```typescript
interface ComplianceNotes {
  criticalReminders?: string[];    // Important things to remember
  commonViolations?: string[];     // Frequent mistakes
  approvalProcess?: string[];      // Process steps
}
```

---

### 🎯 US-18: Configure ARB Process Notes
**As a** property manager,
**I want** to add Architectural Review Board process information,
**So that** applicants understand the review workflow.

**Acceptance Criteria:**
- [ ] Form settings has "ARB Process" section
- [ ] Can add application timeline text
- [ ] Can add required meetings list
- [ ] Can add performance deposit info
- [ ] Can add ARB contact information
- [ ] Notes display at bottom of application form

**UI Components:**
- ARBProcessEditor: Process information editor
- ContactInfoInput: Structured contact editor

**Data Structure:**
```typescript
interface ARBProcessNotes {
  applicationTimeline?: string;     // "6-8 weeks typical"
  requiredMeetings?: string[];      // ["Pre-submission conference"]
  performanceDepositInfo?: string;  // Deposit requirements
  arbContactInfo?: string;          // Contact details
}
```

---

### 🎯 US-19: Preview Form in Real-Time
**As a** property manager,
**I want** to see a live preview of the form as I build it,
**So that** I know how it will appear to applicants.

**Acceptance Criteria:**
- [ ] Right panel shows live form preview
- [ ] Preview updates in real-time as changes made
- [ ] Preview matches actual DynamicForm rendering
- [ ] Preview is scrollable independently
- [ ] Preview shows all field types correctly
- [ ] Preview shows validation states
- [ ] Preview shows bylaw info icons
- [ ] Can interact with preview fields (limited)

**UI Components:**
- LiveFormPreview: Real-time preview panel
- PreviewContainer: Scrollable preview wrapper
- Uses existing DynamicForm component in read-only mode

**Technical Notes:**
- Preview uses same DynamicForm component as actual applications
- Preview updates on every schema change (debounced 300ms)
- Preview in read-only mode (no actual form submission)

---

### 🎯 US-20: Toggle Preview Mode
**As a** property manager,
**I want** to toggle between edit and full-screen preview,
**So that** I can review the entire form without distractions.

**Acceptance Criteria:**
- [ ] Header shows "Preview Mode" toggle
- [ ] Toggle switches between edit and preview layouts
- [ ] Preview mode: Full-width preview, hidden sidebars
- [ ] Edit mode: Standard three-panel layout
- [ ] Mode persists during session (not across sessions)
- [ ] Keyboard shortcut: Cmd/Ctrl+P

**UI Components:**
- PreviewModeToggle: Toggle button in header
- FullScreenPreview: Full-width preview layout

---

### 🎯 US-21: Validate Form Schema
**As a** property manager,
**I want** automatic validation of my form configuration,
**So that** I don't publish broken forms.

**Acceptance Criteria:**
- [ ] Real-time validation as form is built
- [ ] Validation errors shown inline at source
- [ ] Validation summary in header
- [ ] Cannot save if critical errors exist
- [ ] Warnings allow save but show notification
- [ ] Validation rules:
  - [ ] Form must have title
  - [ ] Form must have at least one section
  - [ ] Each section must have at least one field
  - [ ] Field IDs must be unique
  - [ ] Field IDs must be valid snake_case
  - [ ] Required fields must have labels
  - [ ] Select/radio/checkbox must have options
  - [ ] Options must have at least 2 items
  - [ ] Scoring weights must be non-negative numbers

**UI Components:**
- ValidationSummary: Header badge showing error count
- ValidationError: Inline error message
- ValidationWarning: Inline warning message
- ValidationPanel: Expandable panel listing all issues

**Validation Types:**
- **Error**: Prevents save, must be fixed
- **Warning**: Allows save, shows notification
- **Info**: Informational, no blocking

---

### 🎯 US-22: Save Form as New Version
**As a** property manager,
**I want** to save my changes as a new version,
**So that** I can iterate without affecting the active form.

**Acceptance Criteria:**
- [ ] Header shows "Save as New Version" button
- [ ] Button disabled if validation errors exist
- [ ] Click opens version creation dialog
- [ ] Dialog requires version name
- [ ] Dialog optionally accepts description
- [ ] Can choose to activate new version immediately
- [ ] Save creates new form template record
- [ ] Success toast shows version number
- [ ] Redirects back to Form Wizard after save

**UI Components:**
- SaveVersionButton: Primary action button
- VersionCreationDialog: Modal for version details
- ActivateToggle: Checkbox to set as active

**Technical Flow:**
1. User clicks "Save as New Version"
2. Validate form schema
3. Open VersionCreationDialog
4. User enters name, description, activate toggle
5. POST to `/api/form-templates`
6. Increment version number automatically
7. Set isActive based on toggle
8. Show success toast
9. Navigate to `/form-wizard`

**API Request:**
```typescript
POST /api/form-templates
{
  tenantId: string;
  projectType: ApplicationType;
  name: string;
  description?: string;
  schema: AdditionalInfoConfig;
  isActive: boolean;
}
```

---

### 🎯 US-23: Update Existing Version
**As a** property manager,
**I want** to update the current version in place,
**So that** I can fix mistakes without creating new versions.

**Acceptance Criteria:**
- [ ] Header shows "Update Version" button (secondary)
- [ ] Button disabled if validation errors exist
- [ ] Click opens confirmation dialog
- [ ] Warning if version is active and has applications
- [ ] Confirm updates form template in place
- [ ] Version number stays the same
- [ ] Updated timestamp recorded
- [ ] Success toast confirms update
- [ ] Can continue editing or return to wizard

**UI Components:**
- UpdateVersionButton: Secondary action button
- UpdateConfirmationDialog: Warning dialog

**Business Rules:**
- Can update any version (active or inactive)
- If active version with applications, show strong warning
- Changes apply immediately to new applications
- Existing applications keep their captured formData

**API Request:**
```typescript
PATCH /api/form-templates/:id
{
  name?: string;
  description?: string;
  schema: AdditionalInfoConfig;
}
```

---

### 🎯 US-24: Discard Changes
**As a** property manager,
**I want** to discard my changes and revert to the saved version,
**So that** I can undo mistakes.

**Acceptance Criteria:**
- [ ] Header shows "Discard Changes" button
- [ ] Button disabled if no changes made
- [ ] Click opens confirmation dialog
- [ ] Confirm reloads original schema
- [ ] All edits lost (no undo)
- [ ] Success toast confirms revert
- [ ] Can continue editing from saved state

**UI Components:**
- DiscardButton: Tertiary action button
- DiscardConfirmationDialog: Warning dialog

**Technical Notes:**
- Track original schema on load
- Track dirty state (hasUnsavedChanges boolean)
- Reset schema to original on discard

---

### 🎯 US-25: Navigate Away with Unsaved Changes
**As a** property manager,
**I want** to be warned before leaving with unsaved changes,
**So that** I don't lose my work.

**Acceptance Criteria:**
- [ ] Navigation blocked if unsaved changes exist
- [ ] Dialog warns about unsaved changes
- [ ] Options: Stay, Discard and Leave, Save and Leave
- [ ] "Stay" cancels navigation
- [ ] "Discard and Leave" navigates away
- [ ] "Save and Leave" opens save dialog, then navigates
- [ ] Browser back/forward triggers warning
- [ ] Closing tab triggers browser warning

**UI Components:**
- NavigationBlockDialog: Three-button confirmation
- Uses `beforeunload` event for browser close

**Technical Notes:**
- Implement route guard using wouter
- Add window.beforeunload handler
- Track dirty state across route changes

---

### 🎯 US-26: Duplicate Field
**As a** property manager,
**I want** to duplicate an existing field,
**So that** I can quickly create similar fields.

**Acceptance Criteria:**
- [ ] Field card shows "Duplicate" icon on hover
- [ ] Click creates copy of field
- [ ] Duplicate appears immediately below original
- [ ] ID auto-incremented (field_name → field_name_2)
- [ ] Label appended with "(Copy)"
- [ ] All other properties copied exactly
- [ ] Can edit duplicate immediately

**UI Components:**
- DuplicateFieldButton: Copy icon in field card

**Technical Notes:**
- Deep clone field object
- Generate unique ID (append _2, _3, etc.)
- Ensure ID uniqueness across all fields

---

### 🎯 US-27: Duplicate Section
**As a** property manager,
**I want** to duplicate an entire section,
**So that** I can reuse question groups.

**Acceptance Criteria:**
- [ ] Section header shows "Duplicate" icon
- [ ] Click creates copy of section with all fields
- [ ] Section title appended with "(Copy)"
- [ ] All field IDs auto-incremented for uniqueness
- [ ] Duplicate appears immediately below original
- [ ] All field properties preserved

**UI Components:**
- DuplicateSectionButton: Copy icon in section header

**Technical Notes:**
- Deep clone section and all fields
- Ensure all field IDs are unique
- Maintain field order within section

---

### 🎯 US-28: Search/Filter Fields
**As a** property manager,
**I want** to search for specific fields or sections,
**So that** I can quickly find items in large forms.

**Acceptance Criteria:**
- [ ] Sidebar shows search input at top
- [ ] Search filters sections and fields by name
- [ ] Matched items highlighted in sidebar
- [ ] Unmatched items grayed out or hidden (toggle)
- [ ] Search is case-insensitive
- [ ] Clear search button
- [ ] Keyboard shortcut: Cmd/Ctrl+F

**UI Components:**
- SidebarSearch: Search input with clear button
- SearchResults: Filtered tree view
- MatchHighlight: Highlighted text in results

---

### 🎯 US-29: Keyboard Shortcuts
**As a** property manager,
**I want** keyboard shortcuts for common actions,
**So that** I can work more efficiently.

**Shortcuts:**
- `Cmd/Ctrl + S`: Save as new version
- `Cmd/Ctrl + Shift + S`: Update existing version
- `Cmd/Ctrl + P`: Toggle preview mode
- `Cmd/Ctrl + F`: Focus search
- `Cmd/Ctrl + Z`: Undo last change
- `Cmd/Ctrl + Shift + Z`: Redo change
- `Cmd/Ctrl + D`: Duplicate selected field/section
- `Alt + Up/Down`: Reorder selected item
- `Delete`: Delete selected item
- `Escape`: Close dialog/panel

**Acceptance Criteria:**
- [ ] All shortcuts work as documented
- [ ] Shortcuts shown in tooltips
- [ ] Shortcuts shown in help dialog
- [ ] Help dialog accessible via `?` key
- [ ] Shortcuts respect OS conventions (Cmd vs Ctrl)

**UI Components:**
- ShortcutsHelp: Help dialog listing all shortcuts
- Tooltip: Show shortcut in button tooltips

---

### 🎯 US-30: Undo/Redo Changes
**As a** property manager,
**I want** to undo and redo my changes,
**So that** I can experiment without fear.

**Acceptance Criteria:**
- [ ] Header shows Undo/Redo buttons
- [ ] Undo button disabled if no history
- [ ] Redo button disabled if at current state
- [ ] Undo reverts last change
- [ ] Redo reapplies undone change
- [ ] History preserved across edits (not saves)
- [ ] History cleared on save
- [ ] Tooltips show action description
- [ ] Max history: 50 actions

**UI Components:**
- UndoButton: Arrow left icon
- RedoButton: Arrow right icon

**Technical Notes:**
- Implement command pattern for all mutations
- Maintain history stack (array of states)
- Track current position in history
- Each action records: type, before, after
- Clear history on save

**Undoable Actions:**
- Add/edit/delete section
- Add/edit/delete field
- Reorder sections/fields
- Move field to different section
- Edit form metadata
- Edit bylaws/compliance notes
- Change scoring weights

---

## Technical Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Form Builder App                         │
├─────────────────┬───────────────────────┬───────────────────┤
│                 │                       │                   │
│   Sidebar       │    Main Canvas        │   Properties      │
│   (Tree View)   │    (Visual Editor)    │   Panel           │
│                 │                       │                   │
│ - Section List  │ - Form Header         │ - Field Props     │
│ - Field Count   │ - Sections            │ - Validation      │
│ - Search        │ - Fields              │ - Bylaws          │
│ - Add Section   │ - Drag Handles        │ - Scoring         │
│                 │ - Add Field           │                   │
│                 │                       │                   │
└─────────────────┴───────────────────────┴───────────────────┘
         │                  │                       │
         └──────────────────┼───────────────────────┘
                            │
                   ┌────────▼────────┐
                   │  State Manager  │
                   │  (Zustand)      │
                   └────────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
        ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
        │ Schema    │ │ History   │ │ Validation│
        │ State     │ │ State     │ │ State     │
        └───────────┘ └───────────┘ └───────────┘
```

### Component Hierarchy

```
FormBuilderPage
├── FormBuilderHeader
│   ├── FormMetadataEditor
│   │   ├── EditableTitle
│   │   └── EditableDescription
│   ├── ValidationSummary
│   ├── PreviewModeToggle
│   └── ActionButtons
│       ├── SaveVersionButton
│       ├── UpdateVersionButton
│       ├── DiscardButton
│       ├── UndoButton
│       └── RedoButton
│
├── FormBuilderLayout (3-column grid)
│   ├── FormBuilderSidebar (left panel)
│   │   ├── SidebarSearch
│   │   ├── SectionTree
│   │   │   ├── SectionNode (repeating)
│   │   │   │   ├── DragHandle
│   │   │   │   ├── SectionTitle
│   │   │   │   ├── FieldCountBadge
│   │   │   │   └── FieldList
│   │   │   │       └── FieldNode (repeating)
│   │   │   └── AddSectionButton
│   │   └── FormSettingsButton
│   │
│   ├── FormBuilderCanvas (center panel)
│   │   ├── FormCanvasHeader
│   │   │   ├── FormTitle (readonly preview)
│   │   │   └── FormDescription (readonly preview)
│   │   ├── SectionList
│   │   │   └── EditableSection (repeating)
│   │   │       ├── SectionHeader
│   │   │       │   ├── DragHandle
│   │   │       │   ├── InlineEditableText
│   │   │       │   ├── DuplicateSectionButton
│   │   │       │   └── DeleteSectionButton
│   │   │       ├── FieldList
│   │   │       │   └── EditableField (repeating)
│   │   │       │       ├── DragHandle
│   │   │       │       ├── FieldCard
│   │   │       │       │   ├── FieldIcon
│   │   │       │       │   ├── FieldLabel
│   │   │       │       │   ├── FieldType
│   │   │       │       │   ├── RequiredBadge
│   │   │       │       │   └── FieldActions
│   │   │       │       │       ├── EditFieldButton
│   │   │       │       │       ├── DuplicateFieldButton
│   │   │       │       │       └── DeleteFieldButton
│   │   │       │       └── FieldPreview (when selected)
│   │   │       └── AddFieldButton
│   │   └── AddSectionButton
│   │
│   └── FormBuilderPropertiesPanel (right panel)
│       ├── (Empty state when nothing selected)
│       ├── FieldPropertiesEditor (when field selected)
│       │   ├── BasicProperties
│       │   │   ├── FieldIdInput
│       │   │   ├── FieldLabelInput
│       │   │   ├── FieldTypeSelector
│       │   │   ├── RequiredToggle
│       │   │   ├── PlaceholderInput
│       │   │   └── DescriptionInput
│       │   ├── TypeSpecificProperties
│       │   │   ├── OptionsListEditor (select/radio/checkbox)
│       │   │   ├── NumberRangeInput (number)
│       │   │   ├── TextLengthInput (text/textarea)
│       │   │   └── DateRangeInput (date)
│       │   ├── ValidationRulesEditor
│       │   ├── BylawReferenceEditor
│       │   │   ├── ReferenceInput
│       │   │   ├── RequirementInput
│       │   │   ├── BulletListEditor (requirements)
│       │   │   ├── NoteInput
│       │   │   ├── QuoteInput
│       │   │   ├── BulletListEditor (keyRestrictions)
│       │   │   ├── BulletListEditor (approvedMaterials)
│       │   │   ├── ProhibitedInput
│       │   │   └── BulletListEditor (preferredStyles)
│       │   └── ScoringWeightInput
│       └── FormSettingsEditor (when settings open)
│           ├── FormLevelBylawsEditor
│           │   ├── PrimaryBylawEditor
│           │   └── AdditionalReferencesEditor
│           ├── DocumentRequirementsEditor
│           ├── ComplianceNotesEditor
│           └── ARBProcessEditor
│
├── FormPreviewPanel (conditionally rendered)
│   └── LiveFormPreview
│       └── DynamicForm (read-only)
│
└── Dialogs/Modals
    ├── FieldTypeSelector
    ├── VersionCreationDialog
    ├── UpdateConfirmationDialog
    ├── DiscardConfirmationDialog
    ├── NavigationBlockDialog
    ├── ConfirmationDialog (generic)
    ├── ShortcutsHelpDialog
    └── UndoToast
```

### State Management Architecture

Using **Zustand** for state management with these stores:

#### 1. FormBuilderStore
Primary store for form schema and editing state.

```typescript
interface FormBuilderState {
  // Schema state
  schema: AdditionalInfoConfig | null;
  originalSchema: AdditionalInfoConfig | null; // For dirty checking

  // UI state
  selectedFieldId: string | null;
  selectedSectionIndex: number | null;
  isPreviewMode: boolean;
  isSaving: boolean;

  // Dirty tracking
  hasUnsavedChanges: boolean;

  // Actions - Form metadata
  setFormTitle: (title: string) => void;
  setFormDescription: (description: string) => void;

  // Actions - Sections
  addSection: (section: AdditionalInfoSection) => void;
  updateSection: (index: number, section: Partial<AdditionalInfoSection>) => void;
  deleteSection: (index: number) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  duplicateSection: (index: number) => void;

  // Actions - Fields
  addField: (sectionIndex: number, field: AdditionalInfoField) => void;
  updateField: (sectionIndex: number, fieldId: string, field: Partial<AdditionalInfoField>) => void;
  deleteField: (sectionIndex: number, fieldId: string) => void;
  reorderFields: (sectionIndex: number, fromIndex: number, toIndex: number) => void;
  moveFieldToSection: (fieldId: string, fromSectionIndex: number, toSectionIndex: number) => void;
  duplicateField: (sectionIndex: number, fieldId: string) => void;

  // Actions - Form settings
  setRelevantBylaws: (bylaws: RelevantBylaws) => void;
  setDocumentRequirements: (documents: DocumentRequirement[]) => void;
  setScoringWeights: (weights: Record<string, number>) => void;
  setComplianceNotes: (notes: ComplianceNotes) => void;
  setARBProcessNotes: (notes: ARBProcessNotes) => void;

  // Actions - UI
  selectField: (sectionIndex: number, fieldId: string) => void;
  deselectField: () => void;
  togglePreviewMode: () => void;

  // Actions - Persistence
  loadSchema: (schema: AdditionalInfoConfig) => void;
  reset: () => void;
  discardChanges: () => void;
}
```

#### 2. HistoryStore
Manages undo/redo functionality.

```typescript
interface HistoryCommand {
  type: string;
  execute: (state: FormBuilderState) => void;
  undo: (state: FormBuilderState) => void;
  description: string;
}

interface HistoryState {
  history: HistoryCommand[];
  currentIndex: number;
  maxHistory: number;

  // Actions
  executeCommand: (command: HistoryCommand) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}
```

#### 3. ValidationStore
Manages real-time validation.

```typescript
interface ValidationError {
  path: string;           // e.g., "sections[0].fields[2].id"
  message: string;
  severity: 'error' | 'warning' | 'info';
  field?: string;
}

interface ValidationState {
  errors: ValidationError[];
  isValid: boolean;

  // Actions
  validate: (schema: AdditionalInfoConfig) => void;
  clearErrors: () => void;
  getErrorsForPath: (path: string) => ValidationError[];
}
```

### Validation Rules

Comprehensive validation implemented in `validateFormSchema(schema)`:

```typescript
function validateFormSchema(schema: AdditionalInfoConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  // Form-level validation
  if (!schema.title || schema.title.trim() === '') {
    errors.push({
      path: 'title',
      message: 'Form title is required',
      severity: 'error',
    });
  }

  if (schema.title && schema.title.length > 200) {
    errors.push({
      path: 'title',
      message: 'Form title must be 200 characters or less',
      severity: 'error',
    });
  }

  if (!schema.sections || schema.sections.length === 0) {
    errors.push({
      path: 'sections',
      message: 'Form must have at least one section',
      severity: 'error',
    });
  }

  // Section validation
  const fieldIds = new Set<string>();
  schema.sections?.forEach((section, sectionIndex) => {
    if (!section.title || section.title.trim() === '') {
      errors.push({
        path: `sections[${sectionIndex}].title`,
        message: `Section ${sectionIndex + 1} must have a title`,
        severity: 'error',
      });
    }

    if (!section.fields || section.fields.length === 0) {
      errors.push({
        path: `sections[${sectionIndex}].fields`,
        message: `Section "${section.title}" must have at least one field`,
        severity: 'warning',
      });
    }

    // Field validation
    section.fields?.forEach((field, fieldIndex) => {
      const fieldPath = `sections[${sectionIndex}].fields[${fieldIndex}]`;

      // ID validation
      if (!field.id || field.id.trim() === '') {
        errors.push({
          path: `${fieldPath}.id`,
          message: 'Field ID is required',
          severity: 'error',
          field: field.label || `Field ${fieldIndex + 1}`,
        });
      } else {
        // Check for duplicate IDs
        if (fieldIds.has(field.id)) {
          errors.push({
            path: `${fieldPath}.id`,
            message: `Duplicate field ID: "${field.id}"`,
            severity: 'error',
            field: field.label,
          });
        }
        fieldIds.add(field.id);

        // Check ID format (snake_case)
        if (!/^[a-z][a-z0-9_]*$/.test(field.id)) {
          errors.push({
            path: `${fieldPath}.id`,
            message: 'Field ID must be snake_case (lowercase with underscores)',
            severity: 'error',
            field: field.label,
          });
        }
      }

      // Label validation
      if (!field.label || field.label.trim() === '') {
        errors.push({
          path: `${fieldPath}.label`,
          message: 'Field label is required',
          severity: 'error',
          field: field.id,
        });
      }

      // Type validation
      const validTypes = ['text', 'textarea', 'select', 'radio', 'checkbox', 'number', 'date'];
      if (!field.type || !validTypes.includes(field.type)) {
        errors.push({
          path: `${fieldPath}.type`,
          message: 'Field must have a valid type',
          severity: 'error',
          field: field.label,
        });
      }

      // Options validation for select/radio/checkbox
      if (['select', 'radio', 'checkbox'].includes(field.type)) {
        if (!field.options || field.options.length === 0) {
          errors.push({
            path: `${fieldPath}.options`,
            message: `${field.type} field must have options`,
            severity: 'error',
            field: field.label,
          });
        } else if (field.options.length < 2) {
          errors.push({
            path: `${fieldPath}.options`,
            message: `${field.type} field must have at least 2 options`,
            severity: 'warning',
            field: field.label,
          });
        }
      }

      // Scoring weight validation
      if (field.scoring !== undefined && field.scoring < 0) {
        errors.push({
          path: `${fieldPath}.scoring`,
          message: 'Scoring weight cannot be negative',
          severity: 'error',
          field: field.label,
        });
      }
    });
  });

  return errors;
}
```

### Drag-and-Drop Implementation

Using `@dnd-kit/core` and `@dnd-kit/sortable`:

```typescript
// Drag-drop for sections
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableSection({ section, index }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="drag-handle" {...attributes} {...listeners}>
        ⋮⋮
      </div>
      <SectionContent section={section} />
    </div>
  );
}

function SectionList() {
  const { schema, reorderSections } = useFormBuilderStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = sections.findIndex(s => s.id === active.id);
      const newIndex = sections.findIndex(s => s.id === over.id);
      reorderSections(oldIndex, newIndex);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections} strategy={verticalListSortingStrategy}>
        {sections.map((section, index) => (
          <SortableSection key={section.id} section={section} index={index} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

### Route Configuration

```typescript
// Add to routes
import FormBuilderPage from '@/pages/FormBuilderPage';

<Route path="/form-builder/:templateId" component={FormBuilderPage} />
```

---

## Implementation Tasks

### Phase 1: Foundation (Core Architecture)
**Estimated Effort**: 3-4 days

#### Task 1.1: Project Setup
- [ ] Create `/pages/FormBuilderPage.tsx` file
- [ ] Create `/components/form-builder/` directory structure
- [ ] Install dependencies: `@dnd-kit/core`, `@dnd-kit/sortable`, `zustand`
- [ ] Set up route in app router: `/form-builder/:templateId`
- [ ] Create basic page layout (header + 3-column grid)

**Files**:
- `client/src/pages/FormBuilderPage.tsx`
- `client/src/components/form-builder/index.ts`

**Acceptance**: Page loads at `/form-builder/:id`, shows placeholder content

---

#### Task 1.2: Create Zustand Stores
- [ ] Create `stores/formBuilderStore.ts`
- [ ] Implement FormBuilderState interface
- [ ] Implement all actions (stubs initially)
- [ ] Create `stores/historyStore.ts`
- [ ] Implement HistoryState interface
- [ ] Create `stores/validationStore.ts`
- [ ] Implement ValidationState interface
- [ ] Add store initialization in FormBuilderPage

**Files**:
- `client/src/stores/formBuilderStore.ts`
- `client/src/stores/historyStore.ts`
- `client/src/stores/validationStore.ts`

**Acceptance**: Stores initialized, can set/get schema

---

#### Task 1.3: Load Template Data
- [ ] Add API fetch in FormBuilderPage `useEffect`
- [ ] Fetch template by ID from `/api/form-templates/:id`
- [ ] Load schema into FormBuilderStore
- [ ] Handle loading states (spinner)
- [ ] Handle error states (404, permission denied)
- [ ] Store originalSchema for dirty checking

**Files**:
- `client/src/pages/FormBuilderPage.tsx`

**Acceptance**: Template loads from API, schema populated in store

---

#### Task 1.4: Create Layout Components
- [ ] Create `FormBuilderHeader.tsx`
- [ ] Create `FormBuilderLayout.tsx` (3-column grid)
- [ ] Create `FormBuilderSidebar.tsx` (left panel placeholder)
- [ ] Create `FormBuilderCanvas.tsx` (center panel placeholder)
- [ ] Create `FormBuilderPropertiesPanel.tsx` (right panel placeholder)
- [ ] Add responsive breakpoints (collapse sidebars on mobile)

**Files**:
- `client/src/components/form-builder/FormBuilderHeader.tsx`
- `client/src/components/form-builder/FormBuilderLayout.tsx`
- `client/src/components/form-builder/FormBuilderSidebar.tsx`
- `client/src/components/form-builder/FormBuilderCanvas.tsx`
- `client/src/components/form-builder/FormBuilderPropertiesPanel.tsx`

**Acceptance**: 3-column layout renders, panels visible

---

### Phase 2: Form Metadata Editing
**Estimated Effort**: 1 day

#### Task 2.1: Editable Form Title
- [ ] Create `FormMetadataEditor.tsx` component
- [ ] Create `EditableTitle.tsx` component
- [ ] Implement inline editing (click to edit)
- [ ] Add validation (required, max 200 chars)
- [ ] Connect to store action `setFormTitle`
- [ ] Show validation errors inline
- [ ] Track dirty state

**Files**:
- `client/src/components/form-builder/FormMetadataEditor.tsx`
- `client/src/components/form-builder/EditableTitle.tsx`

**Acceptance**: Can edit form title inline, validates correctly

---

#### Task 2.2: Editable Form Description
- [ ] Create `EditableDescription.tsx` component
- [ ] Implement textarea editing
- [ ] Add validation (max 1000 chars)
- [ ] Connect to store action `setFormDescription`
- [ ] Show character count
- [ ] Auto-resize textarea

**Files**:
- `client/src/components/form-builder/EditableDescription.tsx`

**Acceptance**: Can edit description, character counter works

---

### Phase 3: Section Management
**Estimated Effort**: 2-3 days

#### Task 3.1: Display Section List in Sidebar
- [ ] Create `SectionTree.tsx` component
- [ ] Create `SectionNode.tsx` component
- [ ] Map schema.sections to SectionNode components
- [ ] Display section title and field count
- [ ] Add expand/collapse functionality
- [ ] Highlight selected section

**Files**:
- `client/src/components/form-builder/SectionTree.tsx`
- `client/src/components/form-builder/SectionNode.tsx`

**Acceptance**: All sections listed in sidebar, collapsible

---

#### Task 3.2: Display Sections in Canvas
- [ ] Create `SectionList.tsx` component
- [ ] Create `EditableSection.tsx` component
- [ ] Create `SectionHeader.tsx` component
- [ ] Map schema.sections to EditableSection components
- [ ] Display section title in header
- [ ] Add visual separation between sections

**Files**:
- `client/src/components/form-builder/SectionList.tsx`
- `client/src/components/form-builder/EditableSection.tsx`
- `client/src/components/form-builder/SectionHeader.tsx`

**Acceptance**: All sections render in canvas with headers

---

#### Task 3.3: Add New Section
- [ ] Create `AddSectionButton.tsx` component
- [ ] Create `SectionCreateForm.tsx` component
- [ ] Add button at bottom of section list
- [ ] Click opens inline form
- [ ] Form has title input (required)
- [ ] Save creates new section via store action
- [ ] New section appears immediately
- [ ] Cancel discards input

**Files**:
- `client/src/components/form-builder/AddSectionButton.tsx`
- `client/src/components/form-builder/SectionCreateForm.tsx`

**Acceptance**: Can add new section, appears in sidebar and canvas

---

#### Task 3.4: Edit Section Title
- [ ] Create `InlineEditableText.tsx` component (reusable)
- [ ] Apply to section header title
- [ ] Click to enable editing
- [ ] Enter to save, Esc to cancel
- [ ] Update via store action `updateSection`
- [ ] Validation: required, max 100 chars
- [ ] Update sidebar simultaneously

**Files**:
- `client/src/components/form-builder/InlineEditableText.tsx`

**Acceptance**: Can edit section title inline, syncs with sidebar

---

#### Task 3.5: Delete Section
- [ ] Create `DeleteSectionButton.tsx` component
- [ ] Add trash icon to section header
- [ ] Create `ConfirmationDialog.tsx` component (reusable)
- [ ] Click shows confirmation with field count
- [ ] Confirm deletes via store action `deleteSection`
- [ ] Show undo toast for 5 seconds
- [ ] Implement undo functionality
- [ ] Remove from sidebar and canvas

**Files**:
- `client/src/components/form-builder/DeleteSectionButton.tsx`
- `client/src/components/ui/ConfirmationDialog.tsx`
- `client/src/components/ui/UndoToast.tsx`

**Acceptance**: Can delete section, confirmation works, undo works

---

#### Task 3.6: Reorder Sections (Drag-Drop)
- [ ] Install `@dnd-kit/core` and `@dnd-kit/sortable`
- [ ] Create `DragHandle.tsx` component
- [ ] Wrap SectionNode with `useSortable` hook
- [ ] Wrap EditableSection with `useSortable` hook
- [ ] Implement `DndContext` in SectionList
- [ ] Add drag handlers to section headers
- [ ] Implement `reorderSections` store action
- [ ] Show drop indicators during drag
- [ ] Sync order between sidebar and canvas
- [ ] Add keyboard navigation (Alt+Up/Down)

**Files**:
- `client/src/components/form-builder/DragHandle.tsx`
- Update `SectionNode.tsx` and `EditableSection.tsx`

**Acceptance**: Can drag sections to reorder, works in both sidebar and canvas

---

#### Task 3.7: Duplicate Section
- [ ] Create `DuplicateSectionButton.tsx` component
- [ ] Add copy icon to section header
- [ ] Implement `duplicateSection` store action
- [ ] Deep clone section and all fields
- [ ] Auto-increment field IDs for uniqueness
- [ ] Append "(Copy)" to section title
- [ ] Insert below original section

**Files**:
- `client/src/components/form-builder/DuplicateSectionButton.tsx`

**Acceptance**: Can duplicate section with all fields

---

### Phase 4: Field Management (Basic)
**Estimated Effort**: 3-4 days

#### Task 4.1: Display Fields in Section
- [ ] Create `FieldList.tsx` component
- [ ] Create `EditableField.tsx` component
- [ ] Create `FieldCard.tsx` component
- [ ] Map section.fields to EditableField components
- [ ] Display field icon based on type
- [ ] Display field label and type
- [ ] Show "Required" badge if required
- [ ] Handle empty field list (placeholder)

**Files**:
- `client/src/components/form-builder/FieldList.tsx`
- `client/src/components/form-builder/EditableField.tsx`
- `client/src/components/form-builder/FieldCard.tsx`

**Acceptance**: All fields render in their sections

---

#### Task 4.2: Field Type Icons
- [ ] Create `FieldIcon.tsx` component
- [ ] Map field types to lucide-react icons:
  - text → Type
  - textarea → AlignLeft
  - number → Hash
  - date → Calendar
  - select → ChevronDown
  - radio → Circle
  - checkbox → CheckSquare
- [ ] Display icon with type color coding
- [ ] Add tooltip showing field type

**Files**:
- `client/src/components/form-builder/FieldIcon.tsx`

**Acceptance**: Each field shows correct icon

---

#### Task 4.3: Add Field Button
- [ ] Create `AddFieldButton.tsx` component
- [ ] Add button at bottom of each section
- [ ] Click opens field type selector modal
- [ ] Create `FieldTypeSelector.tsx` modal
- [ ] Display grid of field types with icons and descriptions
- [ ] Select type opens field config panel

**Files**:
- `client/src/components/form-builder/AddFieldButton.tsx`
- `client/src/components/form-builder/FieldTypeSelector.tsx`

**Acceptance**: Button opens type selector modal

---

#### Task 4.4: Field Type Selector Modal
- [ ] Create type selector grid layout
- [ ] Each type shows: icon, name, description, example
- [ ] Clicking type closes modal and opens config panel
- [ ] Pass selected type to config panel
- [ ] Add cancel button
- [ ] Add search/filter for types

**Files**:
- `client/src/components/form-builder/FieldTypeSelector.tsx`

**Acceptance**: Can select field type, opens config panel

---

#### Task 4.5: Basic Field Configuration Panel
- [ ] Create `FieldConfigPanel.tsx` component
- [ ] Create `BasicFieldProperties.tsx` component
- [ ] Show field type (readonly after creation)
- [ ] Field ID input (auto-generated from label, editable)
- [ ] Field label input (required, max 200 chars)
- [ ] Required toggle
- [ ] Placeholder input (max 200 chars)
- [ ] Description textarea (max 500 chars)
- [ ] ID auto-generation: label → snake_case
- [ ] ID validation: unique, snake_case, max 50 chars
- [ ] Save button: validates and calls `addField` action
- [ ] Cancel button: closes panel

**Files**:
- `client/src/components/form-builder/FieldConfigPanel.tsx`
- `client/src/components/form-builder/BasicFieldProperties.tsx`

**Acceptance**: Can configure basic field properties, validation works

---

#### Task 4.6: Type-Specific Properties - Options
- [ ] Create `OptionsListEditor.tsx` component
- [ ] Show for select, radio, checkbox types only
- [ ] Add new option button
- [ ] Inline editable option text
- [ ] Reorder options via drag-drop
- [ ] Delete option button
- [ ] Validation: min 2 options
- [ ] Show option count

**Files**:
- `client/src/components/form-builder/OptionsListEditor.tsx`

**Acceptance**: Can manage options for choice fields

---

#### Task 4.7: Type-Specific Properties - Number
- [ ] Create `NumberRangeInput.tsx` component
- [ ] Min value input (optional)
- [ ] Max value input (optional)
- [ ] Step value input (default 1)
- [ ] Validation: min < max
- [ ] Preview shows number input with constraints

**Files**:
- `client/src/components/form-builder/NumberRangeInput.tsx`

**Acceptance**: Can configure number constraints

---

#### Task 4.8: Type-Specific Properties - Text
- [ ] Create `TextLengthInput.tsx` component
- [ ] Min length input (optional)
- [ ] Max length input (optional)
- [ ] Pattern input with regex tester (optional)
- [ ] Validation: min < max
- [ ] Preview shows character counter

**Files**:
- `client/src/components/form-builder/TextLengthInput.tsx`

**Acceptance**: Can configure text constraints

---

#### Task 4.9: Type-Specific Properties - Date
- [ ] Create `DateRangeInput.tsx` component
- [ ] Min date input (optional)
- [ ] Max date input (optional)
- [ ] Validation: min < max
- [ ] Support relative dates (e.g., "today", "+30 days")
- [ ] Preview shows date picker with constraints

**Files**:
- `client/src/components/form-builder/DateRangeInput.tsx`

**Acceptance**: Can configure date constraints

---

#### Task 4.10: Field Selection & Properties Panel
- [ ] Create `FieldPropertiesEditor.tsx` component
- [ ] Click field card to select
- [ ] Show selected state (highlight/border)
- [ ] Open properties panel on right
- [ ] Load field properties into panel
- [ ] Allow editing all properties
- [ ] Save updates via `updateField` action
- [ ] Cancel reverts changes
- [ ] Click outside deselects

**Files**:
- `client/src/components/form-builder/FieldPropertiesEditor.tsx`

**Acceptance**: Can select field, edit properties in panel

---

#### Task 4.11: Delete Field
- [ ] Create `DeleteFieldButton.tsx` component
- [ ] Add trash icon to field card (on hover)
- [ ] Click shows confirmation dialog
- [ ] Warning if field has data in applications
- [ ] Confirm deletes via `deleteField` action
- [ ] Show undo toast
- [ ] Update scoring weights

**Files**:
- `client/src/components/form-builder/DeleteFieldButton.tsx`

**Acceptance**: Can delete field with confirmation

---

#### Task 4.12: Reorder Fields (Drag-Drop)
- [ ] Apply `useSortable` to EditableField
- [ ] Add drag handle to field card
- [ ] Implement drag within section
- [ ] Implement drag to different section (move)
- [ ] Show drop indicators
- [ ] Implement `reorderFields` action
- [ ] Implement `moveFieldToSection` action
- [ ] Keyboard navigation (Alt+Up/Down)

**Files**:
- Update `EditableField.tsx`

**Acceptance**: Can reorder fields within/across sections

---

#### Task 4.13: Duplicate Field
- [ ] Create `DuplicateFieldButton.tsx` component
- [ ] Add copy icon to field card actions
- [ ] Implement `duplicateField` action
- [ ] Deep clone field
- [ ] Auto-increment ID (field_name → field_name_2)
- [ ] Append "(Copy)" to label
- [ ] Insert below original field

**Files**:
- `client/src/components/form-builder/DuplicateFieldButton.tsx`

**Acceptance**: Can duplicate field with unique ID

---

### Phase 5: Advanced Field Configuration
**Estimated Effort**: 2-3 days

#### Task 5.1: Bylaw Reference Editor (Basic)
- [ ] Create `BylawReferenceEditor.tsx` component
- [ ] Add "Bylaw Reference" section to properties panel
- [ ] Reference input (text)
- [ ] Requirement input (textarea)
- [ ] Note input (textarea)
- [ ] Quote input (textarea)
- [ ] Prohibited input (text)
- [ ] Save to field.relevantBylaws
- [ ] Preview shows info icon

**Files**:
- `client/src/components/form-builder/BylawReferenceEditor.tsx`

**Acceptance**: Can add basic bylaw reference to field

---

#### Task 5.2: Bylaw Reference Lists
- [ ] Create `BulletListEditor.tsx` component (reusable)
- [ ] Add to BylawReferenceEditor
- [ ] Requirements list (array of strings)
- [ ] Key restrictions list
- [ ] Approved materials list
- [ ] Preferred styles list
- [ ] Add/edit/delete items
- [ ] Reorder items via drag-drop
- [ ] Save as arrays in relevantBylaws

**Files**:
- `client/src/components/form-builder/BulletListEditor.tsx`

**Acceptance**: Can manage bullet lists in bylaw references

---

#### Task 5.3: Bylaw Preview Dialog
- [ ] Create `BylawPreviewDialog.tsx` component
- [ ] Show in live preview when bylaw icon clicked
- [ ] Format bylaw reference nicely
- [ ] Show all sections (reference, requirements, note, quote, etc.)
- [ ] Match existing ApplicationDetail display
- [ ] Responsive layout

**Files**:
- `client/src/components/form-builder/BylawPreviewDialog.tsx`

**Acceptance**: Bylaw info displays correctly in preview

---

#### Task 5.4: Scoring Weight Configuration
- [ ] Create `ScoringWeightInput.tsx` component
- [ ] Add to properties panel for each field
- [ ] Number input with slider (0-100)
- [ ] Default: required = 1, optional = 0.5
- [ ] Show total possible score in header
- [ ] Update `scoring_weights` map in schema
- [ ] Recalculate total when weights change

**Files**:
- `client/src/components/form-builder/ScoringWeightInput.tsx`

**Acceptance**: Can set field weights, total updates

---

#### Task 5.5: Validation Rules Editor
- [ ] Create `ValidationRulesEditor.tsx` component
- [ ] Add to properties panel
- [ ] Conditional fields based on field type
- [ ] Text: minLength, maxLength, pattern
- [ ] Textarea: minLength, maxLength
- [ ] Number: min, max, step
- [ ] Date: minDate, maxDate
- [ ] Custom error message input
- [ ] Save to field validation object (extend schema if needed)

**Files**:
- `client/src/components/form-builder/ValidationRulesEditor.tsx`

**Acceptance**: Can configure validation rules

---

### Phase 6: Form-Level Settings
**Estimated Effort**: 2 days

#### Task 6.1: Form Settings Panel
- [ ] Create `FormSettingsEditor.tsx` component
- [ ] Add "Form Settings" button in sidebar
- [ ] Click opens settings in properties panel
- [ ] Tabs: Bylaws, Documents, Compliance, ARB Process
- [ ] Close returns to field properties

**Files**:
- `client/src/components/form-builder/FormSettingsEditor.tsx`

**Acceptance**: Settings panel opens with tabs

---

#### Task 6.2: Form-Level Bylaws Editor
- [ ] Create `FormLevelBylawsEditor.tsx` component
- [ ] Create `PrimaryBylawEditor.tsx` component
- [ ] Create `AdditionalReferencesEditor.tsx` component
- [ ] Primary bylaw: section, document, summary, keyRequirements[], quote
- [ ] Additional references: array of {section, document, summary, keyProvisions[]}
- [ ] Add/edit/delete additional references
- [ ] Save to schema.relevantBylaws
- [ ] Preview shows in form header

**Files**:
- `client/src/components/form-builder/FormLevelBylawsEditor.tsx`
- `client/src/components/form-builder/PrimaryBylawEditor.tsx`
- `client/src/components/form-builder/AdditionalReferencesEditor.tsx`

**Acceptance**: Can configure form-level bylaws

---

#### Task 6.3: Document Requirements Editor
- [ ] Create `DocumentRequirementsEditor.tsx` component
- [ ] Create `DocumentRequirementItem.tsx` component
- [ ] List of document requirements
- [ ] Each has: name, required toggle, description
- [ ] Add new document button
- [ ] Edit inline
- [ ] Delete document
- [ ] Reorder via drag-drop
- [ ] Save to schema.documents array
- [ ] Migrate deprecated required_documents to documents

**Files**:
- `client/src/components/form-builder/DocumentRequirementsEditor.tsx`
- `client/src/components/form-builder/DocumentRequirementItem.tsx`

**Acceptance**: Can manage document requirements

---

#### Task 6.4: Compliance Notes Editor
- [ ] Create `ComplianceNotesEditor.tsx` component
- [ ] Critical reminders list (BulletListEditor)
- [ ] Common violations list (BulletListEditor)
- [ ] Approval process list (BulletListEditor)
- [ ] Save to schema.complianceNotes
- [ ] Preview shows in info alert

**Files**:
- `client/src/components/form-builder/ComplianceNotesEditor.tsx`

**Acceptance**: Can configure compliance notes

---

#### Task 6.5: ARB Process Editor
- [ ] Create `ARBProcessEditor.tsx` component
- [ ] Application timeline input (text)
- [ ] Required meetings list (BulletListEditor)
- [ ] Performance deposit info (textarea)
- [ ] ARB contact info (structured fields)
- [ ] Save to schema.arbProcessNotes
- [ ] Preview shows at form bottom

**Files**:
- `client/src/components/form-builder/ARBProcessEditor.tsx`

**Acceptance**: Can configure ARB process notes

---

### Phase 7: Live Preview
**Estimated Effort**: 2 days

#### Task 7.1: Live Preview Panel
- [ ] Create `LiveFormPreview.tsx` component
- [ ] Render DynamicForm in read-only mode
- [ ] Pass current schema from store
- [ ] Update on every schema change (debounced 300ms)
- [ ] Scrollable independently
- [ ] Shows all sections and fields
- [ ] Shows bylaws, compliance notes, ARB process

**Files**:
- `client/src/components/form-builder/LiveFormPreview.tsx`

**Acceptance**: Preview updates in real-time

---

#### Task 7.2: Preview Mode Toggle
- [ ] Create `PreviewModeToggle.tsx` component
- [ ] Add toggle button in header
- [ ] Toggle switches layout:
  - Edit mode: 3 panels (sidebar, canvas, properties)
  - Preview mode: 1 panel (full-width preview)
- [ ] Implement `togglePreviewMode` action
- [ ] Keyboard shortcut: Cmd/Ctrl+P
- [ ] Save mode in session storage (not persistent)

**Files**:
- `client/src/components/form-builder/PreviewModeToggle.tsx`

**Acceptance**: Can toggle between edit and preview modes

---

#### Task 7.3: Preview Interactivity
- [ ] Allow filling out preview fields (temporary state)
- [ ] Show validation errors in preview
- [ ] Show completeness score calculation
- [ ] Show required field indicators
- [ ] Show bylaw info dialogs
- [ ] Reset preview data button
- [ ] Preview data not saved (temporary only)

**Files**:
- Update `LiveFormPreview.tsx`

**Acceptance**: Can interact with preview fields

---

### Phase 8: Validation & Error Handling
**Estimated Effort**: 2 days

#### Task 8.1: Implement Validation Logic
- [ ] Create `validators/formSchemaValidator.ts`
- [ ] Implement `validateFormSchema()` function
- [ ] All validation rules from spec
- [ ] Return array of ValidationError objects
- [ ] Categorize: error, warning, info
- [ ] Path-based error identification

**Files**:
- `client/src/validators/formSchemaValidator.ts`

**Acceptance**: Validation function works, returns errors

---

#### Task 8.2: Real-Time Validation
- [ ] Create `useValidation()` hook
- [ ] Run validation on every schema change (debounced 500ms)
- [ ] Update ValidationStore with results
- [ ] Implement `getErrorsForPath()` helper
- [ ] Calculate `isValid` flag

**Files**:
- `client/src/hooks/useValidation.ts`

**Acceptance**: Validation runs automatically

---

#### Task 8.3: Display Validation Errors
- [ ] Create `ValidationSummary.tsx` component
- [ ] Show in header: error count badge
- [ ] Click badge opens validation panel
- [ ] Create `ValidationPanel.tsx` component
- [ ] List all errors/warnings/info
- [ ] Click error navigates to source
- [ ] Inline errors in properties panel
- [ ] Red border on fields with errors
- [ ] Tooltip on hover showing error

**Files**:
- `client/src/components/form-builder/ValidationSummary.tsx`
- `client/src/components/form-builder/ValidationPanel.tsx`

**Acceptance**: Errors visible in UI, navigable

---

#### Task 8.4: Prevent Save with Errors
- [ ] Disable "Save" button if errors exist
- [ ] Show tooltip explaining why disabled
- [ ] Allow save with warnings (show confirmation)
- [ ] Toast notification listing errors on save attempt

**Files**:
- Update `SaveVersionButton.tsx`

**Acceptance**: Cannot save with validation errors

---

### Phase 9: Persistence & Versioning
**Estimated Effort**: 2 days

#### Task 9.1: Save as New Version
- [ ] Create `SaveVersionButton.tsx` component
- [ ] Add to header (primary action)
- [ ] Create `VersionCreationDialog.tsx` modal
- [ ] Version name input (required)
- [ ] Version description textarea (optional)
- [ ] "Set as Active" checkbox
- [ ] Validation: name required, max 200 chars
- [ ] POST to `/api/form-templates`
- [ ] Auto-increment version number
- [ ] Success toast with version number
- [ ] Navigate to `/form-wizard` after save

**Files**:
- `client/src/components/form-builder/SaveVersionButton.tsx`
- `client/src/components/form-builder/VersionCreationDialog.tsx`

**API Endpoint**:
```typescript
POST /api/form-templates
Body: {
  tenantId: string;
  projectType: ApplicationType;
  name: string;
  description?: string;
  schema: AdditionalInfoConfig;
  isActive: boolean;
}
Response: FormTemplate
```

**Acceptance**: Can save new version, appears in wizard

---

#### Task 9.2: Update Existing Version
- [ ] Create `UpdateVersionButton.tsx` component
- [ ] Add to header (secondary action)
- [ ] Create `UpdateConfirmationDialog.tsx` modal
- [ ] Show warning if version is active with applications
- [ ] Confirm updates template in place
- [ ] PATCH to `/api/form-templates/:id`
- [ ] Keep same version number
- [ ] Update timestamp
- [ ] Success toast
- [ ] Can continue editing or navigate away

**Files**:
- `client/src/components/form-builder/UpdateVersionButton.tsx`
- `client/src/components/form-builder/UpdateConfirmationDialog.tsx`

**API Endpoint**:
```typescript
PATCH /api/form-templates/:id
Body: {
  name?: string;
  description?: string;
  schema: AdditionalInfoConfig;
}
Response: FormTemplate
```

**Acceptance**: Can update version in place

---

#### Task 9.3: Discard Changes
- [ ] Create `DiscardButton.tsx` component
- [ ] Add to header (tertiary action)
- [ ] Create `DiscardConfirmationDialog.tsx` modal
- [ ] Warning about losing all changes
- [ ] Confirm reloads originalSchema
- [ ] Reset dirty state
- [ ] Success toast

**Files**:
- `client/src/components/form-builder/DiscardButton.tsx`
- `client/src/components/form-builder/DiscardConfirmationDialog.tsx`

**Acceptance**: Can revert to saved version

---

#### Task 9.4: Dirty State Tracking
- [ ] Implement `hasUnsavedChanges` computed property
- [ ] Compare current schema with originalSchema (deep equality)
- [ ] Show indicator in header when dirty
- [ ] Enable/disable buttons based on dirty state
- [ ] Update on every schema change

**Files**:
- Update `formBuilderStore.ts`

**Acceptance**: Dirty indicator shows when changes made

---

### Phase 10: Navigation & Guards
**Estimated Effort**: 1 day

#### Task 10.1: Navigation Block Dialog
- [ ] Create `NavigationBlockDialog.tsx` component
- [ ] Show when navigating away with unsaved changes
- [ ] Options: Stay, Discard and Leave, Save and Leave
- [ ] "Stay" cancels navigation
- [ ] "Discard and Leave" navigates
- [ ] "Save and Leave" opens save dialog, then navigates
- [ ] Implement route guard using wouter

**Files**:
- `client/src/components/form-builder/NavigationBlockDialog.tsx`

**Acceptance**: Warns before navigation with unsaved changes

---

#### Task 10.2: Browser Close Warning
- [ ] Add `window.beforeunload` event handler
- [ ] Show browser warning if unsaved changes
- [ ] Remove handler on save or discard
- [ ] Remove handler on component unmount

**Files**:
- `client/src/pages/FormBuilderPage.tsx`

**Acceptance**: Browser warns before close/refresh with unsaved changes

---

#### Task 10.3: Add "Edit Form" to Versions Menu
- [ ] Update `FormWizard.tsx`
- [ ] Add "Edit Form" option to version dropdown menu
- [ ] Click navigates to `/form-builder/:templateId`
- [ ] Pass template ID in URL
- [ ] Add pencil icon to menu item

**Files**:
- `client/src/pages/FormWizard.tsx`

**Acceptance**: "Edit Form" appears in menu, navigates correctly

---

### Phase 11: Undo/Redo System
**Estimated Effort**: 2 days

#### Task 11.1: Command Pattern Implementation
- [ ] Create `commands/` directory
- [ ] Create `Command` interface
- [ ] Implement commands for all mutations:
  - AddSectionCommand
  - UpdateSectionCommand
  - DeleteSectionCommand
  - ReorderSectionsCommand
  - AddFieldCommand
  - UpdateFieldCommand
  - DeleteFieldCommand
  - ReorderFieldsCommand
  - MoveFieldCommand
  - UpdateMetadataCommand
  - UpdateBylawsCommand
  - etc.
- [ ] Each command implements: execute(), undo(), description

**Files**:
- `client/src/commands/Command.ts`
- `client/src/commands/SectionCommands.ts`
- `client/src/commands/FieldCommands.ts`
- `client/src/commands/MetadataCommands.ts`

**Acceptance**: All mutation actions converted to commands

---

#### Task 11.2: History Stack Management
- [ ] Implement `executeCommand()` in HistoryStore
- [ ] Maintain history array
- [ ] Track currentIndex
- [ ] Implement `undo()` action
- [ ] Implement `redo()` action
- [ ] Implement `canUndo()` and `canRedo()` getters
- [ ] Implement `clear()` on save
- [ ] Max history: 50 actions

**Files**:
- Update `client/src/stores/historyStore.ts`

**Acceptance**: History stack works, can undo/redo

---

#### Task 11.3: Undo/Redo UI
- [ ] Create `UndoButton.tsx` component
- [ ] Create `RedoButton.tsx` component
- [ ] Add to header
- [ ] Disable when no history
- [ ] Tooltip shows action description
- [ ] Keyboard shortcuts: Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z
- [ ] Toast shows undone/redone action

**Files**:
- `client/src/components/form-builder/UndoButton.tsx`
- `client/src/components/form-builder/RedoButton.tsx`

**Acceptance**: Undo/redo buttons work with keyboard shortcuts

---

### Phase 12: Enhanced UX Features
**Estimated Effort**: 2 days

#### Task 12.1: Sidebar Search
- [ ] Create `SidebarSearch.tsx` component
- [ ] Add search input at top of sidebar
- [ ] Filter sections and fields by name
- [ ] Highlight matches in tree
- [ ] Option to hide/gray unmatched items
- [ ] Case-insensitive search
- [ ] Clear button (X icon)
- [ ] Keyboard shortcut: Cmd/Ctrl+F focuses search

**Files**:
- `client/src/components/form-builder/SidebarSearch.tsx`

**Acceptance**: Search filters sidebar tree

---

#### Task 12.2: Keyboard Shortcuts System
- [ ] Create `useKeyboardShortcuts()` hook
- [ ] Register all shortcuts
- [ ] Implement shortcuts:
  - Cmd/Ctrl+S: Save as new version
  - Cmd/Ctrl+Shift+S: Update version
  - Cmd/Ctrl+P: Toggle preview
  - Cmd/Ctrl+F: Focus search
  - Cmd/Ctrl+Z: Undo
  - Cmd/Ctrl+Shift+Z: Redo
  - Cmd/Ctrl+D: Duplicate
  - Alt+Up/Down: Reorder
  - Delete: Delete
  - Escape: Close dialog
- [ ] Prevent default browser behavior
- [ ] Show shortcuts in tooltips

**Files**:
- `client/src/hooks/useKeyboardShortcuts.ts`

**Acceptance**: All shortcuts work

---

#### Task 12.3: Shortcuts Help Dialog
- [ ] Create `ShortcutsHelpDialog.tsx` component
- [ ] Trigger with `?` key
- [ ] List all shortcuts in organized table
- [ ] Categorize: Navigation, Editing, Actions
- [ ] Show OS-specific keys (Cmd vs Ctrl)
- [ ] Link in header menu

**Files**:
- `client/src/components/form-builder/ShortcutsHelpDialog.tsx`

**Acceptance**: Help dialog shows all shortcuts

---

#### Task 12.4: Tooltips Everywhere
- [ ] Add tooltips to all icon buttons
- [ ] Include keyboard shortcuts in tooltips
- [ ] Use consistent tooltip component
- [ ] Position intelligently (avoid overflow)
- [ ] Delay: 500ms

**Files**:
- Use shadcn/ui `Tooltip` component

**Acceptance**: All buttons have helpful tooltips

---

#### Task 12.5: Loading States
- [ ] Loading spinner while fetching template
- [ ] Skeleton loaders for sections/fields
- [ ] Loading overlay during save
- [ ] Disable interactions during save
- [ ] Progress indicator for long operations

**Files**:
- Update components with loading states

**Acceptance**: Clear feedback during async operations

---

#### Task 12.6: Empty States
- [ ] Empty section placeholder
- [ ] Empty form placeholder (no sections)
- [ ] Empty properties panel (nothing selected)
- [ ] Helpful instructions in each empty state
- [ ] Call-to-action buttons

**Files**:
- Create empty state components

**Acceptance**: Empty states guide user actions

---

### Phase 13: Polish & Accessibility
**Estimated Effort**: 2 days

#### Task 13.1: ARIA Labels & Roles
- [ ] Add aria-label to all icon buttons
- [ ] Add role attributes to interactive elements
- [ ] Add aria-expanded to collapsible sections
- [ ] Add aria-selected to selected items
- [ ] Add aria-invalid to fields with errors
- [ ] Add aria-describedby for error messages

**Files**:
- Update all interactive components

**Acceptance**: Passes aXe accessibility audit

---

#### Task 13.2: Keyboard Navigation
- [ ] Tab order is logical
- [ ] All interactive elements reachable via keyboard
- [ ] Focus visible on all elements
- [ ] Enter/Space activate buttons
- [ ] Escape closes dialogs
- [ ] Arrow keys navigate lists
- [ ] Home/End jump to start/end

**Files**:
- Update components with keyboard handlers

**Acceptance**: Full keyboard accessibility

---

#### Task 13.3: Focus Management
- [ ] Focus returns to trigger after dialog close
- [ ] Focus on first field when adding new item
- [ ] Focus on error when validation fails
- [ ] Focus trap in dialogs
- [ ] Visible focus indicators

**Files**:
- Implement focus management utilities

**Acceptance**: Logical focus flow throughout

---

#### Task 13.4: Color Contrast
- [ ] All text meets WCAG AA contrast (4.5:1)
- [ ] Icon buttons have 3:1 contrast
- [ ] Error messages have high contrast
- [ ] Test in light and dark modes
- [ ] Use color + icon for status (not just color)

**Files**:
- Update component styles

**Acceptance**: Passes contrast checker

---

#### Task 13.5: Responsive Design
- [ ] Works on desktop (1920px+)
- [ ] Works on laptop (1366px)
- [ ] Works on tablet (768px)
- [ ] Sidebar collapses on tablet
- [ ] Properties panel becomes bottom sheet on mobile
- [ ] Touch-friendly targets (44px min)
- [ ] Horizontal scroll on small screens

**Files**:
- Update layouts with responsive breakpoints

**Acceptance**: Works on all screen sizes

---

#### Task 13.6: Error Boundaries
- [ ] Top-level error boundary
- [ ] Section-level error boundaries
- [ ] Graceful error messages
- [ ] "Report Issue" link
- [ ] Reset to last good state

**Files**:
- Create ErrorBoundary components

**Acceptance**: Errors handled gracefully

---

### Phase 14: Testing & Documentation
**Estimated Effort**: 2 days

#### Task 14.1: Unit Tests
- [ ] Test formBuilderStore actions
- [ ] Test historyStore undo/redo
- [ ] Test validationStore logic
- [ ] Test form schema validator
- [ ] Test utility functions
- [ ] 80%+ code coverage

**Files**:
- `*.test.ts` files for each module

**Acceptance**: All tests pass, good coverage

---

#### Task 14.2: Integration Tests
- [ ] Test complete workflows:
  - Create section → add field → configure → save
  - Edit field → validate → save
  - Reorder sections → undo → save
  - Add bylaws → preview → save
- [ ] Test error scenarios
- [ ] Test validation edge cases

**Files**:
- `*.integration.test.tsx` files

**Acceptance**: Key workflows tested end-to-end

---

#### Task 14.3: Manual Test Plan
- [ ] Document manual test cases
- [ ] Test all user stories
- [ ] Test all keyboard shortcuts
- [ ] Test all error states
- [ ] Test in different browsers
- [ ] Test on different devices

**Files**:
- `docs/form-builder-test-plan.md`

**Acceptance**: Test plan complete and executed

---

#### Task 14.4: User Documentation
- [ ] Create user guide
- [ ] Screenshot for each feature
- [ ] Step-by-step tutorials
- [ ] Keyboard shortcuts reference
- [ ] Troubleshooting section
- [ ] FAQ

**Files**:
- `docs/form-builder-user-guide.md`

**Acceptance**: Complete documentation for end users

---

#### Task 14.5: Developer Documentation
- [ ] Architecture overview
- [ ] Component hierarchy diagram
- [ ] State management guide
- [ ] Adding new field types
- [ ] Extending validation
- [ ] Command pattern guide

**Files**:
- `docs/form-builder-dev-guide.md`

**Acceptance**: Developers can extend the system

---

## Reference Architecture

### Design Patterns

#### 1. **Command Pattern** (Undo/Redo)
Every mutation is encapsulated as a Command object with `execute()` and `undo()` methods.

```typescript
interface Command {
  execute(state: FormBuilderState): void;
  undo(state: FormBuilderState): void;
  description: string;
}

class AddFieldCommand implements Command {
  constructor(
    private sectionIndex: number,
    private field: AdditionalInfoField
  ) {}

  execute(state: FormBuilderState) {
    state.schema.sections[this.sectionIndex].fields.push(this.field);
  }

  undo(state: FormBuilderState) {
    const fields = state.schema.sections[this.sectionIndex].fields;
    const index = fields.findIndex(f => f.id === this.field.id);
    fields.splice(index, 1);
  }

  get description() {
    return `Add field "${this.field.label}"`;
  }
}
```

#### 2. **Observer Pattern** (State Updates)
Zustand implements observer pattern - components subscribe to store changes.

```typescript
// Components automatically re-render when subscribed state changes
const { schema, updateField } = useFormBuilderStore();
```

#### 3. **Strategy Pattern** (Field Type Rendering)
Different rendering logic based on field type.

```typescript
const fieldRenderers = {
  text: TextFieldRenderer,
  textarea: TextareaFieldRenderer,
  select: SelectFieldRenderer,
  // ...
};

function renderField(field: AdditionalInfoField) {
  const Renderer = fieldRenderers[field.type];
  return <Renderer field={field} />;
}
```

#### 4. **Composite Pattern** (Section/Field Hierarchy)
Sections contain fields; both are draggable/editable.

```typescript
interface SectionComponent {
  render(): JSX.Element;
  canDrag: boolean;
}

interface FieldComponent {
  render(): JSX.Element;
  canDrag: boolean;
  parent: SectionComponent;
}
```

### Performance Optimizations

1. **Debounced Validation** - Validate 500ms after last change
2. **Debounced Preview Update** - Update preview 300ms after change
3. **Memoized Components** - Use React.memo for expensive renders
4. **Virtual Scrolling** - For large field lists (100+ fields)
5. **Lazy Loading** - Load properties panel components on demand
6. **Optimistic Updates** - Update UI immediately, sync async

### Security Considerations

1. **Input Sanitization** - Sanitize all user inputs
2. **XSS Prevention** - Escape HTML in labels/descriptions
3. **CSRF Protection** - Include CSRF token in save requests
4. **Rate Limiting** - Limit save frequency (1 per 5 seconds)
5. **Authorization** - Verify user has permission to edit tenant forms
6. **Audit Logging** - Log all saves with user ID and timestamp

---

## Success Metrics

### Quantitative
- **Adoption**: 80% of tenants create at least one custom form
- **Efficiency**: Average form creation time < 10 minutes
- **Error Rate**: < 5% of saves fail validation
- **Performance**: Preview updates < 300ms
- **Accessibility**: WCAG 2.1 AA compliance

### Qualitative
- **User Satisfaction**: 4.5+ stars in feedback
- **Ease of Use**: Non-technical users can create forms independently
- **Feature Completeness**: Supports 100% of AI-generated form features
- **Reliability**: Zero data loss incidents

---

## Risks & Mitigation

### Risk 1: Complexity Overwhelms Users
**Mitigation**:
- Progressive disclosure (hide advanced features)
- Contextual help tooltips
- Video tutorials
- In-app guided tours

### Risk 2: Performance Issues with Large Forms
**Mitigation**:
- Virtual scrolling for 100+ fields
- Lazy loading of panels
- Debounced updates
- Web workers for validation

### Risk 3: Data Loss from Browser Crashes
**Mitigation**:
- Auto-save drafts to localStorage every 30 seconds
- Recover from draft on reload
- Warn before closing with unsaved changes

### Risk 4: Breaking Changes to Schema
**Mitigation**:
- Schema versioning
- Migration scripts
- Backward compatibility layer
- Validation before save

---

## Future Enhancements

### Phase 15: Advanced Features (Future)
- [ ] Form templates library (save reusable sections)
- [ ] Copy fields/sections across forms
- [ ] Import/export forms as JSON
- [ ] Form analytics (which fields most used)
- [ ] A/B testing (compare form versions)
- [ ] Conditional logic (show field based on another)
- [ ] Calculated fields (auto-populate based on formula)
- [ ] Field dependencies (required if X is filled)
- [ ] Custom field types (extensibility)
- [ ] Real-time collaboration (multiple editors)
- [ ] Version diff viewer (compare versions)
- [ ] Form preview with sample data
- [ ] Accessibility checker built-in
- [ ] Form translation/localization
- [ ] Mobile app for editing

---

## Appendix

### Tech Stack Summary
- **Framework**: React 18
- **State**: Zustand
- **Drag-Drop**: @dnd-kit
- **UI**: shadcn/ui + Tailwind CSS
- **Icons**: lucide-react
- **Forms**: react-hook-form
- **Validation**: Zod (optional)
- **Testing**: Vitest + React Testing Library

### Dependencies to Install
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install zustand
npm install react-hook-form
npm install zod  # optional for validation
```

### Folder Structure
```
client/src/
├── pages/
│   └── FormBuilderPage.tsx
├── components/
│   └── form-builder/
│       ├── FormBuilderHeader.tsx
│       ├── FormBuilderLayout.tsx
│       ├── FormBuilderSidebar.tsx
│       ├── FormBuilderCanvas.tsx
│       ├── FormBuilderPropertiesPanel.tsx
│       ├── FormMetadataEditor.tsx
│       ├── EditableTitle.tsx
│       ├── EditableDescription.tsx
│       ├── SectionTree.tsx
│       ├── SectionNode.tsx
│       ├── SectionList.tsx
│       ├── EditableSection.tsx
│       ├── SectionHeader.tsx
│       ├── AddSectionButton.tsx
│       ├── DeleteSectionButton.tsx
│       ├── DuplicateSectionButton.tsx
│       ├── FieldList.tsx
│       ├── EditableField.tsx
│       ├── FieldCard.tsx
│       ├── FieldIcon.tsx
│       ├── AddFieldButton.tsx
│       ├── DeleteFieldButton.tsx
│       ├── DuplicateFieldButton.tsx
│       ├── FieldTypeSelector.tsx
│       ├── FieldConfigPanel.tsx
│       ├── FieldPropertiesEditor.tsx
│       ├── BasicFieldProperties.tsx
│       ├── OptionsListEditor.tsx
│       ├── NumberRangeInput.tsx
│       ├── TextLengthInput.tsx
│       ├── DateRangeInput.tsx
│       ├── ValidationRulesEditor.tsx
│       ├── BylawReferenceEditor.tsx
│       ├── BulletListEditor.tsx
│       ├── ScoringWeightInput.tsx
│       ├── FormSettingsEditor.tsx
│       ├── FormLevelBylawsEditor.tsx
│       ├── PrimaryBylawEditor.tsx
│       ├── AdditionalReferencesEditor.tsx
│       ├── DocumentRequirementsEditor.tsx
│       ├── DocumentRequirementItem.tsx
│       ├── ComplianceNotesEditor.tsx
│       ├── ARBProcessEditor.tsx
│       ├── LiveFormPreview.tsx
│       ├── PreviewModeToggle.tsx
│       ├── ValidationSummary.tsx
│       ├── ValidationPanel.tsx
│       ├── SaveVersionButton.tsx
│       ├── UpdateVersionButton.tsx
│       ├── DiscardButton.tsx
│       ├── UndoButton.tsx
│       ├── RedoButton.tsx
│       ├── VersionCreationDialog.tsx
│       ├── UpdateConfirmationDialog.tsx
│       ├── DiscardConfirmationDialog.tsx
│       ├── NavigationBlockDialog.tsx
│       ├── ShortcutsHelpDialog.tsx
│       ├── SidebarSearch.tsx
│       ├── DragHandle.tsx
│       └── InlineEditableText.tsx
├── stores/
│   ├── formBuilderStore.ts
│   ├── historyStore.ts
│   └── validationStore.ts
├── commands/
│   ├── Command.ts
│   ├── SectionCommands.ts
│   ├── FieldCommands.ts
│   └── MetadataCommands.ts
├── validators/
│   └── formSchemaValidator.ts
├── hooks/
│   ├── useValidation.ts
│   └── useKeyboardShortcuts.ts
└── utils/
    ├── generateFieldId.ts
    ├── deepClone.ts
    └── deepEqual.ts
```

---

**End of Feature Document**
