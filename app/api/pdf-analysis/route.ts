import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export async function POST(request: NextRequest) {
  try {
    const { aiAnswer, pdfText } = await request.json();

    if (!aiAnswer || !pdfText) {
      return NextResponse.json(
        { error: "aiAnswer and pdfText are required" },
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

    

    const result = await generateText({
      model: anthropic("claude-3-haiku-20240307"),
      messages: [
        {
          role: "user",
          content: `Find the most relevant short phrase from the PDF that matches the AI answer's MAIN TOPIC. Focus on the primary subject being discussed, not secondary mentions.

AI ANSWER:
"${aiAnswer}"

PDF TEXT:
"${pdfText}"

TASK:
1. First, identify the PRIMARY TOPIC the AI answer is discussing (e.g., "syntax rules", "data types", "functions", etc.)
2. Then find a SHORT 5-15 word phrase from the PDF text that relates to that MAIN TOPIC
3. Ignore secondary or incidental mentions of other topics

PRIORITY RULES:
- PRIORITIZE main body content over appendix/reference mentions
- Look for actual instructional content, not just references to other sections
- Choose substantive content that directly addresses the topic
- Avoid phrases that just mention "see appendix" or "refer to section X"

EXTRACTION RULES:
- Extract ONLY exact text from the PDF text above - do not paraphrase or rewrite
- 5-15 words maximum
- Must be word-for-word exact text that appears in the PDF
- Return the most relevant phrase about the same topic
- Copy the text exactly as written in the PDF, including punctuation
- Strictly output just the phrase with NO additional commentary
- Do NOT wrap in quotes
- If no relevant phrase exists, return exactly: NO_MATCH

EXAMPLES:
AI discusses input devices → Return exact PDF text: "keyboard and mouse are input devices" (NOT "see appendix for input device info")
AI discusses assembly language → Return exact PDF text: "assembly language uses symbolic names"
AI discusses Python installation → Return exact PDF text: "download Python from python.org and run installer" (NOT "Appendix A has installation instructions")

Return only the EXACT PDF phrase (word-for-word as it appears in the PDF). Output must be either the phrase itself (no quotes) or NO_MATCH.`,
        },
      ],
      temperature: 0.1,
    });

    let aiResponse = result.text.trim();

    // Basic normalization helpers
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const inPdf = (candidate: string) => normalize(pdfText).includes(normalize(candidate));

    // If the model ignored formatting, try to extract a quoted phrase
    if (aiResponse !== "NO_MATCH" && !inPdf(aiResponse)) {
      const quoted = aiResponse.match(/"([^"]{5,200})"/);
      if (quoted && inPdf(quoted[1])) {
        aiResponse = quoted[1].trim();
      }
    }

    // Final guard: ensure the chosen phrase exists inside pdfText
    if (aiResponse === "NO_MATCH" || aiResponse.length < 5 || !inPdf(aiResponse)) {
      return NextResponse.json({
        matchedText: null,
        reasoning: "No relevant phrase found in PDF or AI output not present in PDF",
      });
    }

    

    return NextResponse.json({
      matchedText: aiResponse,
      reasoning: "AI successfully found matching PDF phrase",
    });

  } catch (error) {
    console.error("PDF analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze PDF content" },
      { status: 500 }
    );
  }
}
