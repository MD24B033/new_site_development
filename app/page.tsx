"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import ChatSidebar from "@/components/ChatSidebar";

// Load PdfViewer only on the client, no SSR
const PdfViewer = dynamic(() => import("@/components/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-sm text-white/60">
      Loading PDF viewer…
    </div>
  ),
});

export default function HomePage() {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageCount, setPageCount] = useState<number | null>(null);

  return (
    <main className="min-h-screen flex bg-[#050810] text-white">
      {/* Left: Chat */}
      <div className="w-[30%] min-w-[280px] border-r border-white/10">
        <ChatSidebar
          documentId={documentId}
          currentPage={currentPage}
          pageCount={pageCount}
        />
      </div>

      {/* Right: PDF area */}
      <div className="flex-1 flex flex-col">
        <header className="p-4 border-b border-white/10 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-wide">
            Document Explorer
          </h1>
          <p className="text-xs text-white/60">
            Upload a PDF, navigate pages, and chat with it.
          </p>
        </header>

        <section className="flex-1 overflow-hidden p-4">
          <PdfViewer
            onDocumentLoaded={(info) => {
              console.log("📥 onDocumentLoaded", info);
              setDocumentId(info.id);
              setPageCount(info.pageCount);
              setCurrentPage(1);
            }}
            onPageChange={(page) => {
              console.log("📄 onPageChange", page);
              setCurrentPage(page);
            }}
          />
        </section>
      </div>
    </main>
  );
}
