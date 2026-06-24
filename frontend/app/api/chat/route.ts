import { NextResponse } from "next/server";

/**
 * Mock chat API endpoint
 * POST /api/chat
 *
 * Simulates latency and always returns "hello world"
 * Replace with actual LLM integration when ready
 */
export async function POST(request: Request) {
  try {
    // Parse request body (for future use)
    const body = await request.json();

    // Simulate processing latency
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Return mock response
    return NextResponse.json({ text: "hello world" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 },
    );
  }
}
