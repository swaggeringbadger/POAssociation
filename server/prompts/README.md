# AI Form Generation Prompts

This folder contains the prompt templates used for AI-powered form generation.

## Files

### system-prompt.md
The system prompt that defines Claude's role and the structure requirements for generated forms.

**Placeholders:**
- `{APPLICATION_TYPE}` - The type of application (e.g., "exterior-modifications", "landscaping")
- `{REFERENCE_ARCHITECTURE}` - The complete reference architecture documentation
- `{EXAMPLE_FORM}` - An example form JSON for reference

### user-prompt.md
The user prompt that instructs Claude how to process the design guidelines and extract lot types.

**Placeholders:**
- `{APPLICATION_TYPE}` - The type of application
- `{DESIGN_GUIDELINES_CONTENT}` - The actual design guidelines content (only used for HTML/text, not PDFs)

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

## Editing Prompts

You can edit these prompts directly without modifying code:
1. Edit the `.md` files in this folder
2. Save your changes
3. Restart the server (or let it hot-reload if watching)
4. New form generations will use the updated prompts

## Testing Changes

To test prompt changes:
1. Edit the prompt files
2. Go to the Form Wizard page
3. Generate a new form for a test application type
4. Review the generated form to see if your changes had the desired effect

## Important Notes

- The prompts emphasize NOT inventing lot types - only extracting what's explicitly in the guidelines
- Lot types are critical for communities like Markland POA where requirements vary significantly by lot type
- Always include specific section/page references when citing bylaws
- The system is designed to handle both communities with defined lot types AND those without
