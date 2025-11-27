# Form Generation Service - PDF Support & Prompt Externalization

## Changes Made

### 1. Prompt Externalization ✅
Moved prompts from code into editable markdown files for easier maintenance and iteration.

**New Files:**
- `server/prompts/system-prompt.md` - Defines Claude's role and output structure
- `server/prompts/user-prompt.md` - Instructions for processing design guidelines
- `server/prompts/README.md` - Documentation for the prompts folder

**Benefits:**
- Edit prompts without touching code
- Version control for prompt changes
- Easier A/B testing of prompt variations
- Better readability and collaboration

### 2. Native PDF Support ✅
Added support for reading PDF design guidelines using Anthropic's document API.

**How It Works:**
1. Service detects if URL is a PDF (by content-type or `.pdf` extension)
2. Downloads PDF as binary buffer
3. Sends PDF to Claude as a base64-encoded document source
4. Claude natively reads and analyzes the PDF content (including scanned/image PDFs via OCR)

**Code Changes:**
- `fetchDesignGuidelines()` now returns `{ type, content, mediaType }`
- `callAnthropicAPI()` accepts PDF data and constructs appropriate message format
- For PDFs: sends as `document` source block
- For HTML: inserts text into user prompt

### 3. Improved Lot Type Detection
The prompts now emphasize:
- Only extracting lot types that are explicitly mentioned in guidelines
- Not inventing or hallucinating lot types
- Creating placeholder fields if no lot types are found
- Including specific section/page references for all bylaw quotes

## Testing

### Test URL (Markland Design Guidelines PDF):
```
https://markland.com/wp-content/uploads/Guidelines-R2.21-1.pdf
```

This PDF contains the specific lot types like:
- "Traditional Type 1 Lot (58 ft width with rear garage access)"
- "Traditional Type 2 Lot (73 ft width with rear garage)"
- "Conventional Lot - 93 ft Width", 83 ft, 73 ft, 63 ft
- Lakefront, Back to Back, Conservation, Corner lots

### To Test:
1. Go to Form Wizard page
2. Select "Exterior Modifications" or "Structural Changes"
3. Enter Markland PDF URL as design guidelines
4. Click "Generate with AI"
5. Check if generated form includes the specific lot types from the PDF

### Expected Result:
The form should now include a dropdown field with the actual Markland lot types, not generic placeholders.

## Troubleshooting

If lot types are still not being detected:

1. **Check the logs** - Look for:
   - "Detected PDF document, will send to Claude as document source"
   - "Sending PDF document to Claude for analysis"

2. **Verify PDF is being fetched** - The PDF should be downloaded and sent to Claude, not the HTML page

3. **Review the generated form** - Look for the `lot_type_classification` field
   - If it's a text field with "not defined" message → PDF wasn't read
   - If it's a select field with specific lot types → Success!

4. **Check API key** - Ensure `ANTHROPIC_API_KEY` is set in environment

5. **Review prompts** - Edit `server/prompts/user-prompt.md` to adjust instructions

## Next Steps

1. Test with Markland PDF URL
2. If successful, test with other community PDFs
3. Iterate on prompts as needed
4. Consider adding support for multi-document URLs (e.g., main page + linked PDFs)
5. Add caching for frequently-used PDFs

## Cost Considerations

- PDF processing uses more input tokens than plain text
- Scanned PDFs (images) use vision tokens which are more expensive
- For large PDFs, consider extracting only relevant sections
- Monitor token usage in AI Activity dashboard

## Prompt Editing Workflow

To improve lot type extraction:

1. Edit `server/prompts/user-prompt.md`
2. Adjust the "Key Phrases to Search For" section
3. Modify the extraction instructions
4. Save and restart server
5. Generate a test form
6. Review results and iterate

Example additions to search phrases:
- "width in feet"
- "square footage minimum/maximum"
- "lot category"
- Community-specific terms
