/**
 * PARSER DATA — AI-Powered Promo Pre-Processor
 *
 * Layer SEBELUM Pseudo Extractor.
 * Tugas: Validate (promo / bukan / gabungan) → Structure → Gap Detect.
 *
 * Output handoff (Opsi C — manual): User klik "Copy Clean Text" →
 * paste manual ke Pseudo Extractor.
 *
 * AI: via existing `ai-proxy` edge function (type: "extract").
 * Tidak ada direct call ke Anthropic. Tidak ada sessionStorage handoff.
 */

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  FileSearch,
  FileText,
  Upload,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  AlertTriangle,
  Copy,
  ChevronDown,
  X,
  Sparkles,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/lib/notify";
import { callAI, extractJSON, AICreditsExhaustedError, AIRateLimitError, AIOverloadedError } from "@/lib/ai-client";
import type { AIContentBlock } from "@/lib/ai-client";

// ════════════════════════════════════════════════════
// TYPES — must match AI JSON response schema
// ════════════════════════════════════════════════════

type ParserStatus = "valid" | "bukan_promo" | "gabungan";
type GapSeverity = "required" | "optional";

interface ParsedPromo {
  // IDENTITY
  promo_name: string | null;
  promo_type: string | null;
  client_id: string | null;
  target_user: string | null;
  valid_from: string | null;
  valid_until: string | null;
  platform_access: string | null;
  geo_restriction: string | null;

  // FACTS
  min_deposit: number | null;
  max_bonus: number | null;
  max_bonus_unlimited: boolean | null;

  // SIGNALS
  has_turnover: boolean | null;
  is_tiered: boolean | null;
  reward_type_hint: string | null;

  // EXTRACTION
  calculation_base: "loss" | "turnover" | "deposit" | null;
  calculation_value: number | null;
  turnover_requirement: number | null;
  claim_method: string | null;
  game_types: string[];
  game_exclusions: string[];

  // EVIDENCE & AUDIT
  source_evidence_map: Record<string, string[]>;
  ambiguity_flags: string[];
  parse_confidence: number;

  // OUTPUT
  clean_text: string;
}

interface ParserGap {
  field: string;
  label: string;
  severity: GapSeverity;
  reason: string;
  default_value: string | null;
}

export interface ParserResult {
  status: ParserStatus;
  reason: string;
  promos: ParsedPromo[];
  gaps: ParserGap[];
  is_marketing_only: boolean;
  general_kb_suggestion: string | null;
}

// ════════════════════════════════════════════════════
// AI SYSTEM PROMPT
// ════════════════════════════════════════════════════

