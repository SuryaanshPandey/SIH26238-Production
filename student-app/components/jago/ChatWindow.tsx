"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { JagoMessage, JagoClientAction } from "../../lib/contracts/types";
import { jagoApi } from "../../lib/api/jago";
import { useLanguage } from "../../lib/context/LanguageContext";
import { Button } from "../ui/Button";
import { formatDateTime } from "../../lib/utils";
import {
  Send,
  Bot,
  User,
  ArrowRight,
  BookOpen,
  ShieldCheck,
  X,
  Compass,
  FileText,
  FolderLock,
  CreditCard,
  Sparkles,
} from "lucide-react";

interface ChatWindowProps {
  variant?: "page" | "drawer";
  onClose?: () => void;
}

function actionIcon(href: string) {
  if (href.startsWith("/scholarships")) return Compass;
  if (href.startsWith("/applications")) return FileText;
  if (href.startsWith("/documents")) return FolderLock;
  if (href.startsWith("/profile")) return User;
  if (href.startsWith("/notifications")) return Sparkles;
  if (href.startsWith("/actions")) return CreditCard;
  return ArrowRight;
}

export function ChatWindow({ variant = "page", onClose }: ChatWindowProps) {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const [messages, setMessages] = useState<JagoMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextApplicationId, setContextApplicationId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    void jagoApi.getMessages().then((loaded) => {
      if (!mounted) return;
      setMessages(loaded);
      const lastJago = [...loaded].reverse().find((message) => message.sender === "JAGO" && message.application_id);
      if (lastJago?.application_id) setContextApplicationId(lastJago.application_id);
    }).catch((err) => {
      if (mounted) setError(err instanceof Error ? err.message : "JAGO could not load.");
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleAction = (action: JagoClientAction) => {
    if (!action.href) return;
    onClose?.();
    router.push(action.href);
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text || isLoading) return;

    setInputText("");
    setError(null);
    setIsLoading(true);
    const studentMessage: JagoMessage = {
      id: `student-${Date.now()}`,
      sender: "STUDENT",
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, studentMessage]);

    try {
      const reply = await jagoApi.askQuestion(text, language, contextApplicationId);
      if (reply.application_id) setContextApplicationId(reply.application_id);
      setMessages((prev) => [...prev, reply]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "JAGO is temporarily unavailable.");
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = useMemo(() => {
    if (language === "hi") {
      return [
        "मेरी सभी अर्जी दिखाओ",
        "मेरी पेमेंट कहाँ तक पहुँची?",
        "आय प्रमाणपत्र अपलोड करना है",
        "मेरे लिए छात्रवृत्तियाँ खोजो",
      ];
    }
    return [
      "Show all my applications",
      "Where is my scholarship payment?",
      "I want to upload my income certificate",
      "Find scholarships for me",
    ];
  }, [language]);

  const shellClass = variant === "drawer"
    ? "h-full bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-2xl flex flex-col"
    : "flex flex-col h-[calc(100vh-170px)] min-h-[560px] bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm";

  return (
    <div className={shellClass} aria-label="JAGO application assistant">
      <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-sm shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-900">JAGO</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded-full">App Assistant</span>
            </div>
            <p className="text-[10px] text-slate-500 truncate">
              {language === "hi" ? "पूरे पोर्टल में खोजें, पूछें और सही जगह जाएँ" : "Ask, find, explain, and route through the whole portal"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setLanguage(language === "en" ? "hi" : "en")}
            className="text-[10px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            aria-label="Switch JAGO language"
          >
            {language === "en" ? "हिन्दी" : "EN"}
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Close JAGO">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {messages.length === 1 && messages[0].sender === "JAGO" && (
          <div className="rounded-2xl bg-gradient-to-br from-mota-900 to-mota-800 text-white p-3.5 shadow-sm border border-mota-700">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="text-xs font-bold">{language === "hi" ? "बोलिए, मैं ऐप संभाल लूँगा" : "Tell me what you need"}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-white/80">
              {language === "hi"
                ? "उदाहरण: ‘मेरी pending अर्जी दिखाओ’, ‘इनकम सर्टिफिकेट upload करो’, ‘मेरी payment track करो’, या ‘Post-Matric समझाओ’।"
                : "For example: “show my pending application”, “start income certificate upload”, “track my payment”, or “explain Post-Matric”."}
            </p>
          </div>
        )}

        {messages.map((msg, msgIndex) => {
          const isUser = msg.sender === "STUDENT";
          return (
            <div key={`${msg.id}-${msgIndex}`} className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${isUser ? "bg-mota-800 text-white" : "bg-amber-600 text-white shadow-xs"}`}>
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs leading-relaxed whitespace-pre-line ${isUser ? "bg-mota-800 text-white rounded-tr-none" : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"}`}>
                <div>{msg.text}</div>

                {msg.sources_cited && msg.sources_cited.length > 0 && !isUser && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Grounded records: {msg.sources_cited.slice(0, 3).map((source) => source.title).join(", ")}{msg.sources_cited.length > 3 ? ` +${msg.sources_cited.length - 3}` : ""}</span>
                  </div>
                )}

                {msg.actions && msg.actions.length > 0 && !isUser && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                    {msg.actions.slice(0, 6).map((action, i) => {
                      const Icon = actionIcon(action.href);
                      return (
                        <button
                          key={`${action.href}-${action.label}-${i}`}
                          type="button"
                          onClick={() => handleAction(action)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-[11px] border border-amber-200 transition-colors"
                        >
                          <Icon className="w-3 h-3" />
                          <span>{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {msg.suggested_followups && msg.suggested_followups.length > 0 && !isUser && (
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 block mb-1">{language === "hi" ? "इसके बाद पूछ सकते हैं" : "You can ask next"}</span>
                    <div className="flex flex-col gap-1">
                      {msg.suggested_followups.slice(0, 4).map((q, idx) => (
                        <button key={`${q}-${idx}`} type="button" onClick={() => handleSend(q)} className="text-left text-[11px] text-mota-700 hover:text-mota-900 hover:underline py-0.5">
                          › {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <span className={`block text-[9px] mt-1.5 text-right ${isUser ? "text-slate-300" : "text-slate-400"}`}>
                  {formatDateTime(msg.timestamp)}
                </span>
              </div>
            </div>
          );
        })}

        {error && (
          <div className="mx-auto max-w-[90%] rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
            JAGO: {error}
          </div>
        )}

        {isLoading && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0"><Bot className="w-4 h-4" /></div>
            <div className="bg-white rounded-2xl rounded-tl-none border border-slate-200 px-4 py-3 text-xs text-slate-500 shadow-xs flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce" />
              <div className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce" style={{ animationDelay: "300ms" }} />
              <span className="ml-2 text-slate-400">{language === "hi" ? "JAGO रिकॉर्ड जाँच रहा है…" : "JAGO is checking your records…"}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2 bg-white/80 border-t border-slate-200 flex gap-1.5 overflow-x-auto scrollbar-none">
        {quickPrompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => handleSend(prompt)} className="whitespace-nowrap px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200 text-[11px] transition-colors">
            {prompt}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void handleSend(); }} className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={language === "hi" ? "JAGO से बोलिए…" : "Tell JAGO what you want to do…"}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-mota-700 focus:border-mota-700"
            aria-label="Ask JAGO"
          />
        </div>
        <Button type="submit" size="sm" disabled={!inputText.trim() || isLoading} className="rounded-xl px-3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white shrink-0" aria-label="Send to JAGO">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
