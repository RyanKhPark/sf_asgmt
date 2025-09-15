import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";


export async function POST(request: NextRequest) {
  try {
    const { aiMatchedPhrase, pdfText } = await request.json();

    if (!aiMatchedPhrase || !pdfText) {
      return NextResponse.json(
        { error: "aiMatchedPhrase and pdfText are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    console.log(`🔍 AI finding exact location for: "${aiMatchedPhrase}"`);

    const result = await generateText({
      model: anthropic("claude-3-haiku-20240307"),
      messages: [
        {
          role: "user",
          content: `Find the exact location and actual text content from the PDF that relates to the matched phrase. PRIORITIZE main instructional content over appendix references.

MATCHED PHRASE (from previous AI analysis):
"${aiMatchedPhrase}"

FULL PDF TEXT WITH PAGE NUMBERS:
${pdfText}

TASK:
1. Find which page contains the BEST content related to the matched phrase
2. Extract the ACTUAL text from that page (20-40 words) that contains the relevant information
3. Return the page number and the actual PDF text

PRIORITY RULES:
- PRIORITIZE main body content that directly explains or teaches the topic
- Look for actual instructions, explanations, or substantive content
- AVOID appendix references, "see section X" mentions, or table of contents entries
- Choose content that would be most helpful to someone learning the topic

EXTRACTION RULES:
- Look for content semantically related to the matched phrase
- Extract the actual text as it appears in the PDF (preserve original wording)
- Choose a 20-40 word excerpt that contains the core information
- Return page number as integer
- Prefer pages with substantial content over brief mentions

RESPONSE FORMAT:
Page: [page_number]
Text: [exact_pdf_text_excerpt_word_for_word]

IMPORTANT: The "Text" must be the EXACT text as it appears in the PDF, word-for-word, so it can be found and highlighted in the PDF viewer. Do not paraphrase or rewrite - copy the exact text.

If no relevant content found, respond with:
Page: 0
Text: NO_MATCH`,
        },
      ],
      temperature: 0.1,
    });

    const aiResponse = result.text.trim();
    console.log(`🤖 AI location response: "${aiResponse}"`);

    // Best-effort parse of AI response, but do not early-return on failure
    const pageMatch = aiResponse.match(/Page:\s*(\d+)/);
    const textMatch = aiResponse.match(/Text:\s*([\s\S]+)/);
    const hintedPage = pageMatch ? parseInt(pageMatch[1]) : null;
    const hintedText = textMatch ? textMatch[1].trim() : null;

    if (hintedPage && hintedText && hintedText !== "NO_MATCH") {
      console.log(`🔍 AI hints page ${hintedPage} with text: "${hintedText}"`);
    } else {
      console.log("ℹ️ AI location hint unavailable or unusable; falling back to deterministic search");
    }

    // DIRECT APPROACH: Search for the exact text that the analysis API found
    console.log(`🔎 Searching for exact text that analysis API found: "${aiMatchedPhrase}"`);

    // Clean the AI matched phrase to get the actual PDF text (remove AI analysis wrapper)
    let cleanedPhrase = aiMatchedPhrase;

    // Extract actual PDF text from AI response if it's wrapped
    const quotedMatch = aiMatchedPhrase.match(/"([^"]+)"/);
    if (quotedMatch) {
      cleanedPhrase = quotedMatch[1];
      console.log(`📝 Extracted quoted text: "${cleanedPhrase}"`);
    }

    // Determine how many pages are in the provided text by scanning "Page N:" markers
    const pageMarkers = Array.from(pdfText.matchAll(/\bPage\s+(\d+):/g)).map(m => parseInt(m[1]));
    const maxPage = pageMarkers.length > 0 ? Math.max(...pageMarkers) : 20; // fallback cap

    // Helper to search a specific page index
    const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const searchPage = (i: number, phrase: string) => {
      const pagePattern = new RegExp(`Page ${i}:(.*?)(?=Page ${i + 1}:|$)`, 's');
      const pm = pdfText.match(pagePattern);
      if (!pm) return null;
      const pageContent = pm[1];
      const normalizedPageContent = normalize(pageContent);
      const normalizedPhrase = normalize(phrase);

      if (normalizedPhrase && normalizedPageContent.includes(normalizedPhrase)) {
        return { pageNumber: i, text: phrase, reason: `Found exact text match on page ${i}` };
      }

      const phraseWords = normalizedPhrase.split(/\s+/).filter((w: string) => w.length > 2);
      const matchingWords = phraseWords.filter((word: string) => normalizedPageContent.includes(word));
      if (matchingWords.length >= Math.max(2, Math.ceil(phraseWords.length * 0.5))) {
        const sentences = pageContent.split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
        for (const sentence of sentences) {
          const normalizedSentence = normalize(sentence);
          const sentenceMatches = phraseWords.filter((word: string) => normalizedSentence.includes(word));
          if (sentenceMatches.length >= Math.max(2, Math.ceil(phraseWords.length * 0.5))) {
            return { pageNumber: i, text: sentence.trim(), reason: `Found related content on page ${i} (${sentenceMatches.length}/${phraseWords.length} words matched)` };
          }
        }
      }
      return null;
    };

    // First try the AI-hinted page/text if available
    if (hintedPage && hintedText && hintedText !== "NO_MATCH") {
      const hintedResult = searchPage(hintedPage, hintedText);
      if (hintedResult) {
        return NextResponse.json({
          pageNumber: hintedResult.pageNumber,
          actualText: hintedResult.text,
          reasoning: hintedResult.reason,
        });
      }
    }

    // Search page by page for the cleaned phrase
    for (let i = 1; i <= maxPage; i++) {
      const res = searchPage(i, cleanedPhrase);
      if (res) {
        console.log(`✅ ${res.reason}: "${res.text}"`);
        return NextResponse.json({
          pageNumber: res.pageNumber,
          actualText: res.text,
          reasoning: res.reason,
        });
      }
    }

    console.log(`❌ Could not find the analyzed text in PDF`);
    return NextResponse.json({
      pageNumber: null,
      actualText: null,
      reasoning: "Could not locate the analyzed text in the PDF",
    });


  } catch (error) {
    console.error("PDF location analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze PDF location" },
      { status: 500 }
    );
  }
}
