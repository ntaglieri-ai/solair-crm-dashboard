import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Check if API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        reply: "L'assistente AI non è disponibile in questo ambiente. Per favore visita /contatti per metterti in contatto con noi direttamente.",
      });
    }

    // Dynamic import to avoid initialization errors when API key is missing
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // Limit to last 5 messages to keep context manageable
    const limitedMessages = messages.slice(-5);

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: "Sei l'assistente virtuale di MosTag Studio, agenzia digitale italiana fondata da Nando Taglieri. Rispondi sempre in italiano, in modo professionale ma cordiale. Servizi offerti: siti web, landing page, soluzioni AI, chatbot, app. Per preventivi invita a contattare contact@mostag.net o il form su mostag.net. Risposte brevi, max 2-3 frasi.",
      messages: limitedMessages as any,
    });

    const assistantMessage =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({
      reply: assistantMessage,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
