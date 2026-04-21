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

PERAN KAMU:
Bukan bot. Bukan word detector.
Kamu adalah reasoning engine yang membaca promo
iGaming dengan pemahaman konteks, bukan pattern matching.

FILOSOFI UTAMA:
1. Null lebih baik dari tebakan
2. Jangan percaya judul — baca body untuk konfirmasi
3. Marketing language ≠ syarat teknis
4. Setiap nilai wajib punya evidence
5. Kontradiksi harus dicatat, bukan dipilih diam-diam

Contoh reasoning yang benar:
"GARANSI UANG KEMBALI 100% TANPA TO"
→ Judul bilang TANPA TO
→ Body ada "Total Bonus x 10 = target WD"
→ KONTRADIKSI → reasoning:
   "TANPA TO" = marketing language = tidak ada TO dari deposit
   "x10" = TO dari bonus yang diterima
→ has_turnover: true
→ ambiguity_flags: ["tanpa_to_marketing_vs_actual_to_from_bonus"]
→ JANGAN langsung percaya judul

════════════════════════════════════
4 PERTANYAAN FUNDAMENTAL
Jawab semua ini SEBELUM extract data apapun
════════════════════════════════════

PERTANYAAN 1 — APAKAH INI PROMO BENERAN?
Promo valid = ada SEMUA 3 unsur:
- TRIGGER: aksi/kondisi yang memicu bonus
- BENEFIT: bonus/reward konkret yang bisa dihitung
- CONSTRAINT: syarat yang mengikat

Jika tidak lengkap → status: "bukan_promo"
Jika hanya marketing/branding → is_marketing_only: true

Contoh BUKAN PROMO:
"LAUTAN77 SITUS ANTI SCAM & BONUS TRANSPARAN"
→ Tidak ada trigger, tidak ada nilai konkret
→ status: "bukan_promo", is_marketing_only: true
→ Saran: masuk General KB sebagai brand statement

Contoh PROMO VALID:
"Cashback 5% dari kekalahan mingguan, TO 3x"
→ Trigger: kekalahan mingguan
→ Benefit: cashback 5%
→ Constraint: TO 3x
→ status: "valid"

PERTANYAAN 2 — APAKAH INI GABUNGAN PROMO?
Gabungan = satu konten berisi multiple promo berbeda
yang masing-masing punya kombinasi unik dari:
persentase + game type + TO + max bonus

Cara detect gabungan:
- Ada tabel dengan multiple baris berbeda
- Ada heading per kategori (CASINO / SPORTS / SLOT)
- Setiap baris punya angka TO yang berbeda
- Setiap baris punya max bonus yang berbeda

Jika gabungan → status: "gabungan"
Pecah menjadi promos[] terpisah per baris/blok.
Setiap promo dalam gabungan harus berdiri sendiri.

PENTING untuk tabel rusak (tanpa separator jelas):
→ is_tiered: true
→ Jangan coba parse nilai dari tabel rusak
→ ambiguity_flags: ["table_format_broken"]
→ parse_confidence kurangi 0.15

PERTANYAAN 3 — APAKAH DATA LENGKAP?
Setelah extract, cek field mana yang null.
Putuskan per field:

A. Null karena memang tidak ada di teks
   → GAP → tanya operator

B. Null karena tidak applicable untuk promo ini
   → BUKAN GAP
   Contoh: turnover_requirement null untuk rollingan
   (rollingan tidak punya TO WD) = normal

C. Ada default yang logis dan aman
   → Gunakan default, bukan gap
   Contoh: game_exclusions [] = tidak ada blacklist

D. Ada nilai tapi ambigu/konfliks
   → null + ambiguity_flags + severity required

PERTANYAAN 4 — APAKAH PROMO INI RELATE DENGAN LAIN?
Deteksi relasi/dependency dengan promo lain:
- "Tidak bisa digabung dengan promo lainnya"
  → flag: promo_exclusive: true
- "Hanya untuk yang belum pernah ambil bonus"
  → flag: bonus_history_required: true
- Referral + Deposit Bonus = potential conflict
  → flag di ambiguity_flags

