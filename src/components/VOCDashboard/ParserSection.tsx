/**
 * PARSER SECTION
 *
 * Flow: Raw text + multi-image → AI parser → clean structured text → Copy / Send to Pseudo Extractor
 *
 * RULES:
 * - Tidak generate JSON V.10
 * - Tidak classify
 * - Tidak write Supabase
 * - Tidak ubah schema
 * - Reuse UI patterns dari PseudoKnowledgeSection
 */

import { useState, useRef } from "react";
import { Loader2, Plus, X, ArrowUp, Copy, Send, Undo2, AlertTriangle, Wand2 } from "lucide-react";
import wolfclawIcon from "@/assets/wolfclaw-icon.png";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/notify";
import {
  deterministicPolish,
  checkIntegrity,
  polishLevel2,
  checkIntegrityLevel2,
} from "@/lib/promo-polisher";
import { MiniMarkdown } from "@/lib/mini-markdown";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PARSER_URL = `${SUPABASE_URL}/functions/v1/parser`;

export const PARSER_HANDOFF_KEY = "parser_handoff_text_v1";

interface ParserSectionProps {
  onSendToPseudo?: () => void;
}

export function ParserSection({ onSendToPseudo }: ParserSectionProps) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<{ id: string; preview: string; base64: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // result = displayed text (raw or polished). rawResult = baseline for Back-to-Raw.
  const [result, setResult] = useState<string | null>(null);
  const [rawResult, setRawResult] = useState<string | null>(null);
  // isPolished kept for backward-compat (LLM enhance path, currently unused in UI).
  const [isPolished, setIsPolished] = useState(false);
  const [isRestructured, setIsRestructured] = useState(false);
  const [polishWarning, setPolishWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = !isLoading && (text.trim().length > 0 || images.length > 0);

  // ── Image handling ────────────────────────────────────
  const processImageFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File terlalu besar. Maksimal 10MB");
      return;
    }
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Format tidak didukung. Gunakan PNG, JPG, atau WebP");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setImages((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, preview: base64, base64, name: file.name },
      ]);
    };
    reader.onerror = () => toast.error("Gagal membaca file");
    reader.readAsDataURL(file);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) await processImageFile(f);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
    for (const f of files) await processImageFile(f);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await processImageFile(file);
        }
      }
    }
  };

  const removeImage = (id: string) => setImages((prev) => prev.filter((i) => i.id !== id));

  // ── Submit ────────────────────────────────────────────
  const handleParse = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    setRawResult(null);
    setIsPolished(false);
    setIsRestructured(false);
    setPolishWarning(null);

    try {
      const resp = await fetch(PARSER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          text: text.trim(),
          images: images.map((i) => i.base64),
        }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const msg =
          body?.message ||
          body?.error ||
          `Parser gagal (HTTP ${resp.status}). Coba lagi.`;
        setError(msg);
        toast.error("Parser gagal", { description: msg });
        return;
      }

      const data = await resp.json();
      const output = (data?.output as string) || "";
      if (!output.trim()) {
        const msg = "Parser mengembalikan output kosong.";
        setError(msg);
        toast.error(msg);
        return;
      }

      // Step 1 — Deterministic polish (auto, silent, integrity-checked)
      let baseline = output;
      try {
        const cleaned = deterministicPolish(output);
        const integ = checkIntegrity(output, cleaned);
        if (integ.ok) baseline = cleaned;
        // kalau gagal integrity (mestinya tidak akan terjadi karena deterministic),
        // pakai output mentah parser.
      } catch {
        // safe fallback ke output mentah
      }

      setRawResult(baseline);
      setResult(baseline);
      setIsPolished(false);
      setIsRestructured(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setError(msg);
      toast.error("Parser gagal", { description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToRaw = () => {
    if (!rawResult) return;
    setResult(rawResult);
    setIsPolished(false);
    setIsRestructured(false);
    setPolishWarning(null);
  };

  // ── Polish (unified, deterministic, integrity-checked) ─
  // Internally: cleanup baseline (already applied) → Level 2 restructure
  // → integrity check → fallback to raw on failure.
  const handlePolish = () => {
    if (!rawResult) return;
    try {
      const restructured = polishLevel2(rawResult);
      const integ = checkIntegrityLevel2(rawResult, restructured);
      if (!integ.ok) {
        setPolishWarning(
          integ.reason || "Polish dibatalkan — integrity check gagal.",
        );
        toast.error("Polish dibatalkan", {
          description: "Integritas data tidak lolos. Tetap pakai versi asli.",
        });
        return;
      }
      setResult(restructured);
      setIsRestructured(true);
      setIsPolished(false);
      setPolishWarning(null);
      toast.success("Polished");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Polish gagal";
      toast.error("Polish gagal", { description: msg });
    }
  };

  // ── Result actions ────────────────────────────────────
  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      toast.success("Copied");
    } catch {
      toast.error("Gagal menyalin");
    }
  };

  const handleSendToPseudo = () => {
    if (!result) return;
    try {
      // Always send the raw parser baseline to extractor — never the polished/
      // restructured presentation layer (markdown markers would pollute parsing).
      const payload = rawResult ?? result;
      localStorage.setItem(PARSER_HANDOFF_KEY, payload);
      toast.success("Dikirim ke Pseudo Extractor");
      if (onSendToPseudo) onSendToPseudo();
    } catch {
      toast.error("Gagal mengirim ke Pseudo Extractor");
    }
  };

  const handleReset = () => {
    setText("");
    setImages([]);
    setResult(null);
    setRawResult(null);
    setIsPolished(false);
    setIsRestructured(false);
    setPolishWarning(null);
    setError(null);
  };

  // ── Render ────────────────────────────────────────────
  return (
    <div className="relative flex flex-col h-[calc(100vh-120px)]">
      <ScrollArea className="flex-1">
        <div
          className={`page-wrapper p-6 pb-20 ${
            !result && !isLoading ? "min-h-[calc(100vh-160px)] flex flex-col justify-center" : ""
          } space-y-6`}
        >
          {/* INPUT STATE */}
          {!result && !isLoading && (
            <Card className="p-8">
              <div className="flex flex-col items-center text-center gap-3 mb-8">
                <img src={wolfclawIcon} alt="Parser" className="h-12 w-12 rounded-xl" />
                <h2 className="text-2xl font-semibold text-foreground">Parser</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Paste text promo mentah dan/atau attach screenshot. Parser merapikan struktur tanpa
                  mengubah isi — siap dikirim ke Pseudo Extractor.
                </p>
                <Badge variant="outline" className="bg-success/10 text-success border-success/30 mt-1">
                  <span className="w-2 h-2 rounded-full bg-success mr-2" />
                  VOC Parser
                </Badge>
              </div>

              {/* Image previews */}
              {images.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-6 justify-center">
                  {images.map((img) => (
                    <div key={img.id} className="relative inline-block">
                      <img
                        src={img.preview}
                        alt={img.name}
                        className="h-32 w-32 object-cover rounded-lg border border-border shadow-sm"
                      />
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        className="absolute -top-2 -right-2 rounded-full"
                        onClick={() => removeImage(img.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Unified input */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`relative rounded-2xl border bg-background transition-colors ${
                  isDragOver
                    ? "border-button-hover bg-button-hover/5"
                    : "border-border hover:border-border/80"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />

                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && canSubmit) {
                      e.preventDefault();
                      handleParse();
                    }
                  }}
                  placeholder={
                    isDragOver
                      ? "Lepaskan untuk upload screenshot…"
                      : "Paste text promo mentah di sini..."
                  }
                  className="min-h-40 max-h-80 resize-none border-0 bg-transparent px-5 pt-5 pb-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                  disabled={isLoading}
                />

                <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="h-9 w-9 rounded-full bg-muted hover:bg-muted/80 text-foreground shrink-0"
                    title="Lampirkan screenshot (multi-image)"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="golden"
                    size="icon"
                    onClick={handleParse}
                    disabled={!canSubmit}
                    className="h-9 w-9 rounded-full shrink-0"
                    title="Jalankan Parser (Enter)"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="mt-6">
                <p className="text-xs text-muted-foreground">
                  Parser menggunakan AI dan bisa keliru. Cek hasil sebelum kirim ke extractor.
                </p>
              </div>
            </Card>
          )}

          {/* LOADING STATE */}
          {isLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="rounded-xl border border-border bg-muted/40 p-5 space-y-4 w-full max-w-3xl pointer-events-auto">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-10 w-10 rounded-full bg-button-hover/15 flex items-center justify-center shrink-0">
                    <Loader2 className="h-5 w-5 text-button-hover animate-spin" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      Parser sedang membersihkan dan menyusun promo…
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Membaca text dan {images.length} image. Estimasi 10–30 detik.
                    </div>
                  </div>
                </div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="parser-shimmer absolute inset-y-0 w-1/3 rounded-full bg-button-hover" />
                </div>
                <style>{`
                  @keyframes parser-shimmer-slide {
                    0%   { left: -33%; }
                    100% { left: 100%; }
                  }
                  .parser-shimmer {
                    animation: parser-shimmer-slide 1.4s ease-in-out infinite;
                  }
                `}</style>
              </div>
            </div>
          )}

          {/* RESULT STATE */}
          {result && !isLoading && (
            <div className="space-y-4">
              <div className="relative rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={
                        isPolished || isRestructured
                          ? "bg-button-hover/10 text-button-hover border-button-hover/30"
                          : "bg-success/10 text-success border-success/30"
                      }
                    >
                      {isPolished || isRestructured ? "Polished" : "Parser Result"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {result.length} karakter
                    </span>
                    {polishWarning && (
                      <Badge
                        variant="outline"
                        className="bg-warning/10 text-warning border-warning/40 gap-1"
                        title={polishWarning}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Polish skipped — integrity check failed
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isPolished || isRestructured ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBackToRaw}
                        title="Kembalikan ke versi asli parser"
                        className="rounded-full gap-1.5 h-8"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        Back to Raw
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePolish}
                        disabled={!rawResult}
                        title="Rapikan tampilan (deterministic, tidak mengubah data)"
                        className="rounded-full gap-1.5 h-8 text-button-hover hover:text-button-hover hover:bg-button-hover/10"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        Polish
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleCopy}
                      title="Copy hasil parser"
                      className="rounded-full"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {isRestructured ? (
                  <MiniMarkdown
                    text={result}
                    className="px-5 py-4 text-sm text-foreground leading-relaxed"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap break-words px-5 py-4 text-sm text-foreground font-mono leading-relaxed">
                    {result}
                  </pre>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Button variant="outline" onClick={handleReset} className="rounded-full">
                  <X className="h-4 w-4" />
                  Mulai ulang
                </Button>
                <Button variant="golden" onClick={handleSendToPseudo} className="rounded-full">
                  <Send className="h-4 w-4" />
                  Send to Pseudo Extractor
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
