import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { HttpCrossEncoderReranker, OpenAIEmbeddingProvider, PrismaGeneralCatalogue, PrismaHybridKnowledgeRetriever, runGeneralAssistant } from "@hairos/packages/assistant-core";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const clientKey = forwarded || request.headers.get("x-real-ip") || "anonymous";
    const limit = rateLimit(`assistant-general:${clientKey}`, 30, 60_000);
    if (!limit.ok) return NextResponse.json({ error: "Too many assistant requests. Please try again in a minute." }, { status: 429 });
    const body = await request.json() as {
      mode?: string;
      query?: string;
      language?: string;
      history?: Array<{ role?: string; content?: string }>;
    };
    if (body.mode === "PERSONAL_PLAN") return NextResponse.json({ error: "Personal-plan questions must use the authenticated personal-plan endpoint" }, { status: 400 });
    const query = body.query?.trim();
    if (!query || query.length > 4000) return NextResponse.json({ error: "Query must contain 1 to 4000 characters" }, { status: 400 });
    const history = Array.isArray(body.history) ? body.history.slice(-6)
      .filter((item): item is { role: "user" | "assistant"; content: string } => (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
      .map((item) => ({ role: item.role, content: item.content.slice(0, 2000) })) : [];
    const embedding = process.env.OPENAI_API_KEY ? new OpenAIEmbeddingProvider(process.env.OPENAI_API_KEY) : undefined;
    const reranker = process.env.ASSISTANT_RERANK_URL ? new HttpCrossEncoderReranker(process.env.ASSISTANT_RERANK_URL, process.env.ASSISTANT_RERANK_API_KEY) : undefined;
    const response = await runGeneralAssistant(
      { requestId: crypto.randomUUID(), query, language: body.language, history },
      new PrismaGeneralCatalogue(prisma),
      new PrismaHybridKnowledgeRetriever(prisma, embedding, undefined, reranker),
    );
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store", "X-Assistant-Mode": "GENERAL_KNOWLEDGE" } });
  } catch {
    return NextResponse.json({ error: "The general hair assistant is temporarily unavailable" }, { status: 500 });
  }
}