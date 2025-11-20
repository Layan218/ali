import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { topic, description } = await request.json();

    if (!topic && !description) {
      return NextResponse.json({ error: "Topic or description required" }, { status: 400 });
    }

    const searchQuery = (topic || description || "").trim();
    
    // Primary: Use Wikipedia API (free, reliable, no API key needed)
    try {
      // Try exact match first
      let wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchQuery)}`;
      let wikiResponse = await fetch(wikiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PresentationApp/1.0)',
        },
      });
      
      // If not found, try searching
      if (!wikiResponse.ok) {
        const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchQuery.split(/\s+/)[0])}`;
        wikiResponse = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PresentationApp/1.0)',
          },
        });
      }
      
      if (wikiResponse.ok) {
        const wikiData = await wikiResponse.json();
        const extract = wikiData.extract || wikiData.description || '';
        
        if (extract) {
          // Get full page content for more information
          let fullContent = extract;
          try {
            const pageTitle = wikiData.title || searchQuery;
            
            // Try to get full page content (plain text format)
            try {
              const contentUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(pageTitle)}`;
              const contentResponse = await fetch(contentUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; PresentationApp/1.0)',
                },
              });
              
              if (contentResponse.ok) {
                const html = await contentResponse.text();
                // Extract text from HTML - get more comprehensive content
                const textContent = html
                  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                  .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
                  .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
                  .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                
                if (textContent.length > extract.length) {
                  fullContent = extract + ' ' + textContent.substring(0, 15000); // Get up to 15k chars
                }
              }
            } catch (e) {
              // Continue with extract only
            }
              
            // Also try to get related topics for more content
            try {
              const relatedUrl = `https://en.wikipedia.org/api/rest_v1/page/related/${encodeURIComponent(pageTitle)}`;
              const relatedResponse = await fetch(relatedUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; PresentationApp/1.0)',
                },
              });
              
              if (relatedResponse.ok) {
                const relatedData = await relatedResponse.json();
                const relatedPages = relatedData.pages || [];
                
                // Get extracts from related pages (up to 5 related topics)
                for (const page of relatedPages.slice(0, 5)) {
                  try {
                    const relatedPageUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title || '')}`;
                    const relatedPageResponse = await fetch(relatedPageUrl, {
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; PresentationApp/1.0)',
                      },
                    });
                    
                    if (relatedPageResponse.ok) {
                      const relatedPageData = await relatedPageResponse.json();
                      if (relatedPageData.extract) {
                        fullContent += ' ' + relatedPageData.extract;
                      }
                    }
                  } catch (e) {
                    // Skip if related page fails
                  }
                }
              }
            } catch (e) {
              // Continue without related pages
            }
              
            // Limit total content but keep it very substantial
            if (fullContent.length > 20000) {
              fullContent = fullContent.substring(0, 20000);
            }
          } catch (e) {
            // Use extract only if full content fails
            console.error('Error fetching full content:', e);
          }
          
          // Extract sentences - get clean, well-formatted, relevant sentences
          const sentences = fullContent
            .split(/[.!?]+/)
            .map((s: string) => s.trim())
            .filter((s: string) => {
              // Filter out very short or very long sentences
              if (s.length < 25 || s.length > 100) return false;
              
              // Filter out sentences with too many special characters
              const specialCharRatio = (s.match(/[^a-zA-Z0-9\s]/g) || []).length / s.length;
              if (specialCharRatio > 0.25) return false;
              
              // Filter out sentences that are mostly numbers or special characters
              const words = s.split(/\s+/).filter(w => /[a-zA-Z]/.test(w));
              if (words.length < 6 || words.length > 25) return false;
              
              // Filter out common Wikipedia artifacts and navigation
              const artifacts = [
                'see also', 'references', 'external links', 'navigation menu',
                'edit', 'talk', 'read', 'view history', 'search', 'main page',
                'categories', 'tools', 'what links here', 'related changes',
                'jump to', 'hide', 'show', 'disambiguation', 'may refer to'
              ];
              const lowerS = s.toLowerCase();
              if (artifacts.some(artifact => lowerS.includes(artifact))) return false;
              
              // Filter out sentences that are just citations, references, or disambiguation
              if (/^\[\d+\]|^\d+\.|^\([^)]*\)$|^may refer to/i.test(s)) return false;
              
              // Filter out sentences about random people (common Wikipedia issue)
              const personPatterns = [
                /\b(born \d{4}|died \d{4}|was an? [A-Z][a-z]+ (who|that))/i,
                /\b(actor|actress|singer|musician|writer|author|politician|president|prime minister)/i
              ];
              if (personPatterns.some(pattern => pattern.test(s))) {
                // Only exclude if it's clearly about a person and not related to the topic
                const topicWords = searchQuery.toLowerCase().split(/\s+/);
                const hasTopicWord = topicWords.some((word: string) => 
                  word.length > 3 && lowerS.includes(word)
                );
                if (!hasTopicWord) return false;
              }
              
              return true;
            })
            .slice(0, 50); // Get up to 50 high-quality sentences

          // Extract key words (excluding common words and Wikipedia artifacts)
          const commonWords = new Set([
            'about', 'their', 'there', 'these', 'those', 'which', 'where', 
            'would', 'could', 'should', 'other', 'first', 'second', 'third',
            'also', 'such', 'many', 'some', 'more', 'most', 'very', 'well',
            'from', 'with', 'that', 'this', 'have', 'been', 'were', 'said',
            'wikipedia', 'article', 'section', 'page', 'edit', 'category'
          ]);
          const words = fullContent
            .toLowerCase()
            .replace(/\[.*?\]/g, '') // Remove citations
            .replace(/\(.*?\)/g, '') // Remove parentheticals
            .split(/\s+/)
            .filter((w: string) => {
              // Filter words
              if (w.length < 4 || w.length > 20) return false;
              if (commonWords.has(w)) return false;
              if (!/^[a-z]+$/.test(w)) return false; // Only alphabetic
              if (/^\d+$/.test(w)) return false; // No pure numbers
              return true;
            });

          // Count word frequency
          const wordCounts: Record<string, number> = {};
          words.forEach((word: string) => {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
          });

          const keyWords = Object.entries(wordCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 25)
            .map(([word]) => word);

          // Clean the summary
          let cleanSummary = extract
            .replace(/\[.*?\]/g, '') // Remove citations
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
          
          // Limit summary length but keep it meaningful
          if (cleanSummary.length > 1000) {
            // Try to cut at sentence boundary
            const cut = cleanSummary.substring(0, 1000);
            const lastPeriod = Math.max(
              cut.lastIndexOf('.'),
              cut.lastIndexOf('!'),
              cut.lastIndexOf('?')
            );
            if (lastPeriod > 800) {
              cleanSummary = cut.substring(0, lastPeriod + 1);
            } else {
              cleanSummary = cut + '...';
            }
          }

          return NextResponse.json({
            sentences: sentences.length > 0 ? sentences : [cleanSummary],
            keyWords: keyWords.length > 0 ? keyWords : searchQuery.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3),
            summary: cleanSummary,
            fullContent: fullContent.substring(0, 5000), // Include full content snippet
          });
        }
      }
    } catch (wikiError) {
      console.error('Wikipedia API error:', wikiError);
    }

    // Fallback: Generate structured content based on topic
    const topicWords = searchQuery.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
    const mainTopic = topicWords[0] || searchQuery;
    
    const fallbackSentences = [
      `${searchQuery} is a significant topic that encompasses various important aspects and considerations.`,
      `Understanding ${searchQuery} requires comprehensive knowledge and thorough research into its key components.`,
      `There are several critical points to consider when discussing ${searchQuery} and its implications.`,
      `The study of ${searchQuery} reveals important insights and connections to broader themes.`,
      `${searchQuery} has evolved over time and continues to be relevant in contemporary discussions.`,
      `Key factors related to ${searchQuery} include multiple perspectives and diverse viewpoints.`,
      `The impact of ${searchQuery} extends across various domains and areas of application.`,
      `Research and analysis of ${searchQuery} provide valuable information and understanding.`,
      `Important considerations about ${searchQuery} include practical applications and theoretical foundations.`,
      `The future of ${searchQuery} involves ongoing developments and emerging trends.`,
    ];

    return NextResponse.json({
      sentences: fallbackSentences,
      keyWords: topicWords.length > 0 ? topicWords : [mainTopic],
      summary: `This presentation explores ${searchQuery}, covering its key aspects, important considerations, and relevant information.`,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: "Failed to fetch information" },
      { status: 500 }
    );
  }
}

