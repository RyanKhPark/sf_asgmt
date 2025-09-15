import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { anthropic } from "@ai-sdk/anthropic";

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
}

interface HighlightReference {
  text: string;
  pageNumber: number;
  confidence: number;
}

// Advanced similarity scoring for better matching
function calculateSimilarity(text1: string, text2: string): number {
  const a = text1.toLowerCase().trim();
  const b = text2.toLowerCase().trim();

  if (a === b) return 1.0;
  const lengthDiff = Math.abs(a.length - b.length);
  const maxLength = Math.max(a.length, b.length) || 1;
  const lengthPenalty = lengthDiff / maxLength;

  const aChars = new Set(a.split(""));
  const bChars = new Set(b.split(""));
  const intersection = new Set([...aChars].filter((x) => bChars.has(x)));
  const union = new Set([...aChars, ...bChars]);
  const charSimilarity = union.size === 0 ? 0 : intersection.size / union.size;

  const aWords = a.split(/\s+/).filter((w) => w.length > 2);
  const bWords = b.split(/\s+/).filter((w) => w.length > 2);
  const commonWords = aWords.filter((word) => bWords.includes(word));
  const wordSimilarity = Math.max(commonWords.length / Math.max(aWords.length, 1), commonWords.length / Math.max(bWords.length, 1));

  const substringScore = a.includes(b) || b.includes(a) ? 0.8 : 0;
  const score = charSimilarity * 0.3 + wordSimilarity * 0.5 + substringScore * 0.2 - lengthPenalty * 0.1;
  return Math.max(0, Math.min(1, score));
}

// Calculate precise highlight bounds for better accuracy
function calculatePreciseHighlight(
  searchText: string,
  textItem: TextItem
): { x: number; y: number; width: number; height: number } {
  const searchLower = searchText.toLowerCase().trim();
  const itemTextLower = textItem.text.toLowerCase();
  const matchIndex = itemTextLower.indexOf(searchLower);

  if (matchIndex !== -1 && textItem.text.length > 0) {
    const avgCharWidth = textItem.width / textItem.text.length;
    const estimatedCharWidth = Math.max(4, Math.min(avgCharWidth, 18));
    const matchStartX = textItem.x + matchIndex * estimatedCharWidth;
    const matchWidth = Math.max(12, searchText.length * estimatedCharWidth);
    const clampedX = Math.max(textItem.x, Math.min(matchStartX, textItem.x + textItem.width - matchWidth));
    const clampedWidth = Math.min(matchWidth, textItem.x + textItem.width - clampedX);
    return { x: clampedX, y: textItem.y, width: clampedWidth, height: textItem.height };
  }

  // Fallback
  const estimatedWidth = Math.min(textItem.width, Math.max(20, searchText.length * 8));
  return { x: textItem.x, y: textItem.y, width: estimatedWidth, height: textItem.height };
}

function findTextInDocument(
  searchText: string,
  textItems: TextItem[]
): { item: TextItem; matchStart: number; matchEnd: number } | null {
  const searchLower = searchText.toLowerCase().trim();
  if (!searchLower) return null;

  for (const item of textItems) {
    const textLower = item.text.toLowerCase();
    const index = textLower.indexOf(searchLower);
    if (index !== -1 && item.x >= 0 && item.y >= 0) {
      return { item, matchStart: index, matchEnd: index + searchText.length };
    }
  }

  // Word-based partial matches
  const words = searchLower.split(/\s+/).filter((w) => w.length > 3);
  if (words.length > 0) {
    for (const item of textItems) {
      const itemLower = item.text.toLowerCase();
      const hasWord = words.find((w) => itemLower.includes(w));
      if (hasWord) {
        return { item, matchStart: 0, matchEnd: item.text.length };
      }
    }
  }

  // Similarity fallback
  let best: { item: TextItem; score: number } | null = null;
  for (const item of textItems) {
    const score = calculateSimilarity(searchText, item.text);
    if (score > 0.6 && (!best || score > best.score)) best = { item, score };
  }
  if (best) return { item: best.item, matchStart: 0, matchEnd: best.item.text.length };
  return null;
}

function extractHighlightReferences(aiResponse: string): HighlightReference[] {
  const references: HighlightReference[] = [];
  const quotePatterns = [
    /"([^"]+)"/g,
    /'([^']+)'/g,
    /`([^`]+)`/g,
  ];
  quotePatterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(aiResponse)) !== null) {
      const clean = match[1].trim();
      if (clean.length >= 5 && clean.length <= 300) {
        references.push({ text: clean, pageNumber: 0, confidence: 0.9 });
      }
    }
  });
  return references;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, pdfContent, documentId, conversationId, textItems } = await request.json();

    if (!message || !documentId) {
      return NextResponse.json(
        { error: "Message and documentId are required" },
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

    // Build context from PDF content if available
    let prompt = message;
    if (pdfContent) {
      prompt = `You are an expert professor and academic mentor. You have access to the following document content, and you should engage in a scholarly discussion with the student about the topic, concepts, and broader implications.

Document Content:
${pdfContent}

Student Question/Comment: ${message}