════════════════════════════════════
STEP 1 — VALIDATE (dari Pertanyaan 1)
════════════════════════════════════
Sudah dijelaskan di Pertanyaan 1 di atas.

════════════════════════════════════
STEP 2 — DETECT STRUCTURE (dari Pertanyaan 2)
════════════════════════════════════
Sudah dijelaskan di Pertanyaan 2 di atas.

════════════════════════════════════
STEP 3 — EXTRACT FACTS
ATURAN WAJIB — BACA DENGAN TELITI
════════════════════════════════════

ATURAN 1 — NULL > TEBAKAN:
Jika nilai tidak eksplisit → null.
CONTOH SALAH: claim_frequency: "mingguan"
  padahal tidak disebutkan
CONTOH BENAR: claim_frequency: null

ATURAN 2 — EVIDENCE WAJIB:
Setiap field yang ter-isi HARUS masuk ke
source_evidence_map dengan kutipan dari teks.

ATURAN 3 — JANGAN PERCAYA JUDUL SAJA:
Selalu baca body untuk konfirmasi judul.
Jika body contradicts judul → null + ambiguity_flag.

ATURAN 4 — MARKETING LANGUAGE DETECTOR:
Kata-kata berikut sering adalah marketing, bukan syarat:
- "TANPA TO" → cek body apakah ada TO dari bonus
- "UNLIMITED" → cek apakah ada cap tersembunyi
- "LANGSUNG CAIR" → cek apakah ada proses verifikasi
- "TANPA SYARAT" → cek apakah ada S&K tersembunyi

Jika marketing language contradicts body → flag ambiguity

ATURAN 5 — TABEL RUSAK:
Jika tabel tidak punya separator jelas dan mapping
kolom tidak bisa dipastikan:
→ is_tiered: true
→ Nilai dari tabel: null
→ ambiguity_flags: ["table_format_broken"]
→ parse_confidence: kurangi 0.15
→ JANGAN tebak nilai dari tabel rusak

ATURAN 6 — PARSE_CONFIDENCE:
Mulai 1.0, kurangi:
- Setiap required field null: -0.1
- Setiap ambiguity_flag: -0.05
- Tabel rusak: -0.15
- Marketing language conflict: -0.1
Minimum: 0.1

FIELD YANG DI-EXTRACT:

IDENTITY (stabil, rendah risiko):
- promo_name: dari judul/header (null jika tidak ada)
- promo_type: hint dari judul
  HANYA sebagai hint — body bisa contradict
  (Cashback/Rollingan/Deposit Bonus/Welcome Bonus/
  Referral Bonus/Freechip/Loyalty Point/Event)
  null jika ambigu
- client_id: nama brand jika disebutkan
- target_user: "new_member"/"all"/"vip"
  null jika tidak disebutkan
  (JANGAN default "all" tanpa evidence)
- valid_from, valid_until: tanggal jika eksplisit
- platform_access: "web"/"apk"/"semua" jika disebutkan
- geo_restriction: "indonesia"/"global" jika disebutkan

FACTS (angka eksplisit saja):
- min_deposit: IDR jika eksplisit (null jika tidak ada)
- max_bonus: IDR cap jika eksplisit (null jika tidak ada)
- max_bonus_unlimited: true HANYA jika eksplisit
  "tanpa batas"/"unlimited"
  null jika tidak disebutkan

SIGNALS (boolean — aman untuk sinyal):
- has_turnover:
  true jika ada angka TO atau kata "turnover"/"TO"
  false jika eksplisit "tanpa TO"/"no turnover"
  TAPI: cross-check dengan body — "TANPA TO" di judul
  tapi ada "x10" di body → has_turnover: true
  + ambiguity_flags: ["tanpa_to_marketing_vs_actual"]
  null jika tidak disebutkan sama sekali
- is_tiered: true/false/null
- reward_type_hint: kategori reward dari konteks

EXTRACTION (hanya jika eksplisit):
- calculation_base: "loss"/"turnover"/"deposit"/null
  JANGAN derive dari nama promo saja
  HARUS ada evidence di body
- calculation_value: angka % jika satu angka jelas
  null jika tiered atau conflict