const PARSER_SYSTEM_PROMPT = `Kamu adalah VOC Parser AI.
Layer pre-processing sebelum VOC Wolf Extractor.
Tugasmu BUKAN extract mechanics. BUKAN generate JSON final.

FILOSOFI UTAMA:
Jujur lebih penting dari kaya data.
Null lebih baik dari tebakan.
Field yang terlihat terisi tapi sebenarnya unresolved
adalah masalah terbesar — lebih berbahaya dari field kosong.

Output kamu akan digunakan oleh Danila (AI CS iGaming)
untuk menjawab player. Kalau kamu hard-fill nilai yang
tidak ada evidence-nya → Danila jawab salah →
player dapat informasi salah → operator rugi.

════════════════════════════════════
STEP 1 — VALIDATE
════════════════════════════════════
Promo valid = ada SEMUA 3 unsur:
- TRIGGER: aksi atau kondisi yang memicu bonus
- BENEFIT: bonus/reward yang konkret dan bisa dihitung
- CONSTRAINT: syarat yang mengikat

Jika tidak memenuhi 3 unsur → status: "bukan_promo"
Jika konten hanya marketing/branding tanpa nilai konkret
→ is_marketing_only: true

════════════════════════════════════
STEP 2 — DETECT SINGLE vs GABUNGAN
════════════════════════════════════
GABUNGAN jika ada tabel atau multiple blok yang
masing-masing punya kombinasi berbeda dari:
persentase + game type + TO + max bonus

Jika gabungan → status: "gabungan"
Pecah menjadi promos[] terpisah per baris/blok.

════════════════════════════════════
STEP 3 — STRUCTURE
ATURAN PALING PENTING — BACA DENGAN TELITI
════════════════════════════════════

ATURAN 1 — NULL > TEBAKAN:
Jika nilai tidak eksplisit di teks/gambar → null.
JANGAN isi dengan asumsi operasional.
CONTOH SALAH: claim_frequency: "mingguan"
  padahal jadwal tidak disebutkan
CONTOH BENAR: claim_frequency: null

ATURAN 2 — EVIDENCE WAJIB:
Setiap field yang ter-isi HARUS masuk ke
source_evidence_map dengan kutipan dari teks.
CONTOH:
source_evidence_map: {
  "min_deposit": ["Minimal Deposit IDR 50.000"],
  "calculation_value": [
    "Cashback 5%",
    "KEKALAHAN 500.000 → BONUS 25.000 (5%)"
  ]
}

ATURAN 3 — AMBIGUITAS = NULL + FLAG:
Jika ada dua interpretasi yang sama-sama valid
→ null untuk field tersebut
→ tambahkan ke ambiguity_flags
CONTOH: "Admin Fee 5%" di narasi vs "20%" di tabel
→ calculation_base: null
→ ambiguity_flags: ["admin_fee_conflict_5pct_vs_20pct"]

ATURAN 4 — PARSE_CONFIDENCE:
Mulai dari 1.0, kurangi per ambiguity:
- Setiap required field yang null: -0.1
- Setiap ambiguity_flag: -0.05
- Tabel rusak/tidak bisa diparsing: -0.15
Minimum: 0.1

FIELD YANG HARUS DI-POPULATE:

IDENTITY (stabil, rendah risiko salah tafsir):
- promo_name: nama promo dari judul/header
  null jika benar-benar tidak ada
- promo_type: hint dari judul saja
  (Cashback/Rollingan/Deposit Bonus/Welcome Bonus/
  Referral Bonus/Freechip/Loyalty Point/Event)
  PENTING: ini title-derived hint, bukan final truth.
  Body promo boleh contradict title → biarkan null
  dan flag di ambiguity_flags
- client_id: nama brand/website jika disebutkan
- target_user: "new_member"/"all"/"vip"
  null jika tidak disebutkan (JANGAN default "all")
- valid_from, valid_until: tanggal jika ada
- platform_access: "web"/"apk"/"semua" jika disebutkan
- geo_restriction: "indonesia"/"global" jika disebutkan

FACTS (angka eksplisit — rendah risiko):
- min_deposit: angka IDR jika disebutkan eksplisit
  null jika tidak ada
- max_bonus: angka IDR cap bonus jika disebutkan
  null jika tidak disebutkan atau unlimited
- max_bonus_unlimited: true HANYA jika teks eksplisit
  menyebut "tanpa batas" / "unlimited" / "tidak ada maks"
  null jika tidak disebutkan sama sekali

SIGNALS (boolean — aman untuk sinyal awal):
- has_turnover:
  true jika ada angka TO atau kata "turnover"/"TO"
  false jika eksplisit "tanpa TO"/"no turnover"
  null jika tidak disebutkan sama sekali
- is_tiered:
  true jika ada tabel dengan multiple tier/baris berbeda
  false jika flat single rate
  null jika tidak jelas
- reward_type_hint:
  "cashback_loss" / "rollingan_turnover" /
  "deposit_bonus" / "welcome_bonus" / "referral" /
  "freechip" / "loyalty_point" / "event_prize"
  null jika tidak bisa ditentukan dari judul+body

EXTRACTION (hanya jika eksplisit — medium risk):
- calculation_base:
  "loss" jika ada "kekalahan"/"loss"/"winlose"
  "turnover" jika ada "turnover"/"TO"/"taruhan"
  "deposit" jika bonus dari deposit
  null jika ambigu atau tidak jelas
  JANGAN derive dari nama promo saja
- calculation_value:
  angka persentase jika ada satu angka yang jelas
  null jika ada conflict atau range atau tiered
  (gunakan is_tiered: true untuk kasus tiered)
- turnover_requirement:
  angka multiplier jika eksplisit (mis. "TO 8x" → 8)
  null jika tidak ada atau ambigu
  JANGAN default 0 untuk "tanpa TO" →
  gunakan has_turnover: false
- claim_method:
  "auto" jika bonus otomatis masuk tanpa action
  "manual" jika harus hubungi CS/admin
  "website" jika ada halaman klaim di website
  "whatsapp" jika harus WA
  null jika tidak jelas

GAME SCOPE:
- game_types: array dari game yang eligible
  ["slot"/"casino"/"sports"/"arcade"/"sabung_ayam"]
  [] jika tidak disebutkan — JANGAN default ["semua"]
- game_exclusions: array nama game/provider yang dilarang
  [] jika tidak ada blacklist

════════════════════════════════════
STEP 4 — GAP DETECTION
════════════════════════════════════
Gap = field null yang Danila butuhkan untuk jawab player.

REQUIRED gap (blocker — Danila tidak bisa jawab):
- calculation_base null DAN tidak ada petunjuk basis
- calculation_value null DAN tidak ada angka apapun
- promo_type null DAN tidak ada hint dari judul/body

OPTIONAL gap (Danila bisa eskalasi ke CS):
- min_deposit null
- claim_method null
- game_types [] untuk promo yang menyebut game restriction
- max_bonus null dan max_bonus_unlimited null

BUKAN GAP (null yang valid/expected):
- turnover_requirement null → has_turnover: false = normal
- valid_until null = tidak ada expiry = normal
- game_exclusions [] = tidak ada blacklist = normal
- client_id null = operator isi manual = normal

════════════════════════════════════
RESPONSE FORMAT — JSON ONLY
Tidak ada teks. Tidak ada markdown wrapper.
════════════════════════════════════
{
  "status": "valid" | "bukan_promo" | "gabungan",
  "reason": "string — 1 kalimat",
  "promos": [
    {
      "promo_name": "string | null",
      "promo_type": "string | null",
      "client_id": "string | null",
      "target_user": "string | null",
      "valid_from": "string | null",
      "valid_until": "string | null",
      "platform_access": "string | null",
      "geo_restriction": "string | null",
      "min_deposit": "number | null",
      "max_bonus": "number | null",
      "max_bonus_unlimited": "boolean | null",
      "has_turnover": "boolean | null",
      "is_tiered": "boolean | null",
      "reward_type_hint": "string | null",
      "calculation_base": "loss | turnover | deposit | null",
      "calculation_value": "number | null",
      "turnover_requirement": "number | null",
      "claim_method": "auto | manual | website | whatsapp | null",
      "game_types": ["string"],
      "game_exclusions": ["string"],
      "source_evidence_map": {
        "field_name": ["kutipan bukti dari teks"]
      },
      "ambiguity_flags": ["string"],
      "parse_confidence": "number 0.0-1.0",
      "clean_text": "string — S&K bersih tanpa noise UI"
    }
  ],
  "gaps": [
    {
      "field": "string",
      "label": "string — Bahasa Indonesia",
      "severity": "required | optional",
      "reason": "string — kenapa tidak bisa ditentukan",
      "default_value": "string | null"
    }
  ],
  "is_marketing_only": "boolean",
  "general_kb_suggestion": "string | null"
}

JIKA status = "bukan_promo" → promos boleh kosong [].
JIKA status = "gabungan" → promos harus >= 2 elemen.
JIKA status = "valid" → promos harus tepat 1 elemen.`;

