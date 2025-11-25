# AI Presentation Auto-Performance Feature

## Overview

The AI Presentation Auto-Performance feature allows users to generate fully automated presentations with AI-generated scripts, text-to-speech narration, and optional animated presenter avatars. This feature makes the platform unique by enabling one-click generation of professional spoken presentations.

## Features Implemented

### 1. Auto Script Generation ✅
- **Location**: `/src/app/api/generate-script/route.ts`
- **Functionality**: 
  - Reads all slide content (titles, bullet points, notes)
  - Generates natural, professional spoken scripts
  - Creates segmented scripts for each slide with estimated durations
  - Prioritizes presenter notes when available for more conversational flow

### 2. Auto Voice Presentation (TTS) ✅
- **Location**: `/src/lib/tts.ts`
- **Functionality**:
  - Uses Web Speech API for text-to-speech conversion
  - Supports multiple voice styles:
    - **Calm**: Gentle, smooth delivery
    - **Formal Academic**: Professional, business-like tone
    - **Saudi Dialect (Male)**: Arabic male voice
    - **Saudi Dialect (Female)**: Arabic female voice
    - **Casual Presentation**: Friendly, conversational style
  - Automatic voice selection based on style preference
  - Customizable rate, pitch, and volume

### 3. Presenter Video (Optional) ✅
- **Location**: `/src/components/AutoPresentation.tsx` (avatar component)
- **Functionality**:
  - Animated AI presenter avatar with:
    - Lip-sync animation (mouth movement during speech)
    - Eye blinking animation
    - Subtle body movements
    - Professional appearance
  - Toggle on/off option
  - Positioned as overlay during presentation

### 4. Auto Sync With Slides ✅
- **Location**: `/src/components/AutoPresentation.tsx`
- **Functionality**:
  - Each slide has its own audio segment
  - Automatic slide transitions when audio segment ends
  - Progress tracking and visual feedback
  - Smooth synchronization between audio and slide changes

### 5. Export Functionality ✅
- **Location**: `/src/components/ExportPresentation.tsx`
- **Functionality**:
  - **Interactive Auto-Presentation**: Generate shareable URL for online presentation
  - **Audio + Slides Package**: Download JSON manifest with script and slide data
  - **Video Export**: Placeholder for future server-side video generation
  - Export modal with clear options and progress tracking

## User Interface

### Auto-Presentation Controls
- Voice style selector dropdown
- AI Presenter toggle checkbox
- Play/Pause/Stop buttons
- Progress bar showing current slide and total duration
- Export button (enabled after script generation)

### Integration
- Integrated into the existing `/present` page
- Appears as a floating control panel at the bottom of the screen
- Non-intrusive design that doesn't interfere with slide viewing

## Technical Implementation

### API Routes
1. **`/api/generate-script`** (POST)
   - Accepts array of slides
   - Returns full script and segmented scripts with timing
   - Handles HTML content extraction
   - Estimates speaking duration

### Components
1. **`AutoPresentation`**: Main component for auto-presentation controls
2. **`ExportPresentation`**: Modal for export options
3. **TTS Utilities**: Text-to-speech helper functions

### Dependencies
- Uses native Web Speech API (no external dependencies required)
- Compatible with all modern browsers
- Falls back gracefully if TTS is not supported

## Usage

1. Navigate to a presentation in presentation mode (`/present?presentationId=...`)
2. The Auto-Presentation panel appears at the bottom
3. Select desired voice style
4. Optionally enable AI Presenter avatar
5. Click "Start Auto-Presentation"
6. The system will:
   - Generate scripts from slide content
   - Begin speaking and automatically advance slides
   - Show progress and current slide information
7. Use Export button to save/share the presentation

## Future Enhancements

### Potential Improvements
1. **Enhanced Script Generation**:
   - Integration with OpenAI/Claude for more natural scripts
   - Context-aware script generation
   - Custom script templates

2. **Advanced TTS**:
   - Integration with premium TTS services (Google Cloud TTS, Amazon Polly, Azure TTS)
   - Higher quality voices
   - Better Arabic/Saudi dialect support

3. **Video Export**:
   - Server-side video generation using FFmpeg
   - Combine slide images with audio tracks
   - Add transitions and effects
   - Include presenter avatar in video

4. **Enhanced Presenter Avatar**:
   - User face matching using face recognition
   - More realistic animations
   - Gesture support
   - Customizable appearance

5. **Advanced Features**:
   - Custom timing per slide
   - Pause points for questions
   - Interactive Q&A mode
   - Multi-language support

## Browser Compatibility

- **Chrome/Edge**: Full support (best TTS quality)
- **Firefox**: Full support
- **Safari**: Full support (may have limited voice options)
- **Mobile browsers**: Supported with some limitations

## Notes

- The Web Speech API is free and doesn't require API keys
- For production use, consider integrating premium TTS services for better quality
- Video export requires server-side processing (not yet implemented)
- The presenter avatar is a basic implementation and can be enhanced with libraries like Three.js or ready-made avatar solutions

## Files Created/Modified

### New Files
- `/src/app/api/generate-script/route.ts`
- `/src/lib/tts.ts`
- `/src/components/AutoPresentation.tsx`
- `/src/components/AutoPresentation.module.css`
- `/src/components/ExportPresentation.tsx`
- `/src/components/ExportPresentation.module.css`

### Modified Files
- `/src/app/present/page.tsx` (added AutoPresentation component)

