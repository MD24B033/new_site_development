// app/api/documents/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import extract from "pdf-text-extract";
import { execFile } from "child_process";


import { cleanLines } from "@/lib/cleaner";

export const runtime = "nodejs";




function buildSlides(rawPages: string[]): { pageNumber: number; lines: string[] }[] {
  return rawPages.map((pageText, index) => {
    const lines = cleanLines(pageText);
    return {
      pageNumber: index + 1, 
      lines: lines
    };
  });
}


// ---------- Image extraction helper (using pdfimages) ----------

function extractImagesForPdf(
  pdfPath: string,
  imagesDir: string,
  basePrefix: string
): Promise<Record<number, string[]>> {
  return new Promise((resolve, reject) => {
    // Make sure imagesDir exists
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // pdfimages -p -png input.pdf imagesDir/basePrefix
    // -p   → include page number in file name
    // -png → output PNG images
    const outputPrefix = path.join(imagesDir, basePrefix);

    execFile(
      "pdfimages",
      ["-p", "-png", pdfPath, outputPrefix],
      (err, _stdout, stderr) => {
        if (err) {
          console.error("❌ pdfimages error:", err, stderr);
          return reject(err);
        }

        // Read all images created in imagesDir
        const files = fs.readdirSync(imagesDir);
        const pageToImages: Record<number, string[]> = {};

        for (const file of files) {
          if (!file.startsWith(basePrefix)) continue;
          if (!file.endsWith(".png")) continue;

          // Example name: <basePrefix>-000001-000.png
          const match = file.match(/-(\d+)-(\d+)\.png$/);
          if (!match) continue;

          const pageNum = parseInt(match[1], 10); // e.g. 1
          if (!pageToImages[pageNum]) pageToImages[pageNum] = [];

          // Build a relative path you can serve/use in frontend
          const relPath = path.join("tmp", path.basename(imagesDir), file);
          pageToImages[pageNum].push(relPath);
        }

        resolve(pageToImages);
      }
    );
  });
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

    // 1) Raw text extraction (per page)
    const rawPages: string[] = await new Promise((resolve, reject) => {
      extract(pdfPath, (err: any, pages: any) => {
        if (err) reject(err);
        else resolve(pages);
      });
    });
    console.log("🧾 Extracted pages:", rawPages.length);

    // Save raw pages
    const rawJsonPath = path.join(basePath, `${id}.json`);
    fs.writeFileSync(rawJsonPath, JSON.stringify(rawPages, null, 2));

    // 2) Build structured slides from text
    const slides = buildSlides(rawPages);

    // 3) Extract images with pdfimages
    const imagesDir = path.join(basePath, `${id}_images`);
    const pageImagesMap = await extractImagesForPdf(pdfPath, imagesDir, id);

    // Attach images to slides by page number
    const slidesWithImages = slides.map((slide) => {
      const imgs = pageImagesMap[slide.pageNumber] || [];
      return { ...slide, images: imgs };
    });

    // 4) Save structured slides with images
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
        hasImages: Object.keys(pageImagesMap).length > 0,
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