// ════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════

const FIELD_LABELS: Record<string, string> = {
  promo_name: "Nama Promo",
  promo_type: "Tipe Promo",
  reward_type_hint: "Hint Tipe Reward",
  calculation_value: "Nilai Bonus",
  max_bonus: "Max Bonus",
  min_deposit: "Minimal Deposit",
  calculation_base: "Basis Perhitungan",
  has_turnover: "Ada Turnover?",
  turnover_requirement: "Syarat Turnover",
  is_tiered: "Promo Bertier?",
  game_types: "Game Type",
  claim_method: "Cara Klaim",
  target_user: "Target User",
  parse_confidence: "Confidence Parser",
  ambiguity_flags: "Flag Ambiguitas",
};

const TARGET_USER_LABEL: Record<string, string> = {
  new_member: "New Member",
  all: "Semua User",
  vip: "VIP",
};

const CLAIM_METHOD_LABEL: Record<string, string> = {
  auto: "Otomatis",
  manual: "Manual",
  website: "Website",
  whatsapp: "WhatsApp",
};

const CALC_BASE_LABEL: Record<string, string> = {
  loss: "Kekalahan (Loss)",
  turnover: "Turnover",
  deposit: "Deposit",
};

function formatPromoFieldValue(promo: ParsedPromo, key: string): string {
  switch (key) {
    case "promo_name":
      return promo.promo_name || "—";
    case "promo_type":
      return promo.promo_type || "—";
    case "reward_type_hint":
      return promo.reward_type_hint || "—";
    case "calculation_value":
      return promo.calculation_value != null ? `${promo.calculation_value}%` : "—";
    case "max_bonus":
      if (promo.max_bonus_unlimited === true) return "Unlimited";
      return promo.max_bonus != null ? `Rp ${promo.max_bonus.toLocaleString("id-ID")}` : "—";
    case "min_deposit":
      return promo.min_deposit != null ? `Rp ${promo.min_deposit.toLocaleString("id-ID")}` : "—";
    case "calculation_base":
      return promo.calculation_base ? CALC_BASE_LABEL[promo.calculation_base] ?? promo.calculation_base : "—";
    case "has_turnover":
      if (promo.has_turnover === true) return "Ya";
      if (promo.has_turnover === false) return "Tidak";
      return "—";
    case "turnover_requirement":
      return promo.turnover_requirement != null ? `${promo.turnover_requirement}x` : "—";
    case "is_tiered":
      if (promo.is_tiered === true) return "Ya (multi-tier)";
      if (promo.is_tiered === false) return "Tidak";
      return "—";
    case "game_types":
      return promo.game_types && promo.game_types.length > 0
        ? promo.game_types.map(g => g.charAt(0).toUpperCase() + g.slice(1).replace("_", " ")).join(", ")
        : "—";
    case "claim_method":
      return promo.claim_method ? CLAIM_METHOD_LABEL[promo.claim_method] ?? promo.claim_method : "—";
    case "target_user":
      return promo.target_user ? TARGET_USER_LABEL[promo.target_user] ?? promo.target_user : "—";
    case "parse_confidence":
      return promo.parse_confidence != null ? `${(promo.parse_confidence * 100).toFixed(0)}%` : "—";
    case "ambiguity_flags":
      return promo.ambiguity_flags && promo.ambiguity_flags.length > 0
        ? promo.ambiguity_flags.join(", ")
        : "Tidak ada";
    default:
      return "—";
  }
}