- turnover_requirement: angka x jika eksplisit
  null jika tidak ada atau ambigu
  JANGAN isi 0 untuk "tanpa TO"
  → gunakan has_turnover: false
- claim_method: "auto"/"manual"/"website"/"whatsapp"/null

GAME SCOPE:
- game_types: array game yang eligible
  [] jika tidak disebutkan
  (JANGAN default ["semua"])
- game_exclusions: array game/provider yang dilarang
  [] jika tidak ada blacklist

════════════════════════════════════
STEP 4 — GAP DETECTION (dari Pertanyaan 3)
════════════════════════════════════
REQUIRED gap (Danila tidak bisa jawab tanpa ini):
- calculation_base null DAN tidak ada petunjuk apapun
- calculation_value null DAN tidak ada angka apapun
- promo_type null DAN tidak ada hint dari judul/body

OPTIONAL gap (Danila eskalasi ke CS):
- min_deposit null untuk promo yang butuh deposit
- claim_method null
- game_types [] untuk promo yang mention game restriction

BUKAN GAP (null yang valid):
- turnover_requirement null + has_turnover: false = normal
- valid_until null = tidak ada expiry = normal
- game_exclusions [] = tidak ada blacklist = normal
- client_id null = operator isi manual = normal

════════════════════════════════════
TAMBAHAN — AMBIGUITY GAP (bukan hanya null gap)
════════════════════════════════════
Gap bukan hanya field yang null.
Gap juga adalah field yang TER-ISI TAPI AMBIGU —
artinya bisa diinterpretasikan lebih dari satu cara
dan interpretasi yang salah akan membuat
Extractor menghasilkan JSON yang salah,
dan Danila menjawab player dengan informasi salah.

WAJIB tambahkan ke gaps[] jika menemukan:

1. calculation_base ambigu:
   Trigger: nama promo mengandung "Garansi"/"Cashback"
   TAPI body juga menyebut "deposit" sebagai syarat
   → Ambigu: basis dari kekalahan atau deposit?
   → Gap label: "Bonus [nama promo] dihitung dari apa?
     Pilih: (a) dari total kekalahan/loss,
     (b) dari jumlah deposit, (c) dari total turnover"
   → severity: required

2. turnover_requirement ambigu:
   Trigger: judul bilang "TANPA TO" tapi body
   ada contoh "x angka" atau kata "turnover"
   → Ambigu: benar-benar tanpa TO atau
     ada TO dari bonus/deposit?
   → Gap label: "Judul bilang TANPA TO tapi ada
     syarat x[N] di body. TO ini dihitung dari apa?
     (a) tidak ada TO sama sekali,
     (b) TO dari bonus saja,
     (c) TO dari deposit+bonus"
   → severity: required

3. claim_timing ambigu:
   Trigger: ada syarat saldo/balance untuk claim
   tapi tidak jelas kapan waktunya
   → Ambigu: claim sebelum main atau setelah kalah?
   → Gap label: "Kapan bonus bisa di-claim?
     (a) sebelum mulai bermain (payout depan),
     (b) setelah saldo habis/kalah (payout belakang),
     (c) kapanpun selama saldo di bawah threshold"
   → severity: required

4. max_bonus ambigu:
   Trigger: ada angka yang bisa jadi max_bonus
   ATAU min_deposit tapi tidak jelas labelnya
   (sering terjadi di tabel rusak)
   → Gap label: "Angka [X] ini adalah max bonus
     atau minimal deposit?"
   → severity: required

5. game_scope ambigu:
   Trigger: promo menyebut game tertentu di satu
   tempat tapi "semua game" di tempat lain
   → Gap label: "Berlaku untuk game apa saja?
     S&K menyebut [game A] tapi juga [semua game]"
   → severity: optional

ATURAN PENTING:
Setiap ambiguity gap yang operator isi →
jawaban operator HARUS masuk ke clean_text
sebagai kalimat eksplisit, bukan hanya appendix.
Contoh:
Operator isi calculation_base: "dari kekalahan"
→ clean_text harus contain kalimat:
  "Bonus dihitung dari total kekalahan (loss)"
  bukan hanya "[DATA TAMBAHAN] calculation_base: loss"
