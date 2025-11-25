/**
 * Simple test script for AI Presentation Service
 * 
 * This file can be run to test the service independently.
 * Usage: Import and call testAIService() from a page or component temporarily.
 */

import { generatePresentation, type AIPresentationRequest } from "../aiPresentationService";

/**
 * Test function to verify AI service works correctly
 * Call this from a component or page to test
 */
export async function testAIService() {
  console.log("=".repeat(60));
  console.log("🧪 Testing AI Presentation Service");
  console.log("=".repeat(60));

  const testCases: Array<{ name: string; request: AIPresentationRequest }> = [
    {
      name: "Basic Test - Technology Topic",
      request: {
        topic: "Digital Transformation",
        goal: "Inform",
        audience: "Executives",
        tone: "formal",
        language: "en",
        slideCount: 6,
      },
    },
    {
      name: "Persuasive Presentation",
      request: {
        topic: "Cloud Migration Strategy",
        goal: "Persuade",
        audience: "Management Team",
        tone: "formal",
        language: "en",
        slideCount: 8,
      },
    },
    {
      name: "Training Presentation",
      request: {
        topic: "Project Management Fundamentals",
        goal: "Train",
        audience: "Team Members",
        tone: "friendly",
        language: "en",
        slideCount: 10,
      },
    },
    {
      name: "Technical Deep Dive",
      request: {
        topic: "Machine Learning Architecture",
        goal: "Inform",
        audience: "Technical Team",
        tone: "technical",
        language: "en",
        slideCount: 5,
      },
    },
  ];

  for (const testCase of testCases) {
    console.log("\n" + "-".repeat(60));
    console.log(`📋 Test: ${testCase.name}`);
    console.log("-".repeat(60));
    console.log("Input:", JSON.stringify(testCase.request, null, 2));

    try {
      const slides = await generatePresentation(testCase.request, (progress) => {
        console.log(`  ⏳ ${progress.message}`);
      });

      console.log(`\n✅ Success! Generated ${slides.length} slides:\n`);

      slides.forEach((slide, index) => {
        console.log(`  Slide ${index + 1}: ${slide.title}`);
        if (slide.bullets.length > 0) {
          slide.bullets.forEach((bullet, i) => {
            console.log(`    ${i + 1}. ${bullet}`);
          });
        }
        if (slide.notes) {
          console.log(`    📝 Notes: ${slide.notes}`);
        }
        console.log(`    📐 Layout: ${slide.layout || "title-bullets"}`);
        console.log("");
      });

      // Validation
      if (slides.length !== testCase.request.slideCount) {
        console.warn(`  ⚠️  Warning: Expected ${testCase.request.slideCount} slides, got ${slides.length}`);
      }

      if (slides.length === 0) {
        console.error(`  ❌ Error: No slides generated!`);
      }

      const hasTitleSlide = slides[0]?.title && slides[0].bullets.length === 0;
      if (!hasTitleSlide) {
        console.warn(`  ⚠️  Warning: First slide should be a title slide`);
      }

    } catch (error) {
      console.error(`  ❌ Error:`, error);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Testing Complete");
  console.log("=".repeat(60));
}

/**
 * Quick test with minimal input
 */
export async function quickTest() {
  console.log("🚀 Quick Test: Generating 3 slides for 'AI in Business'...\n");

  const slides = await generatePresentation(
    {
      topic: "AI in Business",
      slideCount: 3,
    },
    (progress) => {
      console.log(`  → ${progress.message}`);
    }
  );

  console.log(`\n✅ Generated ${slides.length} slides:\n`);
  slides.forEach((slide, i) => {
    console.log(`${i + 1}. ${slide.title}`);
    if (slide.bullets.length > 0) {
      console.log(`   Bullets: ${slide.bullets.length}`);
    }
  });
}

