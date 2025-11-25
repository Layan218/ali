# SCDT Theme Implementation Plan

This file documents the changes needed to implement the SCDT theme.

## Files to modify:
1. src/lib/presentationThemes.ts - Update theme definitions
2. src/app/editor/[id]/page.tsx - Update slide rendering logic
3. src/app/editor/[id]/editor.module.css - Add SCDT styles
4. src/components/EditorToolbar.tsx - Add slide type selector

## Implementation steps:
1. Replace Digital Solutions theme with SCDT theme
2. Add slideType field to SlideData
3. Implement three slide layouts:
   - Cover: Full background image, title/subtitle/date at top-left
   - Content: Left image, right white area with text, footer at bottom
   - Ending: Full white background, centered content
4. Add slide type selector in toolbar
5. Update CSS for all three layouts

