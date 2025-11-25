import { NextRequest, NextResponse } from "next/server";

type SlideContent = {
  title: string;
  content: string;
  notes: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slides } = body;

    if (!slides) {
      return NextResponse.json({ success: false, error: "Slides data is missing from request" }, { status: 400 });
    }

    if (!Array.isArray(slides)) {
      return NextResponse.json({ success: false, error: "Slides must be an array" }, { status: 400 });
    }

    if (slides.length === 0) {
      return NextResponse.json({ success: false, error: "Cannot generate script: No slides provided" }, { status: 400 });
    }

    // Generate a natural, professional script from slide content
    const scriptSegments: Array<{ slideIndex: number; script: string; estimatedDuration: number; pauseAfter?: number }> = [];

    // Helper function to clean and extract text
    const extractText = (html: string): string => {
      return html
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();
    };

    // Helper function to create natural sentences
    const createNaturalSentences = (text: string): string[] => {
      if (!text) return [];
      
      // Split by sentence endings, but preserve them
      const sentences = text
        .split(/([.!?]+)/)
        .filter(Boolean)
        .reduce((acc: string[], curr, idx, arr) => {
          if (idx % 2 === 0) {
            const sentence = curr.trim();
            const punctuation = arr[idx + 1] || "";
            if (sentence.length > 5) {
              acc.push(sentence + punctuation);
            }
          }
          return acc;
        }, [])
        .filter((s) => s.length > 10 && s.length < 250);

      return sentences.length > 0 ? sentences : [text];
    };

    // Helper function to add natural pauses
    const addPauses = (text: string): string => {
      // Add pauses after commas, semicolons, and periods
      return text
        .replace(/,/g, ", ... ")
        .replace(/;/g, "; ... ")
        .replace(/\. /g, ". ... ");
    };

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i] as SlideContent;
      const title = extractText(slide.title || "");
      const content = extractText(slide.content || "");
      const notes = extractText(slide.notes || "");

      // Prioritize: notes > content > title for main content
      const primaryContent = notes || content || "";
      const hasContent = title || primaryContent;

      if (!hasContent) {
        scriptSegments.push({
          slideIndex: i,
          script: `This is slide ${i + 1} of our presentation.`,
          estimatedDuration: 3,
        });
        continue;
      }

      // Build natural, structured script
      let script = "";

      // Opening: Introduce the slide naturally
      if (i === 0) {
        script += "Welcome to this presentation. ";
      } else if (i === 1) {
        script += "Let's continue with our next topic. ";
      } else {
        const transitions = [
          "Moving forward, ",
          "Next, we'll explore ",
          "Now, let's turn our attention to ",
          "Another important point is ",
        ];
        script += transitions[i % transitions.length];
      }

      // Introduce the title naturally
      if (title) {
        if (i > 0) {
          script += `we'll discuss ${title}. `;
        } else {
          script += `Today, we're going to explore ${title}. `;
        }
      }

      // Process main content into natural speech
      if (primaryContent) {
        const sentences = createNaturalSentences(primaryContent);
        
        if (sentences.length > 0) {
          // Use first 3-4 sentences for natural flow
          const mainSentences = sentences.slice(0, 4);
          
          // Connect sentences naturally
          for (let j = 0; j < mainSentences.length; j++) {
            const sentence = mainSentences[j].trim();
            if (j === 0) {
              script += sentence;
            } else if (j === 1) {
              script += ` ${sentence}`;
            } else {
              // Add connecting words for flow
              const connectors = ["Furthermore,", "Additionally,", "Moreover,", "It's also important to note that"];
              const connector = connectors[j % connectors.length];
              script += ` ${connector} ${sentence}`;
            }
            
            // Add pause after each sentence except the last
            if (j < mainSentences.length - 1) {
              script += " ... ";
            }
          }

          // If there are more points, summarize them
          if (sentences.length > 4) {
            script += ` We'll also cover ${sentences.length - 4} additional key points.`;
          }
        }
      } else if (title) {
        // If only title exists, expand it naturally
        script += `This slide focuses on ${title}, which is an important aspect of our discussion.`;
      }

      // Add natural closing transition
      if (i < slides.length - 1) {
        const closings = [
          " ... Now, let's proceed to the next slide.",
          " ... With that covered, let's move forward.",
          " ... This brings us to our next topic.",
        ];
        script += closings[i % closings.length];
      } else {
        script += " ... That concludes our presentation. Thank you for your attention, and I'm happy to answer any questions.";
      }

      // Clean up the script - remove pause markers (handled by TTS provider)
      script = script
        .replace(/\s+/g, " ")
        .replace(/\.\.\.\s*\.\.\./g, "...") // Remove double pauses
        .replace(/\.\.\./g, " ... ") // Keep natural pause markers
        .trim();

      // Estimate duration (average speaking rate: ~140 words per minute for natural pace)
      const wordCount = script.split(/\s+/).length;
      // Add extra time for pauses (each "..." adds ~0.5 seconds)
      const pauseCount = (script.match(/\.\.\./g) || []).length;
      const estimatedDuration = Math.max(4, Math.ceil((wordCount / 140) * 60) + pauseCount * 0.5);

      scriptSegments.push({
        slideIndex: i,
        script,
        estimatedDuration: Math.round(estimatedDuration),
        pauseAfter: i < slides.length - 1 ? 0.5 : 0, // Small pause before next slide
      });
    }

    // Combine all segments into a full script
    const fullScript = scriptSegments.map((seg) => seg.script).join(" ");

    return NextResponse.json({
      success: true,
      fullScript,
      segments: scriptSegments,
      totalEstimatedDuration: scriptSegments.reduce((sum, seg) => sum + seg.estimatedDuration, 0),
    });
  } catch (error) {
    console.error("Script generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { success: false, error: `Failed to generate script: ${errorMessage}` },
      { status: 500 }
    );
  }
}

