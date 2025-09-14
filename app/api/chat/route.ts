import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("Chat request:", body);

    // AI chat endpoint with streaming will be implemented here
    return NextResponse.json({ message: "Chat endpoint placeholder" });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
