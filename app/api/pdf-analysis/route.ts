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

    console.log(`🤖 AI analyzing answer to find essential topic in PDF...`);

    const result = await generateText({
      model: anthropic("claude-3-haiku-20240307"),
      messages: [
        {
          role: "user",
          content: `Find the most relevant short phrase from the PDF that matches the AI answer's topic. PRIORITIZE main content over appendix references.

AI ANSWER:
"${aiAnswer}"

PDF TEXT:
"${pdfText}"

TASK: Find a SHORT 5-15 word phrase from the PDF text that relates to the main topic discussed in the AI answer.

PRIORITY RULES:
- PRIORITIZE main body content over appendix/reference mentions
- Look for actual instructional content, not just references to other sections
- Choose substantive content that directly addresses the topic
- Avoid phrases that just mention "see appendix" or "refer to section X"

EXTRACTION RULES:
- Extract ONLY a short phrase from the PDF text above
- 5-15 words maximum
- Must be exact text that appears in the PDF
- Return the most relevant phrase about the same topic
- No explanations, just the PDF phrase
- If no relevant phrase exists, return "NO_MATCH"

EXAMPLES:
AI discusses input devices → Return: "keyboard and mouse are input devices" (NOT "see appendix for input device info")
AI discusses assembly language → Return: "assembly language uses symbolic names"
AI discusses Python installation → Return: "download Python from python.org and run installer" (NOT "Appendix A has installation instructions")

Return only the PDF phrase:`,
        },
      ],
      temperature: 0.1,
    });

    const aiResponse = result.text.trim();

    if (aiResponse === "NO_MATCH" || aiResponse.length < 5) {
      return NextResponse.json({
        matchedText: null,
        reasoning: "No relevant phrase found in PDF",
      });
    }

    console.log(`✅ AI found relevant phrase: "${aiResponse}"`);

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