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

    console.log(`🤖 AI finding essential topic from answer in PDF...`);

    const result = await generateText({
      model: anthropic("claude-3-haiku-20240307"),
      messages: [
        {
          role: "user",
          content: `You must copy text word-for-word from the PDF.

AI TOPIC: "${aiAnswer}"

PDF TEXT TO SEARCH:
"${pdfText}"

COPY EXACT TEXT: Look through the PDF text and find a 6-12 word phrase that relates to the AI topic. Copy it exactly as written in the PDF.

FORBIDDEN:
- Do NOT write "section 1.2" or "the document"
- Do NOT describe the PDF
- Do NOT explain anything
- ONLY copy exact words from the PDF text

CORRECT FORMAT: Copy words directly like "hardware includes processors memory and storage devices" or "input devices collect data from users"`,
        },
      ],
      temperature: 0.1,
    });

    const aiResponse = result.text.trim();

    if (aiResponse === "NO_MATCH" || aiResponse.length < 10) {
      return NextResponse.json({
        matchedText: null,
        reasoning: "No relevant topic section found in PDF",
      });
    }

    console.log(`✅ AI found essential topic section: "${aiResponse}"`);

    return NextResponse.json({
      matchedText: aiResponse,
      reasoning:
        "AI successfully identified topic and found matching PDF section",
    });
  } catch (error) {
    console.error("PDF topic analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze PDF topic" },
      { status: 500 }
    );
  }
}
