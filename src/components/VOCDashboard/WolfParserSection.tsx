/**
 * WolfParserSection — V0.9
 *
 * UI mengikuti pattern visual lama (ParserDataSection):
 *   - page-wrapper centered shell
 *   - Smart Data Parser header card (wolfclaw icon + Wolfclaw AI badge)
 *   - Unified input area (textarea + attach + tombol panah golden)
 *   - Reset bar setelah ada hasil
 *   - GapReportCard (Collapsible) → operator isi gaps
 *   - StructuredDataCard (Collapsible) → grid field parsed_promo
 *   - Clean Text + Parser JSON cards dengan Copy buttons
 *
 * ENGINE V0.9 TIDAK DISENTUH. Hanya layer presentasi.
 */

import { useState, useRef, useMemo, useEffect } from "react";
import {
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  Copy,
  FileText,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { toast } from "@/lib/notify";
import wolfclawIcon from "@/assets/wolfclaw-icon.png";

import {
  runWolfParser,
  applyOperatorAnswers,
} from "@/lib/parsers/wolf-parser";
import type {
  ParserOutput,
  ParsedPromo,
  Gap,
  OperatorAnswer,
} from "@/lib/parsers/wolf-parser-types";
import {
  AICreditsExhaustedError,
  AIRateLimitError,
  AIOverloadedError,
} from "@/lib/ai-client";

const MAX_SCREENSHOTS = 4;

// Field order untuk grid Data Terstruktur — nama field PERSIS V0.9 contract.
const FIELD_KEYS: Array<keyof ParsedPromo> = [
  "promo_name",
  "promo_type",
  "client_id",
  "target_user",
  "valid_from",
  "valid_until",
  "platform_access",
  "geo_restriction",
  "min_deposit",
  "max_bonus",
  "max_bonus_unlimited",
  "has_turnover",
  "is_tiered",
  "reward_type_hint",
  "calculation_basis",
  "calculation_value",
  "turnover_requirement",
  "claim_method",
  "game_types",
  "game_exclusions",
  "parse_confidence",
  "ambiguity_flags",
];

// Human-readable label per field (Title Case) — mirror Extractor label style.
const FIELD_LABELS: Record<keyof ParsedPromo, string> = {
  promo_name: "Nama Promo",
  promo_type: "Tipe Promo",
  client_id: "Client",
  target_user: "Target User",
  valid_from: "Valid From",
  valid_until: "Valid Until",
  platform_access: "Platform",
  geo_restriction: "Geo Restriction",
  min_deposit: "Min Deposit",
  max_bonus: "Max Bonus",
  max_bonus_unlimited: "Max Bonus Unlimited",
  has_turnover: "Ada Turnover",
  is_tiered: "Tiered",
  reward_type_hint: "Reward Type",
  calculation_basis: "Calculation Basis",
  calculation_value: "Calculation Value",
  turnover_requirement: "Turnover Requirement",
  claim_method: "Claim Method",
  game_types: "Jenis Game",
  game_types_human: "Jenis Game (Definisi)",
  game_exclusions: "Blacklist Game",
  game_exclusions_human: "Blacklist Game (Definisi)",
  parse_confidence: "Parse Confidence",
  ambiguity_flags: "Ambiguity Flags",
  source_evidence_map: "Evidence Map",
  value_status_map: "Value Status",
  needs_operator_fill_map: "Needs Fill",
  clean_text: "Clean Text",
};

type AnswerEntry = {
  radio_value: string;
  memo: string;
};

export function WolfParserSection() {
  const [inputText, setInputText] = useState("");
  const [parserOutput, setParserOutput] = useState<ParserOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeElapsedMs, setAnalyzeElapsedMs] = useState(0);
  const [gapAnswers, setGapAnswers] = useState<Record<string, AnswerEntry>>({});
  const [residualNotice, setResidualNotice] = useState<string | null>(null);
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const screenshotInputRef = useRef<HTMLInputElement | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const hasInput = inputText.trim().length > 0;

  // Elapsed timer (mirror pattern lama)
  useEffect(() => {
    if (isAnalyzing) {
      setAnalyzeElapsedMs(0);
      const start = Date.now();
      elapsedTimerRef.current = setInterval(() => {
        setAnalyzeElapsedMs(Date.now() - start);
      }, 250);
    } else if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [isAnalyzing]);

  function handleScreenshotDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }
  function handleScreenshotDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }
  function handleScreenshotDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (dropped.length === 0) return;
    setScreenshotFiles((prev) => {
      const room = MAX_SCREENSHOTS - prev.length;
      if (room <= 0) {
        toast.warning(`Maksimal ${MAX_SCREENSHOTS} screenshot`);
        return prev;
      }
      return [...prev, ...dropped.slice(0, room)];
    });
  }

  function handleReset() {
    setInputText("");
    setParserOutput(null);
    setGapAnswers({});
    setScreenshotFiles([]);
  }

  async function handleAnalyze() {
    if (!hasInput || isAnalyzing) return;
    setIsAnalyzing(true);
    setResidualNotice(null);
    try {
      const result = await runWolfParser(inputText);
      setParserOutput(result);
      setGapAnswers({});
      toast.success("Parser selesai", {
        description:
          result.gaps.length > 0
            ? `${result.gaps.length} gap perlu diisi.`
            : "Tidak ada gap.",
      });
    } catch (err) {
      handleAIError(err);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleCancelAnalyze() {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsAnalyzing(false);
  }

  async function handleConfirmGapFills() {
    if (!parserOutput) return;

    // Validate: minimal radio_value dipilih untuk gap wajib
    const requiredGaps = parserOutput.gaps.filter(
      (g) => g.gap_type === "required_missing" || g.gap_type === "ambiguous",
    );
    const incomplete = requiredGaps.filter(
      (g) => !gapAnswers[g.field]?.radio_value,
    );
    if (incomplete.length > 0) {
      toast.warning("Belum ada jawaban", {
        description:
          "Pilih jawaban untuk: " +
          incomplete.map((g) => g.field).join(", "),
      });
      return;
    }

    const payload: OperatorAnswer[] = parserOutput.gaps
      .filter((g) => gapAnswers[g.field]?.radio_value)
      .map((g) => ({
        field: g.field,
        radio_value: gapAnswers[g.field]?.radio_value ?? "",
        memo: gapAnswers[g.field]?.memo ?? "",
      }));

    if (!payload.length) {
      toast.warning("Belum ada jawaban", {
        description: "Isi minimal satu gap.",
      });
      return;
    }

    setIsAnalyzing(true);
    setResidualNotice(null);
    try {
      const result = await applyOperatorAnswers(parserOutput, payload, inputText);
      setParserOutput(result);
      if (result.gaps.length === 0) {
        toast.success("Parser final", {
          description: "Semua gap terjawab.",
        });
      } else {
        // RULE B.1 — Honest residual gap dari Mode 2.
        // Stay di stage "questions" (parserOutput preserved, gaps[] residual
        // di-render ulang). Reset answers untuk gap baru.
        setGapAnswers({});
        setResidualNotice(
          "Wolfclaw butuh klarifikasi tambahan. Mohon isi pertanyaan berikut.",
        );
        toast.info("Masih ada gap", {
          description: `${result.gaps.length} pertanyaan tersisa.`,
        });
      }
    } catch (err) {
      handleAIError(err);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleCopyJSON() {
    if (!parserOutput) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(parserOutput, null, 2));
      toast.success("Parser JSON disalin");
    } catch (err) {
      console.error("[clipboard] copy failed:", err);
      toast.error("Gagal copy ke clipboard", {
        description:
          "Browser mungkin block clipboard access. Silakan copy manual.",
      });
    }
  }

  async function handleCopyCleanText() {
    if (!parserOutput) return;
    try {
      await navigator.clipboard.writeText(
        parserOutput.parsed_promo.clean_text || "",
      );
      toast.success("Clean text disalin");
    } catch (err) {
      console.error("[clipboard] copy failed:", err);
      toast.error("Gagal copy ke clipboard", {
        description:
          "Browser mungkin block clipboard access. Silakan copy manual.",
      });
    }
  }

  return (
    <div
      className={`page-wrapper p-6 space-y-6 relative ${
        !parserOutput
          ? "min-h-[calc(100vh-220px)] flex flex-col justify-center"
          : "pb-20"
      }`}
    >
      {/* ─── INPUT AREA — hidden saat loading / ada hasil ─── */}
      {!parserOutput && !isAnalyzing && (
        <Card className="p-8">
          {/* Header — vertically stacked & centered */}
          <div className="flex flex-col items-center text-center gap-3 mb-8">
            <img
              src={wolfclawIcon}
              alt="Wolfclaw"
              className="h-12 w-12 rounded-xl"
            />
            <h1 className="text-2xl font-semibold text-foreground">
              Smart Data Parser
            </h1>
            <p className="text-sm text-muted-foreground max-w-md">
              Teknologi AI terdepan kami, dirancang untuk berpikir strategis,
              akurasi tinggi, dan eksekusi efektif.
            </p>
            <Badge className="h-auto px-3 py-1 text-xs font-semibold rounded-full border-0 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2" />
              Wolfclaw AI
            </Badge>
          </div>

          {/* Unified input field */}
          <div
            onDragOver={handleScreenshotDragOver}
            onDragLeave={handleScreenshotDragLeave}
            onDrop={handleScreenshotDrop}
            className={`relative rounded-2xl border bg-background transition-colors ${
              isDragOver
                ? "border-button-hover bg-button-hover/5"
                : "border-border hover:border-border/80"
            }`}
          >
            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []).filter((f) =>
                  f.type.startsWith("image/"),
                );
                if (picked.length > 0) {
                  setScreenshotFiles((prev) => {
                    if (prev.length >= MAX_SCREENSHOTS) {
                      toast.warning(`Maksimal ${MAX_SCREENSHOTS} screenshot`);
                      return prev;
                    }
                    const room = MAX_SCREENSHOTS - prev.length;
                    return [...prev, ...picked.slice(0, room)];
                  });
                }
                if (e.target) e.target.value = "";
              }}
            />

            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isDragOver
                  ? "Lepaskan untuk upload screenshot…"
                  : "Silahkan paste image dan text disini. Sisanya Wolfclaw akan handle...."
              }
              className="min-h-40 max-h-80 resize-none border-0 bg-transparent px-5 pt-5 pb-4 focus-visible:ring-0 focus-visible:ring-offset-0 scrollbar-thin-custom"
              disabled={isAnalyzing}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  hasInput &&
                  !isAnalyzing
                ) {
                  e.preventDefault();
                  handleAnalyze();
                }
              }}
            />

            {screenshotFiles.length > 0 && (
              <div className="px-3 pb-2 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {screenshotFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="relative w-[110px] aspect-video rounded-md overflow-hidden border border-border bg-muted group"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Screenshot ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                        <p className="text-[10px] leading-tight text-white truncate">
                          {file.name || `Screenshot ${idx + 1}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setScreenshotFiles((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        disabled={isAnalyzing}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] leading-none"
                        aria-label={`Hapus screenshot ${idx + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {screenshotFiles.length < MAX_SCREENSHOTS && (
                    <button
                      type="button"
                      onClick={() => screenshotInputRef.current?.click()}
                      disabled={isAnalyzing}
                      className="w-[110px] aspect-video border border-dashed border-border rounded-md text-[10px] text-muted-foreground hover:border-button-hover hover:text-button-hover transition-colors flex flex-col items-center justify-center gap-1"
                    >
                      <ImagePlus className="h-3 w-3" />
                      <span>
                        Tambah ({screenshotFiles.length}/{MAX_SCREENSHOTS})
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => screenshotInputRef.current?.click()}
                  disabled={
                    isAnalyzing || screenshotFiles.length >= MAX_SCREENSHOTS
                  }
                  className="h-9 w-9 rounded-full bg-muted hover:bg-muted/80 text-foreground shrink-0"
                  title={
                    screenshotFiles.length >= MAX_SCREENSHOTS
                      ? `Maksimal ${MAX_SCREENSHOTS} screenshot`
                      : "Lampirkan screenshot"
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>

                {screenshotFiles.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {screenshotFiles.length}/{MAX_SCREENSHOTS} screenshot
                  </span>
                )}
              </div>

              <Button
                type="button"
                variant="golden"
                size="icon"
                onClick={handleAnalyze}
                disabled={!hasInput || isAnalyzing}
                className="h-9 w-9 rounded-full shrink-0"
                title="Analisis (Enter)"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs text-muted-foreground">
              Wolfclaw menggunakan AI dan bisa melakukan kesalahan. Pastikan
              lakukan pengecekan ganda.
            </p>
          </div>
        </Card>
      )}

      {/* ─── PROCESSING STATE ─── */}
      {isAnalyzing && (
        <div className="fixed left-[var(--sidebar-width)] right-0 top-[57px] bottom-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div className="rounded-xl border border-border bg-muted/40 p-5 space-y-4 w-full max-w-3xl pointer-events-auto">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative h-10 w-10 rounded-full bg-button-hover/15 flex items-center justify-center shrink-0">
                  <Loader2 className="h-5 w-5 text-button-hover animate-spin" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">
                    VOC Wolf sedang menganalisis…
                  </div>
                  <div className="text-xs text-muted-foreground">
                    VOC Wolf Parser sedang memproses input. Estimasi 5–15 detik.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div
                  className="text-sm font-mono tabular-nums text-foreground"
                  aria-live="polite"
                >
                  {(() => {
                    const totalSec = Math.floor(analyzeElapsedMs / 1000);
                    const mm = String(Math.floor(totalSec / 60)).padStart(
                      2,
                      "0",
                    );
                    const ss = String(totalSec % 60).padStart(2, "0");
                    return `${mm}:${ss}`;
                  })()}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelAnalyze}
                  className="rounded-full"
                >
                  <X className="h-3.5 w-3.5" />
                  Batal
                </Button>
              </div>
            </div>

            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="parser-shimmer absolute inset-y-0 w-1/3 rounded-full bg-button-hover" />
            </div>
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
      )}

      {/* ─── HASIL PARSER ─── */}
      {parserOutput && !isAnalyzing && (
        <>
          {parserOutput.gaps.length > 0 && (
            <GapReportCard
              gaps={parserOutput.gaps}
              fills={gapAnswers}
              residualNotice={residualNotice}
              onFillChange={(field, entry) =>
                setGapAnswers((prev) => ({ ...prev, [field]: entry }))
              }
              onConfirm={handleConfirmGapFills}
            />
          )}

          <StructuredDataCard promo={parserOutput.parsed_promo} />

          <CleanTextCard
            cleanText={parserOutput.parsed_promo.clean_text}
          />

          <ParserJSONCard output={parserOutput} />
        </>
      )}

      {/* FIXED ACTION BAR — pattern from PseudoKnowledgeSection (Extractor) */}
      {parserOutput && !isAnalyzing && (
        <div className="footer-bar">
          <div className="footer-bar-content">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                className="h-11 px-6 gap-2 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
              >
                <RotateCcw className="w-4 h-4" />
                Restart
              </Button>
            </div>

            <div className="flex items-center gap-3" />

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleCopyCleanText}
                className="h-11 px-4 gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Clean Text
              </Button>
              <Button
                onClick={handleCopyJSON}
                variant="golden"
                className="h-11 px-6 gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy JSON Parser
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════
// SUB-COMPONENTS — pattern visual lama
// ════════════════════════════════════════════════════

function GapReportCard({
  gaps,
  fills,
  residualNotice,
  onFillChange,
  onConfirm,
}: {
  gaps: Gap[];
  fills: Record<string, AnswerEntry>;
  residualNotice: string | null;
  onFillChange: (field: string, entry: AnswerEntry) => void;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(true);
  const requiredCount = gaps.filter(
    (g) => g.gap_type === "required_missing" || g.gap_type === "ambiguous",
  ).length;
  const optionalCount = gaps.filter(
    (g) => g.gap_type === "optional_missing",
  ).length;

  const requiredGaps = gaps.filter(
    (g) => g.gap_type === "required_missing" || g.gap_type === "ambiguous",
  );
  const isConfirmDisabled =
    requiredGaps.length > 0 &&
    requiredGaps.some((g) => {
      const entry = fills[g.field];
      return !entry?.radio_value || entry.radio_value.trim().length < 1;
    });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="p-0 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full p-6 flex items-center justify-between hover:bg-muted transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div className="text-base font-medium text-foreground">
                Data yang Perlu Dilengkapi
              </div>
            </div>
            <div className="flex items-center gap-2">
              {requiredCount > 0 && (
                <Badge className="h-auto px-3 py-1 text-xs font-semibold rounded-full border-0 bg-rose-500/15 text-rose-400 hover:bg-rose-500/15">
                  {requiredCount} Wajib
                </Badge>
              )}
              {optionalCount > 0 && (
                <Badge className="h-auto px-3 py-1 text-xs font-semibold rounded-full border-0 bg-amber-500/15 text-amber-400 hover:bg-amber-500/15">
                  {optionalCount} Opsional
                </Badge>
              )}
              <ChevronDown
                className={`h-5 w-5 text-muted-foreground transition-transform ml-1 ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-6 pt-4 border-t border-border space-y-6">
            {residualNotice && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
                {residualNotice}
              </div>
            )}

            {gaps.map((gap, idx) => (
              <GapItem
                key={`${gap.field}-${idx}`}
                gap={gap}
                entry={fills[gap.field] ?? { radio_value: "", memo: "" }}
                onChange={(entry) => onFillChange(gap.field, entry)}
              />
            ))}

            <Button
              className={
                isConfirmDisabled
                  ? "w-full mt-4 bg-muted text-foreground/50 cursor-not-allowed hover:bg-muted"
                  : "w-full mt-4"
              }
              variant={isConfirmDisabled ? "secondary" : "golden"}
              onClick={onConfirm}
              disabled={isConfirmDisabled}
            >
              ✓ Konfirmasi & Perbarui Data
            </Button>
            {isConfirmDisabled && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                Lengkapi data wajib di atas untuk mengaktifkan
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ────────────────────────────────────────────────────
// FIELD_OPTION_REGISTRY — UI fallback (presentation only).
// Tidak mengubah engine contract. Hanya inject opsi default
// kalau LLM kirim gap.options kosong.
// detailType: opsi yang trigger input tambahan.
//   "date"   → date input
//   "number" → numeric input
// ────────────────────────────────────────────────────
type DetailType = "date" | "number";
interface OptionRegistry {
  options: string[];
  /** opsi tertentu → tipe input detail tambahan */
  detail?: Record<string, DetailType>;
}

const FIELD_OPTION_REGISTRY: Record<string, OptionRegistry> = {
  valid_from: {
    options: [
      "hari_ini",
      "besok",
      "tanggal_tertentu",
      "x_hari_lalu",
      "tidak_disebutkan",
    ],
    detail: { tanggal_tertentu: "date", x_hari_lalu: "number" },
  },
  valid_until: {
    options: [
      "tidak_terbatas",
      "tanggal_tertentu",
      "x_hari_dari_mulai",
      "tidak_disebutkan",
    ],
    detail: { tanggal_tertentu: "date", x_hari_dari_mulai: "number" },
  },
  target_user: {
    options: ["new_member", "all", "vip", "existing_member", "tidak_disebutkan"],
  },
  claim_method: {
    options: ["auto", "manual", "tidak_disebutkan"],
  },
  platform_access: {
    options: ["web", "mobile", "apk", "semua_platform", "tidak_disebutkan"],
  },
  has_turnover: {
    options: ["ya", "tidak", "tidak_disebutkan"],
  },
  is_tiered: {
    options: ["ya", "tidak", "tidak_disebutkan"],
  },
  max_bonus_unlimited: {
    options: ["ya", "tidak", "tidak_disebutkan"],
  },
  calculation_basis: {
    options: ["deposit", "loss", "turnover", "tidak_disebutkan"],
  },
  reward_type_hint: {
    options: [
      "percentage",
      "fixed_amount",
      "percentage_range",
      "tidak_disebutkan",
    ],
  },
};

function formatOptionLabel(raw: string): string {
  if (!raw) return raw;
  // Preserve combined "value (detail)" — only format the value part.
  const match = raw.match(/^([^\s(]+)(\s*\(.*\))?$/);
  const base = match ? match[1] : raw;
  const rest = match && match[2] ? match[2] : "";
  const formatted = base
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return formatted + rest;
}

function GapItem({
  gap,
  entry,
  onChange,
}: {
  gap: Gap;
  entry: AnswerEntry;
  onChange: (entry: AnswerEntry) => void;
}) {
  const isRequired =
    gap.gap_type === "required_missing" || gap.gap_type === "ambiguous";
  const dotClass = isRequired ? "bg-destructive" : "bg-warning";

  // Effective options: pakai opsi LLM kalau ada, fallback ke registry UI.
  const registry = FIELD_OPTION_REGISTRY[gap.field];
  const effectiveOptions: string[] =
    gap.options.length > 0 ? gap.options : registry?.options ?? [];
  const hasOptions = effectiveOptions.length > 0;

  // Local state untuk radio + detail input + memo.
  // Reset ketika entry direset oleh parent (residual gap flow).
  const [selectedOpt, setSelectedOpt] = useState("");
  const [detailValue, setDetailValue] = useState("");
  const [memoValue, setMemoValue] = useState("");
  const [textValue, setTextValue] = useState("");

  // Sync turun: kalau parent reset entry → bersihkan lokal.
  useEffect(() => {
    if (!entry.radio_value && !entry.memo) {
      setSelectedOpt("");
      setDetailValue("");
      setMemoValue("");
      setTextValue("");
    }
  }, [entry.radio_value, entry.memo]);

  const detailType: DetailType | undefined = selectedOpt
    ? registry?.detail?.[selectedOpt]
    : undefined;

  // Sync radio + detail → parent.radio_value, memo → parent.memo.
  useEffect(() => {
    if (!hasOptions) return;
    if (!selectedOpt) {
      onChange({ radio_value: "", memo: memoValue.trim() });
      return;
    }
    const trimmedDetail = detailValue.trim();
    const radioValue =
      detailType && trimmedDetail
        ? `${selectedOpt} (${trimmedDetail})`
        : selectedOpt;
    onChange({ radio_value: radioValue, memo: memoValue.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOpt, detailValue, memoValue, hasOptions]);

  // Sync text-only → parent (radio_value = textValue, memo = "").
  useEffect(() => {
    if (hasOptions) return;
    onChange({ radio_value: textValue.trim(), memo: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textValue, hasOptions]);

  return (
    <div className="bg-muted rounded-lg px-6 py-4 space-y-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`}
          />
          <span className="text-sm font-medium text-foreground leading-snug">
            {gap.question}
          </span>
        </div>
        <Badge
          className={
            "flex-shrink-0 h-auto px-3 py-1 text-xs font-semibold rounded-full border-0 " +
            (isRequired
              ? "bg-rose-500/15 text-rose-400 hover:bg-rose-500/15"
              : "bg-amber-500/15 text-amber-400 hover:bg-amber-500/15")
          }
        >
          {isRequired ? "Wajib" : "Opsional"}
        </Badge>
      </div>

      <div>
        {hasOptions ? (
          <>
            <RadioGroup
              value={selectedOpt}
              onValueChange={(v) => {
                setSelectedOpt(v);
                setDetailValue("");
              }}
              className={
                effectiveOptions.length >= 4
                  ? "grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mt-2"
                  : "space-y-2 mt-2"
              }
            >
              {effectiveOptions.map((opt, idx) => {
                const id = `${gap.field}-opt-${idx}`;
                const isSelected = selectedOpt === opt;
                return (
                  <div key={idx} className="flex items-center space-x-2 group">
                    <RadioGroupItem value={opt} id={id} />
                    <Label
                      htmlFor={id}
                      className={
                        "cursor-pointer font-normal text-sm transition-colors group-hover:text-foreground/90 " +
                        (isSelected
                          ? "text-foreground font-medium"
                          : "text-muted-foreground")
                      }
                    >
                      {formatOptionLabel(opt)}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>

            {detailType && (
              <div className="mt-3 space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {detailType === "date"
                    ? "Tanggal (opsional)"
                    : "Jumlah hari (opsional)"}
                </Label>
                <Input
                  type={detailType === "date" ? "date" : "number"}
                  value={detailValue}
                  onChange={(e) => setDetailValue(e.target.value)}
                  placeholder={
                    detailType === "date" ? "YYYY-MM-DD" : "Contoh: 7"
                  }
                  className="rounded-lg bg-background"
                />
              </div>
            )}

            <div className="mt-3 space-y-1">
              <Label className="text-xs text-muted-foreground">
                Catatan / Memo (opsional)
              </Label>
              <Textarea
                value={memoValue}
                onChange={(e) => setMemoValue(e.target.value)}
                placeholder="Tambahan detail jika perlu (mis. tanggal spesifik, konteks promo, dll). Wolfclaw akan analisa memo bersama radio pilihan kamu."
                rows={2}
                className="rounded-lg bg-background resize-none"
              />
            </div>
          </>
        ) : (
          <>
            <Input
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Isi nilai..."
              className="rounded-lg bg-background"
            />
            <div className="mt-3 space-y-1">
              <Label className="text-xs text-muted-foreground">
                Catatan / Memo (opsional)
              </Label>
              <Textarea
                value={memoValue}
                onChange={(e) => setMemoValue(e.target.value)}
                placeholder="Tambahan detail jika perlu. Wolfclaw akan analisa memo bersama jawaban kamu."
                rows={2}
                className="rounded-lg bg-background resize-none"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StructuredDataCard({ promo }: { promo: ParsedPromo }) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="p-0 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full p-6 flex items-center justify-between hover:bg-muted transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-button-hover" />
              <div>
                <div className="text-base font-medium text-foreground">
                  Data Terstruktur
                </div>
                <div className="text-sm text-muted-foreground">
                  parsed_promo (V0.9)
                </div>
              </div>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-6 pt-4 border-t border-border space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {FIELD_KEYS.map((key) => {
                const status = promo.value_status_map?.[key as string];
                const rendered = renderParserValue(key, promo[key], status);
                return (
                  <div key={key} className="bg-muted rounded-lg p-3">
                    <span className="text-muted-foreground text-xs block mb-1">
                      {FIELD_LABELS[key] ?? key}
                    </span>
                    <span className={`break-words text-sm ${rendered.className}`}>
                      {rendered.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function CleanTextCard({
  cleanText,
}: {
  cleanText: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="p-0 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full p-6 flex items-center justify-between hover:bg-muted transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-button-hover" />
              <div>
                <div className="text-base font-medium text-foreground">
                  Clean Text
                </div>
                <div className="text-sm text-muted-foreground">
                  Output #1 — clean_text
                </div>
              </div>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-6 pt-4 border-t border-border space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <pre className="text-sm whitespace-pre-wrap break-words font-mono text-foreground">
                {cleanText || "(kosong)"}
              </pre>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function ParserJSONCard({
  output,
}: {
  output: ParserOutput;
}) {
  const [open, setOpen] = useState(false);
  const jsonString = useMemo(() => JSON.stringify(output, null, 2), [output]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="p-0 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full p-6 flex items-center justify-between hover:bg-muted transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-button-hover" />
              <div>
                <div className="text-base font-medium text-foreground">
                  Parser JSON
                </div>
                <div className="text-sm text-muted-foreground">
                  Output #2 — parser_json (schema_version {output.schema_version})
                </div>
              </div>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-6 pt-4 border-t border-border space-y-4">
            <div className="bg-muted rounded-lg p-4 max-h-[600px] overflow-auto">
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                {jsonString}
              </pre>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : value.join(", ");
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value || "—";
  return JSON.stringify(value);
}

/**
 * Renderer value untuk Parser RESULT card.
 *
 * Membaca KOMBINASI: value + value_status_map untuk membedakan:
 *   - explicit / ambiguous / not_stated / not_applicable
 *
 * Display rules:
 *   - null + not_applicable → "Tidak Relevan" (muted, NON-italic)
 *   - null + ambiguous      → "Ambigu" (warning)
 *   - null + not_stated/?   → "Tidak Disebutkan" (muted italic)
 *   - boolean true/false    → "Ya" / "Tidak"
 *   - "hari_ini"            → "Hari Ini"
 *   - "tidak_terbatas"      → "Tidak Terbatas"
 *   - client_id             → preserve original casing (e.g. "SLOT25")
 *   - snake_case enum       → Title Case
 *   - array kosong          → "-"
 *   - array isi             → join comma
 */
type ValueStatus = "explicit" | "ambiguous" | "not_stated" | "not_applicable";

const STRING_LABEL_MAP: Record<string, string> = {
  hari_ini: "Hari Ini",
  tidak_terbatas: "Tidak Terbatas",
  tidak_disebutkan: "Tidak Disebutkan",
};

const NULL_EXPLICIT_LABELS: Record<string, string> = {
  valid_until: "Berlaku Selamanya",
  max_bonus: "Unlimited",
};

const NULL_EXPLICIT_DEFAULT = "Sudah Dikonfirmasi";

function renderParserValue(
  key: keyof ParsedPromo,
  value: unknown,
  status?: ValueStatus | string,
): { text: string; className: string } {
  const notStated = { text: "Tidak Disebutkan", className: "text-muted-foreground/60 italic" };
  const notApplicable = { text: "Tidak Relevan", className: "text-muted-foreground" };
  const ambiguous = { text: "Ambigu", className: "text-warning font-medium" };

  // Null / undefined / empty string → resolve via value_status_map
  if (value === null || value === undefined || value === "") {
    if (status === "not_applicable") return notApplicable;
    if (status === "ambiguous") return ambiguous;

    // Rule D.9 — Jenis 2 (Open-ended) + Jenis 3 (Unlimited):
    // null + "explicit" = operator CONFIRMED value (not missing data)
    if (status === "explicit") {
      const label = NULL_EXPLICIT_LABELS[key as string] || NULL_EXPLICIT_DEFAULT;
      return { text: label, className: "text-emerald-400 font-medium" };
    }

    return notStated;
  }

  // Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      if (status === "not_applicable") return notApplicable;
      if (key === "ambiguity_flags") {
        return { text: "Tidak Ada", className: "text-muted-foreground" };
      }
      return { text: "-", className: "text-muted-foreground/60 italic" };
    }
    const joined = value.map((v) => String(v)).join(", ");
    if (key === "ambiguity_flags") {
      return { text: joined, className: "text-warning font-medium" };
    }
    if (key === "game_exclusions") {
      return { text: joined, className: "text-destructive font-medium" };
    }
    return { text: joined, className: "text-foreground font-medium" };
  }

  // Booleans → "Ya" / "Tidak"
  if (typeof value === "boolean") {
    return value
      ? { text: "Ya", className: "text-success font-semibold" }
      : { text: "Tidak", className: "text-muted-foreground font-medium" };
  }

  // Numeric — Rupiah / Confidence / generic
  if (typeof value === "number") {
    if (key === "parse_confidence") {
      const pct = value <= 1 ? Math.round(value * 100) : Math.round(value);
      return { text: `${pct}%`, className: "text-button-hover font-semibold" };
    }
    if (key === "min_deposit") {
      return {
        text: `Rp ${value.toLocaleString("id-ID")}`,
        className: "text-foreground font-medium",
      };
    }
    if (key === "max_bonus" || key === "calculation_value" || key === "turnover_requirement") {
      return {
        text:
          key === "calculation_value"
            ? String(value)
            : `Rp ${value.toLocaleString("id-ID")}`,
        className: "text-button-hover font-semibold",
      };
    }
    return { text: String(value), className: "text-foreground font-medium" };
  }

  // Strings
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "-") {
      if (status === "not_applicable") return notApplicable;
      if (status === "ambiguous") return ambiguous;
      return notStated;
    }

    // Preserve original casing for brand/identifier fields
    if (key === "client_id" || key === "promo_name") {
      return { text: trimmed, className: "text-foreground font-medium" };
    }

    // Direct semantic-label map (operator answers / enums)
    const lower = trimmed.toLowerCase();
    if (STRING_LABEL_MAP[lower]) {
      return { text: STRING_LABEL_MAP[lower], className: "text-foreground font-medium" };
    }

    // Pretty-print snake_case enum-ish strings to Title Case
    const display = /^[a-z0-9_]+$/i.test(trimmed)
      ? trimmed
          .split("_")
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ")
      : trimmed;
    return { text: display, className: "text-foreground font-medium" };
  }

  return { text: JSON.stringify(value), className: "text-foreground font-medium" };
}

function handleAIError(err: unknown) {
  if (
    err instanceof AICreditsExhaustedError ||
    err instanceof AIRateLimitError ||
    err instanceof AIOverloadedError
  ) {
    return;
  }
  const msg =
    err instanceof Error ? err.message : "Gagal memproses parser.";
  toast.error("Parser error", { description: msg });
}
