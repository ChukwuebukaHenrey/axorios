"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, SendHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { t } from "@/lib/messages";
import type { BrandKit } from "@/modules/brand";
import type { Product } from "@/modules/catalog";
import { BrandCard } from "./brand-card";
import { ProductsCard } from "./products-card";

const BRAND_TOOL_TYPES = new Set(["tool-create_brand_kit", "tool-update_brand_kit"]);

type ToolPart = { type: string; state?: string; output?: unknown };

function brandOutput(part: ToolPart): BrandKit | null {
  return BRAND_TOOL_TYPES.has(part.type) && part.state === "output-available" ? (part.output as BrandKit) : null;
}

function productsOutput(part: ToolPart): Product[] | null {
  return part.type === "tool-add_products" && part.state === "output-available" ? (part.output as Product[]) : null;
}

export function BuilderChat({
  initialMessages,
  initialKit,
  initialProducts,
}: {
  initialMessages: UIMessage[];
  initialKit: BrandKit | null;
  initialProducts: Product[];
}) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/agent" }), []);
  const { messages, sendMessage, status, error } = useChat({ messages: initialMessages, transport });
  const busy = status === "submitted" || status === "streaming";

  const latestKit = useMemo(() => {
    for (const message of [...messages].reverse()) {
      for (const part of [...message.parts].reverse()) {
        const kit = brandOutput(part as ToolPart);
        if (kit) return kit;
      }
    }
    return initialKit;
  }, [messages, initialKit]);

  const latestProducts = useMemo(() => {
    for (const message of [...messages].reverse()) {
      for (const part of [...message.parts].reverse()) {
        const products = productsOutput(part as ToolPart);
        if (products) return products;
      }
    }
    return initialProducts;
  }, [messages, initialProducts]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sendMessage({ text });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <section className="flex min-h-0 flex-1 flex-col md:max-w-xl md:border-r md:border-black/10">
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.length === 0 && <p className="rounded-2xl bg-white p-4 shadow-sm">{t.builder.greeting}</p>}
          {messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "flex flex-col items-end" : "flex flex-col"}>
              {message.parts.map((part, i) => {
                if (part.type === "text") {
                  return (
                    <p
                      key={i}
                      className={
                        message.role === "user"
                          ? "max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 whitespace-pre-wrap text-white"
                          : "max-w-[85%] rounded-2xl bg-white px-4 py-2.5 whitespace-pre-wrap shadow-sm"
                      }
                    >
                      {part.text}
                    </p>
                  );
                }
                const kit = brandOutput(part as ToolPart);
                if (kit) {
                  return (
                    <div key={i} className="my-2 w-full max-w-sm md:hidden">
                      <BrandCard kit={kit} />
                    </div>
                  );
                }
                const products = productsOutput(part as ToolPart);
                return products ? (
                  <div key={i} className="my-2 w-full max-w-sm md:hidden">
                    <ProductsCard products={products} />
                  </div>
                ) : null;
              })}
            </div>
          ))}
          {busy && (
            <p className="flex items-center gap-2 text-sm text-black/60">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t.builder.thinking}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {t.builder.error}
            </p>
          )}
          <div ref={endRef} />
        </div>
        <form onSubmit={submit} className="flex gap-2 border-t border-black/10 bg-white p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.builder.placeholder}
            aria-label={t.builder.placeholder}
            className="h-12 min-w-0 flex-1 rounded-xl border border-black/15 px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label={t.builder.send}
            className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-ink transition hover:bg-accent disabled:opacity-50"
          >
            <SendHorizontal className="size-5" aria-hidden="true" />
          </button>
        </form>
      </section>
      <aside className="hidden flex-1 overflow-y-auto bg-black/[0.03] p-6 md:block">
        <h2 className="mb-4 font-semibold">{t.builder.panelTitle}</h2>
        {latestKit ? (
          <div className="flex max-w-md flex-col gap-4">
            <BrandCard kit={latestKit} />
            {latestProducts.length > 0 && <ProductsCard products={latestProducts} />}
          </div>
        ) : (
          <p className="text-black/60">{t.builder.panelEmpty}</p>
        )}
      </aside>
    </div>
  );
}
