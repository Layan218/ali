/**
 * Local AI Generator - Pure TypeScript slide generation without external APIs
 * Generates business-style slide titles and bullet points based on a topic
 */

export interface GeneratedSlide {
  title: string;
  bullets: string[];
}

const SLIDE_TEMPLATES = [
  { title: "Introduction to {topic}", bullets: ["Overview of {topic}", "Key concepts and definitions", "Importance in today's context", "Scope and objectives"] },
  { title: "Objectives of {topic}", bullets: ["Primary goals and targets", "Expected outcomes", "Success criteria", "Strategic alignment"] },
  { title: "Current State Analysis", bullets: ["Existing processes and systems", "Current challenges and gaps", "Performance metrics", "Stakeholder perspectives"] },
  { title: "Implementation Plan for {topic}", bullets: ["Phase 1: Planning and preparation", "Phase 2: Development and testing", "Phase 3: Deployment and rollout", "Phase 4: Monitoring and optimization"] },
  { title: "Benefits and Impact of {topic}", bullets: ["Improved efficiency and productivity", "Cost savings and ROI", "Enhanced user experience", "Competitive advantages"] },
  { title: "Risks and Mitigations for {topic}", bullets: ["Identified risks and challenges", "Mitigation strategies", "Contingency plans", "Risk monitoring approach"] },
  { title: "Timeline and Milestones", bullets: ["Key milestones and deliverables", "Critical path activities", "Resource allocation", "Dependencies and constraints"] },
  { title: "Resource Requirements", bullets: ["Human resources and skills needed", "Technology and infrastructure", "Budget and financial planning", "External dependencies"] },
  { title: "Stakeholder Engagement", bullets: ["Key stakeholders and their roles", "Communication strategy", "Change management approach", "Feedback and collaboration"] },
  { title: "Success Metrics and KPIs", bullets: ["Performance indicators", "Measurement methodology", "Reporting framework", "Continuous improvement"] },
  { title: "Next Steps and Recommendations", bullets: ["Immediate action items", "Short-term priorities", "Long-term strategic direction", "Decision points and approvals"] },
  { title: "Conclusion and Summary", bullets: ["Key takeaways", "Main achievements", "Future outlook", "Call to action"] },
];

const VARIATIONS = [
  { prefix: "Advanced", suffix: "Strategies" },
  { prefix: "Best Practices for", suffix: "" },
  { prefix: "Future of", suffix: "" },
  { prefix: "Challenges in", suffix: "" },
  { prefix: "Opportunities in", suffix: "" },
];

/**
 * Generate slides locally without any external API calls
 * @param topic - The main topic for the presentation
 * @param slideCount - Number of slides to generate (1-15)
 * @returns Array of generated slides with titles and bullet points
 */
export function generateLocalSlides(topic: string, slideCount: number): GeneratedSlide[] {
  if (!topic || topic.trim().length === 0) {
    throw new Error("Topic cannot be empty");
  }

  if (slideCount < 1 || slideCount > 15) {
    throw new Error("Slide count must be between 1 and 15");
  }

  const normalizedTopic = topic.trim();
  const slides: GeneratedSlide[] = [];

  // Always start with introduction
  slides.push({
    title: SLIDE_TEMPLATES[0].title.replace("{topic}", normalizedTopic),
    bullets: SLIDE_TEMPLATES[0].bullets.map(b => b.replace("{topic}", normalizedTopic)),
  });

  // Add objectives if more than 1 slide
  if (slideCount > 1) {
    slides.push({
      title: SLIDE_TEMPLATES[1].title.replace("{topic}", normalizedTopic),
      bullets: SLIDE_TEMPLATES[1].bullets.map(b => b.replace("{topic}", normalizedTopic)),
    });
  }

  // Fill remaining slides with templates, varying them
  for (let i = 2; i < slideCount; i++) {
    const templateIndex = (i - 2) % (SLIDE_TEMPLATES.length - 2) + 2; // Skip intro and objectives
    const template = SLIDE_TEMPLATES[templateIndex];
    const variationIndex = Math.floor((i - 2) / (SLIDE_TEMPLATES.length - 2)) % VARIATIONS.length;
    const variation = VARIATIONS[variationIndex];

    let title = template.title.replace("{topic}", normalizedTopic);
    
    // Apply variations to make titles more diverse
    if (variation.prefix && i > 3) {
      title = `${variation.prefix} ${title}`;
    }
    if (variation.suffix && i > 5) {
      title = `${title} ${variation.suffix}`;
    }

    // Vary bullets slightly
    const bullets = template.bullets.map((bullet, idx) => {
      let varied = bullet.replace("{topic}", normalizedTopic);
      // Add slight variations
      if (idx === 0 && i > 4) {
        varied = varied.replace("Key", "Critical");
      }
      if (idx === 1 && i > 6) {
        varied = varied.replace("and", "&");
      }
      return varied;
    });

    slides.push({ title, bullets });
  }

  return slides;
}