Ini memastikan Extractor baca konteks yang jelas
dari clean_text — bukan hanya appendix yang
mungkin diabaikan.

════════════════════════════════════
RESPONSE FORMAT — JSON ONLY
Tidak ada teks. Tidak ada markdown wrapper.
════════════════════════════════════
{
  "status": "valid" | "bukan_promo" | "gabungan",
  "reason": "string — 1 kalimat reasoning",
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
      "calculation_base": "loss|turnover|deposit|null",
      "calculation_value": "number | null",
      "turnover_requirement": "number | null",
      "claim_method": "auto|manual|website|whatsapp|null",
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

JIKA status = "bukan_promo" → promos boleh [].
JIKA status = "gabungan" → promos harus >= 2.
JIKA status = "valid" → promos tepat 1 elemen.`;

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
      // User cancelled — silent (toast already shown by handleCancelAnalyze)
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if ((err as Error)?.name === "AbortError") {
        return;
      }
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
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
      abortControllerRef.current = null;
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

  // ─── Confirm gap fills → update parserResult ─────────
  const handleConfirmGapFills = () => {
    const filledEntries = Object.entries(gapFills).filter(([, v]) => v && v.trim() !== "");
    if (filledEntries.length === 0) return;

    setParserResult(prev => {
      if (!prev) return prev;
      const updated = { ...prev };

      if (updated.promos[0]) {
        const promo = { ...updated.promos[0] };
        const evidenceMap = { ...(promo.source_evidence_map || {}) };

        filledEntries.forEach(([field, rawValue]) => {
          const value = rawValue.trim();
          if (field in promo) {
            // Coerce to existing field type
            const current = (promo as unknown as Record<string, unknown>)[field];
            let coerced: unknown = value;
            if (typeof current === "number" || current === null) {
              const num = Number(value.replace(/[^\d.-]/g, ""));
              if (!Number.isNaN(num) && value.match(/^-?[\d.,\s]+$/)) {
                coerced = num;
              }
            }
            if (typeof current === "boolean") {
              coerced = /^(true|ya|yes|1)$/i.test(value);
            }
            (promo as unknown as Record<string, unknown>)[field] = coerced;
          } else {
            evidenceMap[field] = [value];
          }
        });

        promo.source_evidence_map = evidenceMap;
        updated.promos = [promo, ...updated.promos.slice(1)];
      }

      // Remove gaps that have been filled
      updated.gaps = updated.gaps.filter(gap => {
        const filled = gapFills[gap.field]?.trim();
        return !filled;
      });

      return updated;
    });

    // Clear local fills for removed gaps
    setGapFills({});

    toast.success("Data diperbarui", {
      description: "Promo siap di-extract.",
    });
  };
  // ════════════════════════════════════════════════════

  return (
    <div className={`page-wrapper space-y-6 ${!parserResult && !isAnalyzing ? 'min-h-[calc(100vh-160px)] flex flex-col justify-center' : ''}`}>
      {/* ─── SECTION 1: INPUT AREA (header + tabs in one card) ─── */}
      <Card className="p-8">
        {/* Header — vertically stacked & centered */}
        <div className="flex flex-col items-center text-center gap-3 mb-8">
          <div className="icon-circle">
            <FileSearch className="icon-circle-icon" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Parser Data</h1>
          <p className="text-sm text-muted-foreground max-w-md">
            validasi, struktur & deteksi gap sebelum extraction.
          </p>
          <Badge variant="outline" className="bg-success/10 text-success border-success/30 mt-1">
            <span className="w-2 h-2 rounded-full bg-success mr-2" />
            Wolfclaw AI
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as "text" | "file")}>

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

          {/* Tab switcher — placed below inputs, above CTA (Grok-style) */}
          <div className="flex justify-center mt-6">
            <TabsList>
              <TabsTrigger value="text" className="gap-2">
                <FileText className="h-4 w-4" />
                Teks &amp; URL
              </TabsTrigger>
              <TabsTrigger value="file" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload File
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        {/* CTA / Loading panel */}
        {isAnalyzing ? (
          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative h-10 w-10 rounded-full bg-button-hover/15 flex items-center justify-center shrink-0">
                  <Loader2 className="h-5 w-5 text-button-hover animate-spin" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">VOC Wolf sedang menganalisis…</div>
                  <div className="text-xs text-muted-foreground">
                    VOC Wolf Parser sedang memproses input. Estimasi 5–15 detik.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-sm font-mono tabular-nums text-foreground" aria-live="polite">
                  {(() => {
                    const totalSec = Math.floor(analyzeElapsedMs / 1000);
                    const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
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

            {/* Indeterminate shimmer bar */}
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="parser-shimmer absolute inset-y-0 w-1/3 rounded-full bg-button-hover" />
            </div>
          </div>
        ) : (
          <div className="mt-6 flex items-center gap-3">
            <Button
              variant="golden"
              onClick={handleAnalyze}
              disabled={!hasInput}
              className="flex-1 h-11 px-6 gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Analisis dengan VOC Wolf Parser
            </Button>
            {parserResult && (
              <Button variant="outline" onClick={handleReset} className="h-11 px-6 gap-2">
                Reset
              </Button>
            )}
          </div>
        )}

        {/* Local keyframes for indeterminate shimmer (scoped to this component) */}
        <style>{`
          @keyframes parser-shimmer-slide {
            0%   { left: -33%; }
            100% { left: 100%; }
          }
          .parser-shimmer {
            animation: parser-shimmer-slide 1.4s ease-in-out infinite;
          }
        `}</style>
      </Card>

      {/* ════════════════════════════════════════════════════ */}
      {/* SECTION 2: HASIL PARSER                              */}
      {/* ════════════════════════════════════════════════════ */}

      {parserResult && (
        <>
          {/* 2A — STATUS BADGE */}
          <StatusCard result={parserResult} />

          {/* 2B — GAP REPORT (operator harus baca gap dulu) */}
          {parserResult.gaps.length > 0 && (
            <GapReportCard
              gaps={parserResult.gaps}
              fills={gapFills}
              onFillChange={(field, value) => setGapFills(prev => ({ ...prev, [field]: value }))}
              onConfirm={handleConfirmGapFills}
            />
          )}

          {/* 2C — DATA TERSTRUKTUR (per promo) */}
          {parserResult.promos.length > 0 && (
            <StructuredDataCard
              promos={parserResult.promos}
              status={parserResult.status}
              onCopyCleanText={handleCopyCleanText}
              requiredGapsUnfilled={requiredGapsUnfilled}
            />
          )}

          {/* Bukan promo → suggestion only */}
          {parserResult.status === "bukan_promo" && (
            <Card className="p-6">
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
      <Card className="p-6">
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
      <Card className="p-6">
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
    <Card className="p-6">
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {fieldKeys.map(key => (
                    <div key={key} className="bg-muted rounded-lg p-3">
                      <span className="text-muted-foreground text-xs block mb-1">
                        {FIELD_LABELS[key]}
                      </span>
                      <span className="text-foreground font-medium break-words">
                        {formatPromoFieldValue(promo, key)}
                      </span>
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
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Button
                      variant="golden"
                      size="sm"
                      onClick={() => onCopyCleanText(promo)}
                      disabled={requiredGapsUnfilled > 0}
                      className={
                        requiredGapsUnfilled > 0
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }
                    >
                      <Copy className="h-4 w-4" />
                      Copy Clean Text
                    </Button>
                    {requiredGapsUnfilled > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Lengkapi {requiredGapsUnfilled} data wajib terlebih dahulu
                      </div>
                    )}
                  </div>
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
  onConfirm,
}: {
  gaps: ParserGap[];
  fills: Record<string, string>;
  onFillChange: (field: string, value: string) => void;
  onConfirm: () => void;
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

            {(() => {
              const requiredGaps = gaps.filter(g => g.severity === "required");
              const isConfirmDisabled =
                requiredGaps.length > 0 &&
                requiredGaps.some(g => {
                  const val = fills[g.field];
                  return !val || val.trim().length < 3;
                });
              return (
                <>
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
                </>
              );
            })()}
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
