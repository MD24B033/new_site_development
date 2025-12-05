// app/api/documents/[id]/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

// In this Next.js version, `params` is a Promise
type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    // 🔑 unwrap params first
    const { id } = await context.params;
    const documentId = id;
    console.log("💬 Chat request for documentId:", documentId);

    const body = await req.json();
    const { message, page } = body as {
      message?: string;
      page?: number;
    };
    console.log("💬 Chat body:", { message, page });

    if (!message) {
      return NextResponse.json(
        { error: "Missing 'message' in request body." },
        { status: 400 }
      );
    }

    // 1) Load page text from ./tmp/<documentId>.json
    let pageText: string | null = null;
    let effectivePageNumber: number | null = null; // 1-based page number for logs / prompt

    try {
      const basePath = path.join(process.cwd(), "tmp");
      const jsonPath = path.join(basePath, `${documentId}.json`);
      console.log("🔎 Looking for JSON at:", jsonPath);

      if (fs.existsSync(jsonPath)) {
        const raw = fs.readFileSync(jsonPath, "utf8");
        let fileData: any;
        try {
          fileData = JSON.parse(raw);
        } catch (e) {
          console.error("💥 Failed to parse JSON file:", e);
          fileData = null;
        }

        // Support both formats:
        // 1) [ "page1 text", "page2 text", ... ]
        // 2) { pages: [ "page1 text", ... ] }
        const pages: string[] | undefined = Array.isArray(fileData)
          ? fileData
          : fileData && Array.isArray(fileData.pages)
          ? fileData.pages
          : undefined;

        if (!pages || pages.length === 0) {
          console.warn("⚠ JSON file has no pages for documentId:", documentId);
        } else {
          console.log("📄 JSON pages length:", pages.length);

          let pageIndex: number | null = null;

          if (typeof page === "number") {
            // ✅ Support 1-based page numbers (page=1 → index 0)
            if (page >= 1 && page <= pages.length) {
              pageIndex = page - 1;
            }
            // ✅ Also support 0-based (page=0 → index 0)
            else if (page >= 0 && page < pages.length) {
              pageIndex = page;
            } else {
              console.warn(
                "⚠ Page number out of range for pages.length:",
                page,
                pages.length
              );
            }
          }

          // If no valid page provided, default to first page
          if (pageIndex === null) {
            pageIndex = 0;
            console.log(
              "ℹ No valid page provided, defaulting to first page (index 0)"
            );
          }

          pageText = pages[pageIndex];
          effectivePageNumber = pageIndex + 1; // make it 1-based for humans

          console.log(
            `✅ Loaded text for pageIndex=${pageIndex} (page ${
              effectivePageNumber
            }), length:`,
            pageText?.length ?? 0
          );
        }
      } else {
        console.log("⚠ JSON file does NOT exist for documentId:", documentId);
      }
    } catch (e) {
      console.error("💥 Failed to load page text:", e);
    }

    // 2) Groq API key (use environment variable)
    const apiKey = process.env.API_KEY;


    // 3) Build prompt for Groq
    const pageLabel =
      effectivePageNumber !== null
        ? effectivePageNumber
        : typeof page === "number"
        ? page
        : "unknown";

    const userContent = pageText
      ? `You are given the text of a PDF page.

PAGE NUMBER: ${pageLabel}

PAGE TEXT:
${pageText}

USER QUESTION:
${message}`
      : `I do not have the text of the document.
Please answer the user's question as best as you can.

DOCUMENT ID: ${documentId}
PAGE: ${page}

USER QUESTION:
${message}`;

    // 4) Call Groq
    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant for a PDF viewer app. When page text is provided, base your answers strictly on that text.",
            },
            {
              role: "user",
              content: userContent,
            },
          ],
          temperature: 0.2,
        }),
      }
    );

    if (!groqRes.ok) {
      const text = await groqRes.text();
      console.error("💥 Groq API error:", text);
      return NextResponse.json(
        { error: "Groq API error: " + text },
        { status: 500 }
      );
    }

    const groqData = await groqRes.json();

    const reply =
      groqData?.choices?.[0]?.message?.content ??
      "No reply generated by Groq model.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error(" Error in chat route:", err);
    return NextResponse.json(
      { error: "Internal server error in /api/documents/[id]/chat." },
      { status: 500 }
    );
  }
}
