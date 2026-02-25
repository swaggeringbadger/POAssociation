# Form Generation User Prompt

Generate a custom form for "{APPLICATION_TYPE}" applications based on these design guidelines:

## Design Guidelines

{DESIGN_GUIDELINES_CONTENT}

---

## CRITICAL LOT TYPE EXTRACTION INSTRUCTIONS

**IMPORTANT: DO NOT HALLUCINATE OR INVENT LOT TYPES. Only extract lot types explicitly mentioned or clearly defined in the provided design guidelines.**

When processing these guidelines, search for and extract ONLY the following lot classification information that is ACTUALLY PRESENT in the document:

### Lot Type Categories to Search For (Extract ONLY if found in guidelines)

1. **Size/Width Classifications**: Search for any lot categorization based on dimensions ACTUALLY MENTIONED (e.g., width in feet, square footage tiers, "estate lots," "villa lots")

2. **Physical Location Types**: Search for lots by their position relative to features ACTUALLY MENTIONED:
   - Water features (lakefront, pond-view, waterfront, canal-front)
   - Streets (corner lots, cul-de-sac, interior, through lots)
   - Natural areas (conservation-adjacent, preserve-view, greenbelt)
   - Community amenities (golf course, clubhouse-adjacent, park-adjacent)

3. **Configuration Types**: Search for classifications based on lot shape/access ACTUALLY MENTIONED:
   - Flag/pipe-stem lots, Pie-shaped/wedge lots, Double-frontage lots, Zero lot line, Terminal vista lots

4. **Development Categories**: Search for phase or builder-specific classifications ACTUALLY MENTIONED:
   - Type A/B/C designations, Phase-specific categories, Builder model designations

5. **Special Conditions/Overlays**: Search for any additional classifications ACTUALLY MENTIONED that modify standard rules:
   - Architectural control zones, Setback variations, Height restriction areas, View corridors

### Key Phrases to Search For

- "lot type," "lot classification," "lot category"
- "feet wide," "ft width," "square footage"
- "corner," "interior," "flag," "cul-de-sac"
- "lakefront," "waterfront," "conservation," "preserve"
- "Type [A-Z]," "Phase," "Section"
- "Traditional," "Conventional," specific width measurements (e.g., "58 ft", "73 ft", "93 ft")

### CRITICAL RULES

- ONLY include lot types that are explicitly stated in the guidelines
- If a category is mentioned but no specific lot types are listed, DO NOT INVENT any
- If you search for lot types and find NONE, include a note/placeholder in the form
- NEVER make assumptions about what lot types might exist - only extract what is explicitly documented
- Pay close attention to PDFs and embedded documents - lot types are often in design standards PDFs

---

## General Instructions

1. **Read through the design guidelines carefully and search for ANY LOT TYPE classifications using the categories above**
   - Extract ONLY the lot types that are explicitly mentioned or defined
   - If NO lot types are found: create a placeholder field with a note that lot type information should be added later
   - Note: Lot types are CRITICAL as requirements often vary significantly by lot type - but only if they actually exist in the guidelines

2. **Identify all requirements, restrictions, and approval processes relevant to {APPLICATION_TYPE}**
   - Pay special attention to requirements that differ by lot type
   - Note setback requirements, height restrictions, material allowances that vary by lot type

3. **Extract actual bylaw quotes and section references**
   - IMPORTANT: When including quotes, ALWAYS cite the specific location (page, section, article, or paragraph number)
   - Example: "All exterior modifications require ARB approval" (Section 4.2, Page 12)
   - Example: reference: "Design Guidelines Section 3.4 - Color Standards"
   - This helps homeowners find the original source material for verification
   - When requirements differ by lot type, include ALL lot type variations in the bylaw references

4. **Create form fields that collect all required information**
   - IF lot types were found in the guidelines: Include a field to capture the applicant's lot type as a dropdown (select field)
   - IF NO lot types were found: Include a text field with a placeholder and description explaining "Lot type information was not defined in the community guidelines. Please consult your property survey or contact the community office for your lot classification."
   - Only populate the dropdown with lot types that you actually found in the guidelines
   - Use appropriate field types (select/radio) to let users choose their lot type
   - Make lot type an early field if requirements depend on it

5. **Include relevant bylaw references for each field where applicable**
   - Always include the specific section/article/page reference in the "reference" field
   - Only create lot-type-specific requirements if actual lot types exist in the guidelines
   - Example structure for lot-type-specific requirements (IF lot types exist):
     ```json
     {
       "reference": "Section 4.2 - Setback Requirements",
       "requirement": "Setback requirements vary by lot type",
       "requirements": [
         "Corner lots: 25ft front, 20ft side (Section 4.2.1)",
         "Interior lots: 20ft front, 10ft side (Section 4.2.2)",
         "Waterfront lots: 30ft from water, 20ft other sides (Section 4.2.3)"
       ],
       "note": "Verify your lot type with the property survey before proceeding"
     }
     ```

6. **Organize fields into logical sections**
   - Create a dedicated "Property Information" section as the first section
   - Include lot type field (either dropdown if found, or text with note if not found) in this section

7. **Create appropriate field types and options based on what you found**
   - IF lot types found: Use a select dropdown with only the lot types that exist in the guidelines
   - IF NO lot types found: Use a text input with clear description that lot types weren't defined
   - NEVER invent lot type options - populate dropdown ONLY with what you found

8. **Set scoring weights based on field importance**
   - Lot type field should have high weight if it actually affects other requirements
   - If lot types were not found, the field weight can be lower

9. **List all required documents mentioned in the guidelines**
   - Include property survey as a required document only if it's explicitly needed for lot type verification
   - If lot types weren't found in guidelines, still mention survey in case the community uses it

10. **Include compliance notes with critical reminders**
    - IF lot types were found: Add reminders about lot-type-specific requirements
    - IF lot types were NOT found: Add note explaining that the community guidelines did not specify distinct lot type classifications
    - NEVER make up reminders about lot types that don't exist

---

Generate the complete JSON form configuration now:
