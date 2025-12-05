"use client";

import React, { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type PdfViewerProps = {
  onDocumentLoaded?: (info: { id: string; pageCount: number }) => void;
  onPageChange?: (page: number) => void;
};

export default function PdfViewer({
  onDocumentLoaded,
  onPageChange,
}: PdfViewerProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Raise page change up to parent
  useEffect(() => {
    if (onPageChange && numPages && pageNumber >= 1 && pageNumber <= numPages) {
      onPageChange(pageNumber);
    }
  }, [pageNumber, numPages, onPageChange]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }

    // Show locally in viewer
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    setFileName(file.name);
    setNumPages(null);
    setPageNumber(1);
    setScale(1.0);
    setIsLoadingPdf(true);

    // Upload to backend so AI can use it
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.document?.id) {
        const pageCount = data.document.pageCount ?? 0;
        onDocumentLoaded?.({
          id: data.document.id,
          pageCount,
        });
      } else {
        console.error("Upload error:", data);
        alert("Failed to upload document for AI. Check console.");
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. See console for details.");
    } finally {
      setIsUploading(false);
    }
  }

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
    setIsLoadingPdf(false);
  }

  function onDocumentLoadError(error: any) {
    console.error("PDF load error:", error);
    alert("Failed to load PDF. Check console for details.");
    setIsLoadingPdf(false);
  }

  function goToPrevPage() {
    setPageNumber((prev) => (prev > 1 ? prev - 1 : prev));
  }

  function goToNextPage() {
    setPageNumber((prev) =>
      numPages ? (prev < numPages ? prev + 1 : prev) : prev
    );
  }

  function handlePageInput(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    if (!numPages) return;

    const page = Number(value);
    if (!Number.isNaN(page) && page >= 1 && page <= numPages) {
      setPageNumber(page);
    }
  }

  function zoomIn() {
    setScale((prev) => Math.min(prev + 0.2, 3));
  }

  function zoomOut() {
    setScale((prev) => Math.max(prev - 0.2, 0.4));
  }

  function resetZoom() {
    setScale(1.0);
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        {/* File input */}
        <div className="flex items-center gap-2">
          <label className="text-sm">
            <span className="mr-2 font-medium">PDF file:</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={onFileChange}
              className="text-xs"
            />
          </label>
          {fileName && (
            <span className="text-xs text-white/60 truncate max-w-[240px]">
              {fileName}
            </span>
          )}
          {isUploading && (
            <span className="text-[11px] text-cyan-300">
              Uploading for AI…
            </span>
          )}
        </div>

        {/* Page + Zoom controls */}
        {fileUrl && (
          <div className="flex items-center gap-4 text-xs">
            {/* Page controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevPage}
                className="px-2 py-1 rounded border border-white/20 bg-white/5 hover:bg-white/10 disabled:opacity-40"
                disabled={!numPages || pageNumber <= 1}
              >
                ◀
              </button>
              <span>
                Page{" "}
                <input
                  type="number"
                  min={1}
                  max={numPages ?? 1}
                  value={pageNumber}
                  onChange={handlePageInput}
                  className="w-12 bg-black/60 border border-white/20 rounded px-1 py-[1px] text-center text-xs"
                />{" "}
                / {numPages ?? "—"}
              </span>
              <button
                onClick={goToNextPage}
                className="px-2 py-1 rounded border border-white/20 bg-white/5 hover:bg-white/10 disabled:opacity-40"
                disabled={!numPages || (numPages !== null && pageNumber >= numPages)}
              >
                ▶
              </button>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={zoomOut}
                className="px-2 py-1 rounded border border-white/20 bg-white/5 hover:bg-white/10"
              >
                −
              </button>
              <span>{Math.round(scale * 100)}%</span>
              <button
                onClick={zoomIn}
                className="px-2 py-1 rounded border border-white/20 bg-white/5 hover:bg-white/10"
              >
                +
              </button>
              <button
                onClick={resetZoom}
                className="px-2 py-1 rounded border border-white/20 bg-white/5 hover:bg-white/10"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Viewer area */}
      <div className="flex-1 overflow-auto border border-white/10 rounded-lg bg-black/30 flex justify-center">
        {!fileUrl ? (
          <div className="m-auto text-sm text-white/50">
            Upload a PDF to view it here.
          </div>
        ) : (
          <div className="p-4 flex justify-center">
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="text-sm text-white/70">
                  {isLoadingPdf ? "Loading PDF…" : "Preparing PDF…"}
                </div>
              }
              error={
                <div className="text-sm text-red-400">
                  Failed to load PDF.
                </div>
              }
            >
              <Page
                key={`page_${pageNumber}`}
                pageNumber={pageNumber}
                renderTextLayer={true}
                renderAnnotationLayer={false}
                scale={scale}
              />
            </Document>
          </div>
        )}
      </div>
    </div>
  );
}