Instructions:
* No need to reveal 'Student Question/Comment'
* No need to answer regardless of a question
* Unnecessarily long responses are not appreciated, do not provide unnecessary details
* When not understanding the question, ask for clarification
1. If the student asks a direct question about the document, provide a comprehensive answer based on the content
2. If the student wants to discuss the topic more broadly, engage in an educational conversation about related concepts, applications, and implications
3. Encourage critical thinking by asking follow-up questions when appropriate
4. Provide additional context and connections to related topics when helpful
5. Maintain a professional but approachable academic tone
6. If the question goes beyond the document scope, acknowledge this but still provide relevant insights from your expertise

Please respond as a knowledgeable professor would in an academic discussion.`;
    }

    console.log("Sending to Anthropic:", {
      documentId,
      messageLength: message.length,
    });

    const result = await generateText({
      model: anthropic("claude-3-haiku-20240307"),
      messages: [
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });
    const aiResponseText = result.text || "";

    // Phase 2: Alignment to PDF text
    let highlights: {
      text: string;
      pageNumber: number;
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
    }[] = [];

    // Extract quoted refs from answer
    let highlightRefs: HighlightReference[] = extractHighlightReferences(aiResponseText);

    // If paraphrased, also select top relevant snippets via similarity ranking
    if (Array.isArray(textItems) && textItems.length > 0) {
      const ranked = [...textItems]
        .map((item: TextItem) => ({ item, score: calculateSimilarity(aiResponseText, item.text) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 120)
        .map((r) => r.item);

      // Anthropic alignment: ask model to select best indices from candidates
      try {
        const candidates = ranked.map((it, idx) => ({ index: idx, pageNumber: it.pageNumber, text: it.text }));
        const alignSchema = z.object({ citations: z.array(z.object({ index: z.number(), reason: z.string().optional() })).max(8) });
        const alignPrompt = `You will align an answer with exact snippets from a document.
Answer:
${aiResponseText}

Below are candidate snippets extracted from the PDF. Choose up to 5-8 that best support the answer. Only return JSON matching this schema: { citations: [{ index, reason? }] } where index refers to the item index provided.

Candidates:
${candidates.map(c => `[${c.index}] (p.${c.pageNumber}) ${c.text}`).join("\n")}`;

        const aligned = await generateObject({ model: anthropic("claude-3-5-sonnet-latest"), schema: alignSchema, prompt: alignPrompt });
        const selected = aligned.object.citations || [];
        const selectedItems = selected
          .map(c => ranked[c.index])
          .filter(Boolean);
        // Seed refs with selected texts for coordinate mapping
        highlightRefs = [
          ...highlightRefs,
          ...selectedItems.map(it => ({ text: it.text, pageNumber: it.pageNumber, confidence: 0.95 })),
        ];
      } catch (e) {
        console.warn("Anthropic alignment selection failed; using top-ranked items.");
        highlightRefs = [
          ...highlightRefs,
          ...ranked.slice(0, 8).map((it) => ({ text: it.text, pageNumber: it.pageNumber, confidence: 0.8 })),
        ];
      }

      // Find and make rectangles
      for (const ref of highlightRefs) {
        const match = findTextInDocument(ref.text, textItems as TextItem[]);
        if (match) {
          const { item } = match;
          const box = calculatePreciseHighlight(ref.text, item);
          highlights.push({
            text: ref.text,
            pageNumber: item.pageNumber,
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            color: "#ffeb3b",
          });
        }
        if (highlights.length >= 8) break;
      }
    }

    // Save both user message and AI response to database if conversationId provided
    let messageId: string | null = null;
    if (conversationId) {
      try {
        const conversation = await db.conversation.findFirst({
          where: { id: conversationId, userId: session.user.id, documentId },
        });
        if (conversation) {
          await db.message.create({ data: { content: message, role: "user", conversationId } });
          const aiMessage = await db.message.create({
            data: { content: aiResponseText || "", role: "assistant", conversationId },
          });
          messageId = aiMessage.id;

          // Persist highlights linked to this AI message
          for (const h of highlights) {
            const annotation = await db.annotation.create({
              data: {
                type: "ai_highlight",
                highlightText: h.text,
                pageNumber: h.pageNumber,
                x: h.x,
                y: h.y,
                width: h.width,
                height: h.height,
                color: h.color,
                createdBy: "ai",
                documentId,
                userId: session.user.id,
              },
            });
            await db.messageHighlight.create({
              data: { messageId: aiMessage.id, annotationId: annotation.id },
            });
          }
        }
      } catch (dbError) {
        console.error("Database save error:", dbError);
      }
    }

    return NextResponse.json({
      message: aiResponseText,
      documentId,
      messageId,
      highlights: highlights.map((h) => ({ ...h, shouldNavigate: true })),
    });
  } catch (error: unknown) {
    console.error("Chat error:", error);

    // Handle specific API errors
    const errorStatus = (error as { status?: number })?.status;

    if (errorStatus === 503) {
      return NextResponse.json(
        {
          error:
            "AI service is temporarily unavailable. Please try again in a moment.",
        },
        { status: 503 }
      );
    }

    if (errorStatus === 429) {
      return NextResponse.json(
        {
          error: "Too many requests. Please wait a moment before trying again.",
        },
        { status: 429 }
      );
    }

    if (errorStatus === 400) {
      return NextResponse.json(
        { error: "Invalid request. Please check your input." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process chat request. Please try again." },
      { status: 500 }
    );
  }
}
