import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: NextRequest) {
  try {
    const { message, pdfContent, documentId } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenAI({ apiKey: apiKey });

    // Build context from PDF content if available
    let prompt = message;
    if (pdfContent) {
      prompt = `Based on the following PDF content, please answer the user's question:

PDF Content:
${pdfContent}

User Question: ${message}

Please provide a helpful and accurate response based on the PDF content.`;
    }

    console.log("Sending to Gemini:", {
      documentId,
      messageLength: message.length,
    });

    const result = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    const text = result.text;

    return NextResponse.json({
      message: text,
      documentId,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
