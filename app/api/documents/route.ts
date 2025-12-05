// app/api/documents/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import pdf from "pdf-parse";

import { cleanLines } from "@/lib/cleaner";

export const runtime = "nodejs";

function buildSlides(rawPages: string[]): { pageNumber: number; lines: string[] }[] {
  return rawPages.map((pageText, index) => {
    const lines = cleanLines(pageText);
    return {
      pageNumber: index + 1,
      lines: lines,
    };
  });
}

// Helper: extract per-page text using pdf-parse
async function extractPagesFromPdf(pdfPath: string): Promise<string[]> {
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdf(dataBuffer);

  // pdf-parse returns all text in one string, pages separated by form-feed (\f)
  const rawPages = data.text
    .split(/\f/g)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return rawPages;
}

// ---------- Main handler ----------

export async function POST(req: NextRequest) {
  console.log("🔵 /api/documents triggered");

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Invalid file" }, { status: 400 });
    }

    const id = crypto.randomUUID();

    const basePath = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const pdfPath = path.join(basePath, `${id}.pdf`);
    fs.writeFileSync(pdfPath, buffer);
    console.log("📄 PDF saved at:", pdfPath);

    // 1) Raw text extraction (per page) using pdf-parse
    const rawPages: string[] = await extractPagesFromPdf(pdfPath);
    console.log("🧾 Extracted pages:", rawPages.length);

    // Save raw pages
    const rawJsonPath = path.join(basePath, `${id}.json`);
    fs.writeFileSync(rawJsonPath, JSON.stringify(rawPages, null, 2));

    // 2) Build structured slides from text
    const slides = buildSlides(rawPages);

    // 3) (TEMP) No image extraction on Vercel – keep shape but empty images
    const pageImagesMap: Record<number, string[]> = {}; // no images for now

    const slidesWithImages = slides.map((slide) => {
      const imgs = pageImagesMap[slide.pageNumber] || [];
      return { ...slide, images: imgs };
    });

    // 4) Save structured slides with images (empty image arrays)
    const structuredJsonPath = path.join(basePath, `${id}.slides.json`);
    fs.writeFileSync(
      structuredJsonPath,
      JSON.stringify(slidesWithImages, null, 2)
    );

    console.log("✅ Saved structured slides JSON at:", structuredJsonPath);

    return NextResponse.json({
      document: {
        id,
        pageCount: rawPages.length,
        hasStructured: true,
        hasImages: false, // no pdfimages on Vercel
      },
    });
  } catch (err) {
    console.error("💥 PDF processing failed:", err);
    return NextResponse.json(
      { error: "Failed processing PDF" },
      { status: 500 }
    );
  }
}
