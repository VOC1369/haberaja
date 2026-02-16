import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Trash2, Loader2, Bug, BookOpen, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DebugPanel } from "./DebugPanel";
import {
  type ChatMessage,
  type DebugBreakdown,
  streamChat,
  buildSystemPrompt,
  loadPromoList,
} from "@/lib/livechat-engine";
import type { PromoItem } from "@/components/VOCDashboard/PromoFormWizard/types";

function getDebounceSeconds(): number {
  const stored = localStorage.getItem("voc_debounce_seconds");
  if (stored) {
    const n = parseInt(stored, 10);
    if (!isNaN(n) && n >= 1 && n <= 15) return n;
  }
  return 3;
}

const STORAGE_KEY_MESSAGES = "voc_livechat_messages";
const STORAGE_KEY_SETTINGS = "voc_livechat_settings";
const MAX_PERSISTED_MESSAGES = 100;

function loadPersistedMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_PERSISTED_MESSAGES) : [];
  } catch { return []; }
}

function loadPersistedSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function LivechatTestConsole() {
  const savedSettings = loadPersistedSettings();
  const [messages, setMessages] = useState<ChatMessage[]>(loadPersistedMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [debugMode, setDebugMode] = useState(savedSettings?.debugMode ?? false);
  const [generalKBEnabled, setGeneralKBEnabled] = useState(savedSettings?.generalKBEnabled ?? false);
  const [behavioralKBEnabled, setBehavioralKBEnabled] = useState(savedSettings?.behavioralKBEnabled ?? true);
  const [promos, setPromos] = useState<PromoItem[]>([]);
  const [selectedPromoId, setSelectedPromoId] = useState<string>(savedSettings?.selectedPromoId ?? "none");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce state
  const pendingMessagesRef = useRef<ChatMessage[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [debounceCountdown, setDebounceCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load promo list
  useEffect(() => {
    loadPromoList().then(setPromos);
  }, []);

  // Persist messages to localStorage
  useEffect(() => {
    try {
      const toStore = messages.slice(-MAX_PERSISTED_MESSAGES);
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(toStore));
    } catch { /* storage full — ignore */ }
  }, [messages]);

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({
        debugMode, generalKBEnabled, behavioralKBEnabled, selectedPromoId,
      }));
    } catch { /* ignore */ }
  }, [debugMode, generalKBEnabled, behavioralKBEnabled, selectedPromoId]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, debounceCountdown]);

  const selectedPromo = selectedPromoId === 'all' ? null : (promos.find(p => p.id === selectedPromoId) || null);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  // Core send function — called when debounce timer expires
  const executeSend = useCallback(async (pendingMsgs: ChatMessage[]) => {
    if (pendingMsgs.length === 0) return;

    // Merge all pending messages into one content string
    const mergedContent = pendingMsgs.map(m => m.content).join("\n");

    setIsLoading(true);

    const systemPrompt = await buildSystemPrompt(selectedPromo, debugMode, {
      generalKBEnabled,
      behavioralKBEnabled,
      allPromos: selectedPromoId === 'all' ? promos : undefined,
    });

    // Build message history: all existing messages + merged user message
    const mergedUserMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: mergedContent,
      timestamp: new Date().toISOString(),
    };

    // For API, use all messages except the individual pending ones (they're already displayed),
    // and add the merged content as a single user message
    const historyMessages = messages.filter(m => !pendingMsgs.some(p => p.id === m.id));
    const apiMessages = [...historyMessages, mergedUserMsg].map(m => ({
      role: m.role,
      content: m.rawContent || m.content,
    }));

    let assistantContent = "";
    let debugData: DebugBreakdown | null = null;
    const assistantId = crypto.randomUUID();

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      
      let displayContent = assistantContent;
      if (debugMode && displayContent.includes('---DEBUG---')) {
        displayContent = displayContent.split('---DEBUG---')[0].trim();
      }
      // Strip [TICKET:...] marker from display
      displayContent = displayContent.replace(/\[TICKET:\w+:[^\]]+\]/g, '').trim();

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
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, debug: debugData } : m)
        );
      },
      () => {
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, rawContent: assistantContent } : m)
        );
        setIsLoading(false);
      },
      (error) => {
        setIsLoading(false);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `⚠️ Error: ${error}`,
          timestamp: new Date().toISOString(),
        }]);
      },
      selectedPromo,
      (ticketInfo) => {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `🎫 Ticket ${ticketInfo.ticket_number} (${ticketInfo.category}) berhasil dibuat. Cek di admin dashboard.`,
          timestamp: new Date().toISOString(),
          ticketCreated: ticketInfo,
        }]);
      },
    );
  }, [messages, selectedPromo, selectedPromoId, promos, debugMode, generalKBEnabled, behavioralKBEnabled]);

  // Debounced send — adds message to buffer and resets timer
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    // Show message immediately in chat
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    inputRef.current?.focus();

    // Add to pending buffer
    pendingMessagesRef.current = [...pendingMessagesRef.current, userMsg];

    // Clear existing timers
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    const debounceMs = getDebounceSeconds() * 1000;

    // Start countdown display
    setDebounceCountdown(getDebounceSeconds());
    const startTime = Date.now();
    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((debounceMs - elapsed) / 1000));
      setDebounceCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownIntervalRef.current!);
      }
    }, 200);

    // Set debounce timer
    debounceTimerRef.current = setTimeout(() => {
      const batch = [...pendingMessagesRef.current];
      pendingMessagesRef.current = [];
      setDebounceCountdown(null);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      executeSend(batch);
    }, debounceMs);
  }, [input, isLoading, executeSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY_MESSAGES);
    pendingMessagesRef.current = [];
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setDebounceCountdown(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  return (
    <div className="mx-auto max-w-[900px] w-full">
      <Card className="p-0 overflow-hidden h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <div className="shrink-0 p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-button-hover" />
            <h3 className="font-semibold text-button-hover font-serif">Livechat Test Console</h3>
          </div>
          <div className="flex items-center gap-4">
            {/* Promo Selector */}
            <Select value={selectedPromoId} onValueChange={setSelectedPromoId}>
              <SelectTrigger className="w-[220px] h-9 text-xs">
                <SelectValue placeholder="Pilih Promo KB..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Tanpa Promo —</SelectItem>
                <SelectItem value="all">— Semua Promo —</SelectItem>
                {promos.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.promo_name || p.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* General KB Toggle */}
            <div className="flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">General KB</span>
              <Switch checked={generalKBEnabled} onCheckedChange={setGeneralKBEnabled} />
            </div>

            {/* Behavioral KB Toggle */}
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">B-KB</span>
              <Switch checked={behavioralKBEnabled} onCheckedChange={setBehavioralKBEnabled} />
            </div>

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
        <div className="flex-1 min-h-0 overflow-y-auto p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-20">
                <p className="font-medium">Dev-only Livechat Test Console</p>
                <p className="mt-1 text-xs">Toggle General KB, pilih promo, aktifkan Debug Mode, lalu mulai chat.</p>
                <p className="mt-1 text-xs">Debounce: <strong>{getDebounceSeconds()}s</strong> — atur di API & Settings</p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className="max-w-[70%]">
                  <div
                    className={`rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-muted'
                        : 'bg-button-hover text-button-hover-foreground'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className={`text-xs mt-1 block ${
                    msg.role === 'user' ? 'text-muted-foreground' : 'text-muted-foreground text-right'
                  }`}>
                    {formatTime(msg.timestamp)}
                  </span>

                  {/* Debug Panel */}
                  {debugMode && msg.role === 'assistant' && (
                    msg.debug ? (
                      <DebugPanel debug={msg.debug} />
                    ) : !isLoading ? (
                      <div className="mt-2 text-xs text-muted-foreground italic">
                        ⚠️ Debug data tidak tersedia untuk response ini
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            ))}

            {/* Debounce waiting indicator */}
            {debounceCountdown !== null && debounceCountdown > 0 && !isLoading && (
              <div className="flex justify-end">
                <div className="bg-muted/60 border border-border rounded-lg px-4 py-2 text-xs text-muted-foreground flex items-center gap-2 animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Menunggu pesan lanjutan... ({debounceCountdown}s)
                </div>
              </div>
            )}

            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-end">
                <div className="bg-button-hover text-button-hover-foreground rounded-lg px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="shrink-0 px-4 py-3 border-t border-border">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pesan..."
              disabled={false}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              variant="outline"
              className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
