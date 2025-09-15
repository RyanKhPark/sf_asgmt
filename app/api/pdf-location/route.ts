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
          content: `Find the exact location and actual text content from the PDF that relates to the matched phrase.

MATCHED PHRASE (from previous AI analysis):
"${aiMatchedPhrase}"

FULL PDF TEXT WITH PAGE NUMBERS:
${pdfText}

TASK:
1. Find which page contains content related to the matched phrase
2. Extract the ACTUAL text from that page (20-40 words) that contains the relevant information
3. Return the page number and the actual PDF text

RULES:
- Look for content semantically related to the matched phrase
- Extract the actual text as it appears in the PDF (preserve original wording)
- Choose a 20-40 word excerpt that contains the core information
- Return page number as integer

RESPONSE FORMAT:
Page: [page_number]
Text: [actual_pdf_text_excerpt]

If no relevant content found, respond with:
Page: 0
Text: NO_MATCH`,
        },
      ],
      temperature: 0.1,
    });

    const aiResponse = result.text.trim();
    console.log(`🤖 AI location response: "${aiResponse}"`);

    // Parse the AI response
    const pageMatch = aiResponse.match(/Page:\s*(\d+)/);
    const textMatch = aiResponse.match(/Text:\s*(.+)/s);

    if (!pageMatch || !textMatch || pageMatch[1] === "0" || textMatch[1].trim() === "NO_MATCH") {
      return NextResponse.json({
        pageNumber: null,
        actualText: null,
        reasoning: "No relevant content found in PDF",
      });
    }

    const pageNumber = parseInt(pageMatch[1]);
    const actualText = textMatch[1].trim();

    console.log(`✅ AI found content on page ${pageNumber}: "${actualText}"`);

    return NextResponse.json({
      pageNumber,
      actualText,
      reasoning: "AI successfully located relevant content",
    });

  } catch (error) {
    console.error("PDF location analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze PDF location" },
      { status: 500 }
    );
  }
}