async function fileToBase64(file: File): Promise<{ data: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [meta, b64] = result.split(",");
      const mimeMatch = meta.match(/data:([^;]+);base64/);
      resolve({ data: b64, mime: mimeMatch?.[1] ?? file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════

export function ParserDataSection() {
  const [activeTab, setActiveTab] = useState<"text" | "file">("text");
  const [inputText, setInputText] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeElapsedMs, setAnalyzeElapsedMs] = useState(0);
  const [parserResult, setParserResult] = useState<ParserResult | null>(null);
  const [gapFills, setGapFills] = useState<Record<string, string>>({});

  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Derived state ───────────────────────────────────
  const hasInput = useMemo(() => {
    if (activeTab === "text") return inputText.trim().length > 0 || !!screenshotFile;
    return !!uploadedFile;
  }, [activeTab, inputText, screenshotFile, uploadedFile]);

  const requiredGapsUnfilled = useMemo(() => {
    if (!parserResult) return 0;
    return parserResult.gaps
      .filter(g => g.severity === "required")
      .filter(g => !gapFills[g.field] || gapFills[g.field].trim() === "").length;
  }, [parserResult, gapFills]);

  // ─── Drag & Drop handlers ───────────────────────────
  const handleScreenshotDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAnalyzing) setIsDragOver(true);
  }, [isAnalyzing]);

  const handleScreenshotDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleScreenshotDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (isAnalyzing) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.warning("Hanya file gambar yang diizinkan", {
        description: `File "${file.name}" bukan format image.`,
      });
      return;
    }
    setScreenshotFile(file);
  }, [isAnalyzing]);

  // ─── Paste handler (Ctrl+V / Cmd+V) ─────────────────
  useEffect(() => {
    if (activeTab !== "text" || screenshotFile || isAnalyzing) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            setScreenshotFile(file);
            toast.success("Screenshot dari clipboard ditambahkan");
            e.preventDefault();
            return;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeTab, screenshotFile, isAnalyzing]);

  // ─── Cancel handler ─────────────────────────────────
  const handleCancelAnalyze = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    setIsAnalyzing(false);
    setAnalyzeElapsedMs(0);
    toast.info("Analisis dibatalkan");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  // ─── Analyze handler ─────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    if (!hasInput) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const startedAt = Date.now();
    setAnalyzeElapsedMs(0);
    elapsedTimerRef.current = setInterval(() => {
      setAnalyzeElapsedMs(Date.now() - startedAt);
    }, 100);
    setIsAnalyzing(true);
    setParserResult(null);
    setGapFills({});

    try {
      // Build content blocks (text + optional image)
      const contentBlocks: AIContentBlock[] = [];

      if (activeTab === "text") {
        if (inputText.trim()) {
          contentBlocks.push({ type: "text", text: inputText.trim() });
        }
        if (screenshotFile) {
          const { data, mime } = await fileToBase64(screenshotFile);
          contentBlocks.push({
            type: "image",
            source: { type: "base64", media_type: mime, data },
          });
        }
      } else if (uploadedFile) {
        // Image file → vision; PDF → unsupported here, ask text paste
        if (uploadedFile.type === "application/pdf") {
          toast.warning("Format PDF belum didukung", {
            description: "Sementara silakan copy-paste teks dari PDF ke tab 'Teks & URL'.",
          });
          setIsAnalyzing(false);
          return;
        }
        const { data, mime } = await fileToBase64(uploadedFile);
        contentBlocks.push({ type: "text", text: "Analisis konten promo dari gambar berikut:" });
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: mime, data },
        });
      }

      if (contentBlocks.length === 0) {
        toast.warning("Input kosong");
        setIsAnalyzing(false);
        return;
      }

      const response = await callAI({
        type: "extract",
        system: PARSER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: contentBlocks }],
        temperature: 0,
        signal: controller.signal,
      });

      const parsed = extractJSON<ParserResult>(response);

      // Defensive normalization
      const normalized: ParserResult = {
        status: parsed.status ?? "bukan_promo",
        reason: parsed.reason ?? "",
        promos: Array.isArray(parsed.promos) ? parsed.promos : [],
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
        is_marketing_only: !!parsed.is_marketing_only,
        general_kb_suggestion: parsed.general_kb_suggestion ?? null,
      };

      // ════════════════════════════════════════════════════
      // FIX: Filter gaps yang field-nya sudah ter-populate di promo
      // Landasan: JSON schema, bukan interpretasi LLM
      // ════════════════════════════════════════════════════
      const isEmptyValue = (val: unknown): boolean => {
        if (val === null || val === undefined) return true;
        if (typeof val === "string" && val.trim() === "") return true;
        if (Array.isArray(val) && val.length === 0) return true;
        if (typeof val === "boolean") return false; // boolean false bukan empty
        if (typeof val === "number") return false;  // 0 bukan empty
        return false;
      };

      if (normalized.status === "gabungan" && normalized.promos.length > 1) {
        // Gabungan: drop gap hanya jika SEMUA promo punya nilainya
        normalized.gaps = normalized.gaps.filter((gap) =>
          normalized.promos.every((p) => isEmptyValue((p as any)[gap.field]))
        );
      } else {
        const firstPromo = normalized.promos[0];
        if (firstPromo) {
          normalized.gaps = normalized.gaps.filter((gap) =>
            isEmptyValue((firstPromo as any)[gap.field])
          );
        }
      }

      setParserResult(normalized);
      toast.success("Analisis selesai");
    } catch (err) {
      // Specific AI errors already toast-handled in ai-client
      if (
        err instanceof AICreditsExhaustedError ||
        err instanceof AIRateLimitError ||
        err instanceof AIOverloadedError
      ) {
        // Already shown
      } else {
        console.error("[ParserDataSection] analyze failed:", err);
        toast.error("Analisis gagal", {
          description: err instanceof Error ? err.message : "Coba lagi sebentar.",
        });
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [activeTab, hasInput, inputText, screenshotFile, uploadedFile]);

  // ─── Reset ───────────────────────────────────────────
  const handleReset = () => {
    setInputText("");
    setScreenshotFile(null);
    setUploadedFile(null);
    setParserResult(null);
    setGapFills({});
  };

  // ─── Copy clean text ─────────────────────────────────
  const handleCopyCleanText = async (promo: ParsedPromo) => {
    const cleanBase = (promo.clean_text || "").trim();

    // Append operator gap fills as appendix
    const fillsForCopy = Object.entries(gapFills).filter(([, v]) => v && v.trim() !== "");
    let appendix = "";
    if (fillsForCopy.length > 0) {
      appendix = "\n\n[DATA TAMBAHAN DARI OPERATOR]\n" +
        fillsForCopy
          .map(([k, v]) => {
            const label = parserResult?.gaps.find(g => g.field === k)?.label ?? k;
            return `${label}: ${v}`;
          })
          .join("\n");
    }

    const finalText = cleanBase + appendix;

    try {
      await navigator.clipboard.writeText(finalText);
      toast.success("Teks tersalin", {
        description: "Buka Pseudo Extractor lalu paste di kolom input.",
      });
    } catch {
      toast.error("Gagal menyalin teks");
    }
  };

  // ════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════

  return (
    <div className="page-wrapper space-y-6">
      {/* ─── HEADER ─── */}
      <div className="flex items-center gap-4 mb-2">
        <div className="icon-circle">
          <FileSearch className="icon-circle-icon" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Parser Data</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered pre-processor — validasi, struktur & deteksi gap sebelum extraction.
          </p>
        </div>
      </div>

      {/* ─── SECTION 1: INPUT AREA ─── */}
      <Card className="p-8">
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as "text" | "file")}>
          <TabsList className="mb-6">
            <TabsTrigger value="text" className="gap-2">
              <FileText className="h-4 w-4" />
              Teks &amp; URL
            </TabsTrigger>
            <TabsTrigger value="file" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload File
            </TabsTrigger>
          </TabsList>

          {/* TAB 1 — TEKS & URL */}
          <TabsContent value="text" className="space-y-6 mt-0">
            <Textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Paste teks S&K promo, URL halaman promo, atau copy-paste dari WhatsApp/Telegram..."
              className="min-h-48 rounded-lg resize-y"
              disabled={isAnalyzing}
            />

            {/* Screenshot uploader (compact, dashed) */}
            <div>
              <input
                ref={screenshotInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setScreenshotFile(f);
                  if (e.target) e.target.value = "";
                }}
              />
              {!screenshotFile ? (
                <div
                  onDragOver={handleScreenshotDragOver}
                  onDragLeave={handleScreenshotDragLeave}
                  onDrop={handleScreenshotDrop}
                >
                  <button
                    type="button"
                    onClick={() => screenshotInputRef.current?.click()}
                    disabled={isAnalyzing}
                    className={`w-full p-4 border-2 border-dashed rounded-xl transition-colors flex items-center justify-center gap-3 ${
                      isDragOver
                        ? "border-solid border-button-hover bg-button-hover/10 text-button-hover"
                        : "border-border bg-muted/0 hover:border-button-hover hover:text-button-hover text-muted-foreground"
                    }`}
                  >
                    <ImageIcon className="h-5 w-5 pointer-events-none" />
                    <span className="text-sm font-medium pointer-events-none">
                      {isDragOver
                        ? "Lepaskan untuk upload"
                        : "Drag & drop, paste (Ctrl+V), atau klik untuk upload screenshot"}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-muted rounded-xl border border-border flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <ImageIcon className="h-5 w-5 text-button-hover shrink-0" />
                    <span className="text-sm text-foreground truncate">{screenshotFile.name}</span>
                    <Badge className="bg-muted text-muted-foreground border border-border shrink-0">
                      {(screenshotFile.size / 1024).toFixed(0)} KB
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setScreenshotFile(null)}
                    disabled={isAnalyzing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 2 — UPLOAD FILE */}
          <TabsContent value="file" className="space-y-6 mt-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp,application/pdf"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 10 * 1024 * 1024) {
                    toast.error("File terlalu besar", { description: "Maksimal 10MB." });
                    return;
                  }
                  setUploadedFile(f);
                }
                if (e.target) e.target.value = "";
              }}
            />
            {!uploadedFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="w-full min-h-48 p-8 border-2 border-dashed border-border rounded-xl hover:border-button-hover hover:text-button-hover text-muted-foreground transition-colors flex flex-col items-center justify-center gap-3"
              >
                <Upload className="h-10 w-10" />
                <div className="text-center">
                  <div className="text-base font-medium text-foreground mb-1">Upload file S&amp;K promo</div>
                  <div className="text-sm">PDF, PNG, JPG, WEBP — maksimal 10MB</div>
                </div>
              </button>
            ) : (
              <div className="p-6 bg-muted rounded-xl border border-border flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-6 w-6 text-button-hover shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{uploadedFile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(uploadedFile.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setUploadedFile(null)}
                  disabled={isAnalyzing}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* CTA */}
        <div className="mt-6 flex items-center gap-3">
          <Button
            variant="golden"
            size="lg"
            onClick={handleAnalyze}
            disabled={!hasInput || isAnalyzing}
            className="flex-1"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sedang menganalisis...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analisis dengan Parser AI
              </>
            )}
          </Button>
          {parserResult && !isAnalyzing && (
            <Button variant="outline" size="lg" onClick={handleReset}>
              Reset
            </Button>
          )}
        </div>
      </Card>

      {/* ════════════════════════════════════════════════════ */}
      {/* SECTION 2: HASIL PARSER                              */}
      {/* ════════════════════════════════════════════════════ */}

      {parserResult && (
        <>
          {/* 2A — STATUS BADGE */}
          <StatusCard result={parserResult} />

          {/* 2B — DATA TERSTRUKTUR (per promo) */}
          {parserResult.promos.length > 0 && (
            <StructuredDataCard
              promos={parserResult.promos}
              status={parserResult.status}
              onCopyCleanText={handleCopyCleanText}
              requiredGapsUnfilled={requiredGapsUnfilled}
            />
          )}

          {/* 2C — GAP REPORT */}
          {parserResult.gaps.length > 0 && (
            <GapReportCard
              gaps={parserResult.gaps}
              fills={gapFills}
              onFillChange={(field, value) => setGapFills(prev => ({ ...prev, [field]: value }))}
            />
          )}

          {/* Bukan promo → suggestion only */}
          {parserResult.status === "bukan_promo" && (
            <Card className="p-6 border-l-4 border-l-warning">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">
                    Konten ini mungkin cocok untuk General KB
                  </div>
                  {parserResult.general_kb_suggestion && (
                    <div className="text-sm text-muted-foreground">
                      Saran kategori: {parserResult.general_kb_suggestion}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════

function StatusCard({ result }: { result: ParserResult }) {
  if (result.status === "valid") {
    const promo = result.promos[0];
    return (
      <Card className="p-6 border-l-4 border-l-success">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-success text-success-foreground">✓ Promo Terdeteksi</Badge>
            </div>
            {promo && (
              <div className="text-base font-medium text-foreground">{promo.promo_name}</div>
            )}
            {result.reason && (
              <div className="text-sm text-muted-foreground mt-1">{result.reason}</div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (result.status === "bukan_promo") {
    return (
      <Card className="p-6 border-l-4 border-l-destructive">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
            <XCircle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-destructive text-destructive-foreground">✗ Bukan Promo</Badge>
            </div>
            {result.reason && (
              <div className="text-sm text-muted-foreground mt-1">{result.reason}</div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // gabungan
  return (
    <Card className="p-6 border-l-4 border-l-warning">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
          <Zap className="h-5 w-5 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-warning text-warning-foreground">
              ⚡ {result.promos.length} Promo Terdeteksi dalam 1 Konten
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground mb-2">
            Konten ini berisi beberapa promo berbeda. Gunakan tombol "Copy Clean Text" per promo lalu paste ke Pseudo Extractor.
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {result.promos.map((p, i) => (
              <Badge key={i} className="bg-muted text-foreground border border-border">
                {p.promo_name || `Promo ${i + 1}`}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function StructuredDataCard({
  promos,
  status,
  onCopyCleanText,
  requiredGapsUnfilled,
}: {
  promos: ParsedPromo[];
  status: ParserStatus;
  onCopyCleanText: (promo: ParsedPromo) => void;
  requiredGapsUnfilled: number;
}) {
  const [open, setOpen] = useState(true);
  const isMulti = status === "gabungan" || promos.length > 1;
  const fieldKeys: (keyof typeof FIELD_LABELS)[] = [
    "promo_name",
    "promo_type",
    "reward_type_hint",
    "calculation_base",
    "calculation_value",
    "max_bonus",
    "min_deposit",
    "has_turnover",
    "turnover_requirement",
    "is_tiered",
    "game_types",
    "claim_method",
    "target_user",
    "parse_confidence",
    "ambiguity_flags",
  ];

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
                <div className="text-base font-medium text-foreground">Data Terstruktur</div>
                <div className="text-sm text-muted-foreground">
                  {isMulti ? `${promos.length} promo` : "1 promo"} hasil parsing
                </div>
              </div>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-6 pt-4 border-t border-border space-y-6">
            {promos.map((promo, idx) => (
              <div key={idx} className="space-y-4">
                {isMulti && (
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div className="text-sm font-medium text-button-hover">
                      Varian {idx + 1}: {promo.promo_name || "—"}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {fieldKeys.map(key => (
                    <div key={key} className="bg-muted rounded-lg p-4">
                      <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                        {FIELD_LABELS[key]}
                      </div>
                      <div className="text-sm text-foreground font-medium break-words">
                        {formatPromoFieldValue(promo, key)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Copy clean text per promo */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-muted-foreground">
                    {requiredGapsUnfilled > 0 && (
                      <span className="text-warning">
                        ⚠ {requiredGapsUnfilled} gap WAJIB belum diisi — extractor mungkin gagal.
                      </span>
                    )}
                  </div>
                  <Button
                    variant="golden"
                    size="sm"
                    onClick={() => onCopyCleanText(promo)}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Clean Text
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function GapReportCard({
  gaps,
  fills,
  onFillChange,
}: {
  gaps: ParserGap[];
  fills: Record<string, string>;
  onFillChange: (field: string, value: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const requiredCount = gaps.filter(g => g.severity === "required").length;
  const optionalCount = gaps.filter(g => g.severity === "optional").length;

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
              <div>
                <div className="text-base font-medium text-foreground">Data yang Perlu Dilengkapi</div>
                <div className="text-sm text-muted-foreground">
                  {requiredCount > 0 && <span className="text-destructive">{requiredCount} wajib</span>}
                  {requiredCount > 0 && optionalCount > 0 && <span> • </span>}
                  {optionalCount > 0 && <span>{optionalCount} opsional</span>}
                </div>
              </div>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-6 pt-4 border-t border-border space-y-4">
            {gaps.map((gap, idx) => (
              <GapItem
                key={`${gap.field}-${idx}`}
                gap={gap}
                value={fills[gap.field] ?? ""}
                onChange={v => onFillChange(gap.field, v)}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function GapItem({
  gap,
  value,
  onChange,
}: {
  gap: ParserGap;
  value: string;
  onChange: (v: string) => void;
}) {
  const isRequired = gap.severity === "required";
  const dotClass = isRequired ? "bg-destructive" : "bg-warning";

  // Use Select for known enums; Input for free text
  const enumOptions: Record<string, { value: string; label: string }[]> = {
    calculation_base: [
      { value: "loss", label: "Kekalahan (Loss)" },
      { value: "turnover", label: "Turnover" },
      { value: "deposit", label: "Deposit" },
    ],
    target_user: [
      { value: "new_member", label: "New Member" },
      { value: "all", label: "Semua User" },
      { value: "vip", label: "VIP" },
    ],
    claim_method: [
      { value: "auto", label: "Otomatis" },
      { value: "manual", label: "Manual" },
      { value: "website", label: "Website" },
      { value: "whatsapp", label: "WhatsApp" },
    ],
  };

  const options = enumOptions[gap.field];

  return (
    <div className="bg-muted rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${dotClass}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{gap.label}</span>
            <Badge
              className={
                isRequired
                  ? "bg-destructive/20 text-destructive border border-destructive/30"
                  : "bg-warning/20 text-warning border border-warning/30"
              }
            >
              {isRequired ? "WAJIB" : "OPSIONAL"}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-1">{gap.reason}</div>
          {gap.default_value && (
            <div className="text-xs text-muted-foreground mt-1">
              Default jika dikosongkan: <span className="text-foreground">{gap.default_value}</span>
            </div>
          )}
        </div>
      </div>

      <div>
        {options ? (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="rounded-lg bg-background">
              <SelectValue placeholder="Pilih..." />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={gap.default_value ? `Contoh: ${gap.default_value}` : "Isi nilai..."}
            className="rounded-lg bg-background"
          />
        )}
      </div>
    </div>
  );
}
