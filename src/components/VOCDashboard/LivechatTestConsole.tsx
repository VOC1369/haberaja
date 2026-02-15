import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Trash2, Loader2, Bug } from "lucide-react";
import { DebugPanel } from "./DebugPanel";
import {
  type ChatMessage,
  type DebugBreakdown,
  streamChat,
  buildSystemPrompt,
  loadPromoList,
} from "@/lib/livechat-engine";
import type { PromoItem } from "@/components/VOCDashboard/PromoFormWizard/types";

export function LivechatTestConsole() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [promos, setPromos] = useState<PromoItem[]>([]);
  const [selectedPromoId, setSelectedPromoId] = useState<string>("none");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load promo list
  useEffect(() => {
    loadPromoList().then(setPromos);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedPromo = promos.find(p => p.id === selectedPromoId) || null;

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const systemPrompt = await buildSystemPrompt(selectedPromo, debugMode);

    // Build message history for API
    const apiMessages = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    let assistantContent = "";
    let debugData: DebugBreakdown | null = null;
    const assistantId = crypto.randomUUID();

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      
      // Strip debug section from displayed content
      let displayContent = assistantContent;
      if (debugMode && displayContent.includes('---DEBUG---')) {
        displayContent = displayContent.split('---DEBUG---')[0].trim();
      }

      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.id === assistantId) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: displayContent } : m
          );
        }
        return [...prev, {
          id: assistantId,
          role: 'assistant' as const,
          content: displayContent,
          timestamp: new Date().toISOString(),
        }];
      });
    };

    await streamChat(
      apiMessages,
      systemPrompt,
      debugMode,
      updateAssistant,
      (debug) => {
        debugData = debug;
        // Attach debug to the assistant message
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, debug: debugData } : m)
        );
      },
      () => setIsLoading(false),
      (error) => {
        setIsLoading(false);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `⚠️ Error: ${error}`,
          timestamp: new Date().toISOString(),
        }]);
      },
    );
  }, [input, isLoading, messages, selectedPromo, debugMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-60px)] max-w-[900px] mx-auto w-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-button-hover" />
          <h2 className="text-lg font-semibold text-foreground font-serif">Livechat Test Console</h2>
        </div>
        <div className="flex items-center gap-4">
          {/* Promo Selector */}
          <Select value={selectedPromoId} onValueChange={setSelectedPromoId}>
            <SelectTrigger className="w-[220px] h-9 text-xs">
              <SelectValue placeholder="Pilih Promo KB..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Tanpa Promo —</SelectItem>
              {promos.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.promo_name || p.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Debug Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Debug</span>
            <Switch checked={debugMode} onCheckedChange={setDebugMode} />
          </div>

          {/* Clear */}
          <Button variant="ghost" size="icon-sm" onClick={handleClear} title="Clear chat">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 min-h-0 overflow-y-auto" ref={scrollRef}>
        <div className="p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-20">
              <p className="font-mono">Dev-only Livechat Test Console</p>
              <p className="mt-1 text-xs">Pilih promo dari KB, toggle Debug Mode, lalu mulai chat.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className="max-w-[85%]">
                <div
                  className={`rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-muted/50 text-foreground'
                      : 'bg-button-hover/10 border border-button-hover/20 text-foreground'
                  }`}
                >
                  {msg.content}
                </div>

                {/* Debug Panel */}
                {debugMode && msg.role === 'assistant' && msg.debug && (
                  <DebugPanel debug={msg.debug} />
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-end">
              <div className="bg-button-hover/10 border border-button-hover/20 rounded-xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-button-hover" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-border px-6 py-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pesan..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            variant="golden"
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
