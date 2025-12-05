"use client";

import React, { useState } from "react";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

type ChatSidebarProps = {
  documentId: string | null;
  currentPage: number;
  pageCount: number | null;
};

export default function ChatSidebar({
  documentId,
  currentPage,
  pageCount,
}: ChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content:
        "Hi! Upload a PDF on the right, then I can explain the current page or answer questions about it.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      if (!documentId) {
        const assistantMessage: Message = {
          id: Date.now() + 1,
          role: "assistant",
          content:
            "No document is loaded yet. Please upload a PDF on the right first.",
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        console.log("💬 Sending chat", {
          documentId,
          currentPage,
          message: trimmed,
        });

        const res = await fetch(`/api/documents/${documentId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            page: currentPage,
          }),
        });

        const data = await res.json();
        console.log("💬 Chat response", data);

        const replyText =
          data.reply ??
          (data.error
            ? `Error: ${data.error}`
            : "No reply from server (Groq API issue).");

        const assistantMessage: Message = {
          id: Date.now() + 1,
          role: "assistant",
          content: replyText,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          role: "assistant",
          content: "Error contacting the API.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-black/40">
      <header className="p-3 border-b border-white/10 space-y-1">
        <h2 className="text-sm font-semibold tracking-wide">Document Chat</h2>
        <p className="text-[11px] text-white/60">
          Linked to the PDF on the right. Ask things like:
          <br />
          <span className="italic">
            "Explain this page", "Summarize current page", "What is shown
            here?"
          </span>
        </p>
        <div className="text-[11px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded px-2 py-1 inline-flex flex-col gap-[2px] mt-1">
          <span>
            Document:{" "}
            {documentId ? (
              <span className="text-cyan-100">{documentId.slice(0, 8)}…</span>
            ) : (
              <span className="text-red-300">None loaded</span>
            )}
          </span>
          <span>
            Current page:{" "}
            {pageCount ? `${currentPage} / ${pageCount}` : currentPage}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-3 space-y-2 text-sm">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg px-3 py-2 max-w-[95%] whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-blue-500/80 ml-auto"
                : "bg-white/10 mr-auto"
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-white/10">
        <div className="flex gap-2">
          <input
            className="flex-1 text-xs px-2 py-2 rounded-md bg-black/60 border border-white/15 outline-none focus:border-blue-400"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the current page..."
          />
          <button
            type="submit"
            disabled={isSending}
            className="text-xs px-3 py-2 rounded-md bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
          >
            {isSending ? "..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
