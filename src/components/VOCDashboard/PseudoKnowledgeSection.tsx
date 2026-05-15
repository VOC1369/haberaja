/**
 * PROMO EXTRACTOR — V.10.2 native
 *
 * Single source of truth: `pkRecord: PkV10Record`.
 * No legacy V.09 bridge, no field-status legacy detector, no category-classifier.
 *
 * Data plumbing:
 *  - Extraction → `extractPromoV10` (pk-extractor edge fn) → PkV10Record.
 *  - URL fetch → `fetchUrlContent` (netral, no extractor logic).
 *  - All UI display reads via `sel.*` (pk-v10-selectors) or PkV10Subcategory.
 *
 * Storage:
 *  - sessionStorage for temporary state (via `pkSession.save({ pkRecord })`).
 *  - localStorage for final commit to KB (via `savePkRecord(pkRecord)`).
 */

import { useState, useRef, useEffect } from "react";
import {
  Sparkles, Loader2, CheckCircle2, AlertTriangle, Copy, ChevronDown,
  X, RotateCcw, Plus, ArrowUp, RefreshCw, FileJson, Download,
  Globe, Calendar, Trophy, Info, Ban,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import wolfclawIcon from "@/assets/wolfclaw-icon.png";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/lib/notify";

import { pkSession, type InputMode } from "@/features/promo-knowledge/storage/session-storage";
import { extractPromoV10 } from "@/features/promo-knowledge/extractor/extract-client";
import { fetchUrlContent } from "@/features/promo-knowledge/extractor/fetch-url-content";
import { saveRecord as savePkRecord } from "@/features/promo-knowledge/storage/local-storage";
import type { PkV10Record, PkV10Subcategory } from "@/features/promo-knowledge/schema/pk-v10";
import { sel } from "@/features/promo-knowledge/selectors/pk-v10-selectors";
import { AdminVerifySection } from "@/features/promo-knowledge/admin-verify/AdminVerifySection";

// ───────────────────────────────────────────────────────────────────────────
// Local UI helpers — V.10.2 native badge/status formatters.
// ───────────────────────────────────────────────────────────────────────────

type StatusKind = "draft" | "ready";

const STATUS_BADGE_STYLE: Record<StatusKind, string> = {
  ready: "bg-success/20 text-success border-0",
  draft: "bg-blue-500/20 text-blue-400 border-0",
};
const STATUS_LABEL: Record<StatusKind, string> = {
  ready: "Siap",
  draft: "Draft",
};

const getStatusBadgeStyle = (s: string | null): string => {
  if (s === "ready" || s === "draft") return STATUS_BADGE_STYLE[s];
  return "bg-muted text-muted-foreground border-0";
};
const getStatusLabel = (s: string | null): string => {
  if (s === "ready" || s === "draft") return STATUS_LABEL[s];
  return "-";
};

// COMBO summary helpers — read PkV10Subcategory[] only. No legacy infer.
const getVariantPayoutSummary = (subs: PkV10Subcategory[]): string => {
  const depan = subs.filter(s => s.payout_direction === "depan").length;
  const belakang = subs.filter(s => s.payout_direction === "belakang").length;
  if (depan > 0 && belakang > 0) return "Campuran";
  if (depan > 0) return "Depan";
  if (belakang > 0) return "Belakang";
  return "-";
};

const getVariantGameDomainSummary = (subs: PkV10Subcategory[]): string => {
  const domains = [...new Set(subs.map(s => s.game_domain).filter((d): d is string => !!d))];
  if (domains.length === 0) return "-";
  const formatted = domains.map(d => d.charAt(0).toUpperCase() + d.slice(1));
  if (formatted.length > 3) return `${formatted.slice(0, 2).join(", ")} +${formatted.length - 2}`;
  return formatted.join(", ");
};

const getBlacklistSummary = (record: PkV10Record): string => {
  const subs = sel.subcategories(record);
  const subWithBL = subs.filter(s => s.blacklist?.enabled).length;
  const globalActive = sel.globalBlacklistActive(record);
  if (globalActive && subWithBL > 0) return `Global + ${subWithBL} Varian`;
  if (globalActive) return "Global Aktif";
  if (subWithBL > 0) return `${subWithBL} Varian`;
  return "Tidak Aktif";
};

// Plain string formatters (display only).
const formatRewardLabel = (type: string | null | undefined): string => {
  switch (type) {
    case "lucky_spin": return "Lucky Spin";
    case "voucher": return "Voucher";
    case "ticket": return "Ticket";
    case "physical":
    case "hadiah_fisik": return "Hadiah Fisik";
    case "uang_tunai":
    case "cash": return "Uang Tunai";
    default: return "Credit Game";
  }
};

const formatRewardColor = (type: string | null | undefined): string => {
  switch (type) {
    case "lucky_spin": return "text-purple-400";
    case "voucher": return "text-blue-400";
    case "ticket": return "text-cyan-400";
    case "physical":
    case "hadiah_fisik": return "text-amber-400";
    case "uang_tunai":
    case "cash": return "text-green-400";
    default: return "text-foreground";
  }
};

const formatGameDomainLabel = (domain: string | null | undefined): string => {
  if (!domain) return "-";
  return domain.charAt(0).toUpperCase() + domain.slice(1);
};

interface PseudoKnowledgeSectionProps {
  onNavigateToPromo?: () => void;
}

export function PseudoKnowledgeSection({ onNavigateToPromo }: PseudoKnowledgeSectionProps) {
  // Input state
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [currentInput, setCurrentInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Extraction state — pkRecord is THE source of truth.
  const [pkRecord, setPkRecord] = useState<PkV10Record | null>(null);
  const [pkStatus, setPkStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [pkElapsedSec, setPkElapsedSec] = useState(0);
  const [pkFailReason, setPkFailReason] = useState<string>("");
  const [extractionSource, setExtractionSource] = useState<string | null>(null);

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionElapsedMs, setExtractionElapsedMs] = useState(0);

  // Navigation guards
  const [hasUnsavedData, setHasUnsavedData] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // "JSON belum tersedia" prompt
  const [showJsonMissingDialog, setShowJsonMissingDialog] = useState(false);
  const [jsonMissingAction, setJsonMissingAction] = useState<string>("");

  const scrollBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCancelExtract = () => {
    abortControllerRef.current?.abort();
    setIsExtracting(false);
    setPkStatus("idle");
    toast.info("Ekstraksi dibatalkan");
  };

  // ============================================
  // SESSION RESTORE — pkRecord only
  // ============================================
  useEffect(() => {
    // Parser handoff: if Parser sent us clean text, pre-fill input and skip session restore.
    try {
      const handoff = localStorage.getItem("parser_handoff_text_v1");
      if (handoff && handoff.trim()) {
        localStorage.removeItem("parser_handoff_text_v1");
        setInputMode("text" as InputMode);
        setCurrentInput(handoff);
        toast.info("Hasil Parser siap diekstrak", {
          description: "Klik panah untuk mulai ekstraksi.",
          duration: 3000,
        });
        return;
      }
    } catch {
      // ignore localStorage errors
    }

    const saved = pkSession.load();
    if (!saved) return;

    const savedPk = (saved as { pkRecord?: PkV10Record | null }).pkRecord;
    if (savedPk && typeof savedPk === "object") {
      setPkRecord(savedPk as PkV10Record);
      setPkStatus("ready");
      setInputMode((saved.inputMode as InputMode) || "url");
      setCurrentInput(saved.lastInput || "");
      setImagePreview(saved.imagePreview || null);
      toast.info("Data Dipulihkan", { duration: 3000 });
    }
  }, []);

  // ============================================
  // AUTO-SAVE ON CHANGES
  // ============================================
  useEffect(() => {
    if (pkRecord) {
      pkSession.save({
        pkRecord,
        inputMode,
        lastInput: currentInput,
        imagePreview,
      });
    }
    setHasUnsavedData(!!pkRecord);
  }, [pkRecord, inputMode, currentInput, imagePreview]);

  // Browser close warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedData) {
        e.preventDefault();
        e.returnValue = "Hasil ekstraksi belum digunakan. Yakin mau keluar?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedData]);

  // Auto-scroll
  useEffect(() => {
    if (pkRecord || isExtracting) {
      setTimeout(() => {
        scrollBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }, [pkRecord, isExtracting]);

  // Extraction timer
  useEffect(() => {
    if (!isExtracting) {
      setExtractionElapsedMs(0);
      return;
    }
    const startedAt = Date.now();
    setExtractionElapsedMs(0);
    const interval = setInterval(() => {
      setExtractionElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(interval);
  }, [isExtracting]);

  // PK extractor timer
  useEffect(() => {
    if (pkStatus !== "loading") {
      setPkElapsedSec(0);
      return;
    }
    const startedAt = Date.now();
    setPkElapsedSec(0);
    const interval = setInterval(() => {
      setPkElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, [pkStatus]);

  // ============================================
  // IMAGE UPLOAD
  // ============================================
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
      setImagePreview(base64);
      setImageBase64(base64);
      toast.success("Image berhasil diupload", { description: file.name });
    };
    reader.onerror = () => toast.error("Gagal membaca file");
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-primary", "bg-primary/5");
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa image (PNG, JPG, WebP)");
      return;
    }
    processImageFile(file);
  };

  const detectInputType = (input: string): "url" | "html" => {
    if (input.startsWith("http://") || input.startsWith("https://")) return "url";
    return "html";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processImageFile(file);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    if (extractionSource === "image" || extractionSource === "multimodal") {
      setPkRecord(null);
      setPkStatus("idle");
      setExtractionSource(null);
      pkSession.clear();
      toast.info("Image dan hasil ekstraksi dihapus");
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await processImageFile(file);
          toast.success("Image dari clipboard berhasil di-paste");
        }
        return;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isExtracting && (currentInput.trim() || imageBase64)) {
        handleExtract();
      }
    }
  };

  // ============================================
  // MAIN EXTRACT — V.10 native only
  // ============================================
  const handleExtract = async () => {
    setIsExtracting(true);
    setPkStatus("loading");
    setPkRecord(null);
    setPkFailReason("");

    try {
      let textPayload = "";
      let imagePayloads: string[] = [];

      if (imageBase64) {
        imagePayloads = [imageBase64];
        const hasTextContext = currentInput.trim().length > 50;
        if (hasTextContext) {
          setInputMode("hybrid");
          textPayload = currentInput.trim();
        } else {
          setInputMode("image");
        }
      } else if (currentInput.trim()) {
        const detectedType = detectInputType(currentInput.trim());
        setInputMode(detectedType);
        if (detectedType === "url") {
          try {
            const html = await fetchUrlContent(currentInput);
            if (!html || html.length < 500) throw new Error("Konten tidak valid");
            toast.success(`Berhasil fetch ${(html.length / 1024).toFixed(1)}KB`);
            textPayload = html;
          } catch {
            toast.error("Gagal fetch URL. Coba paste HTML manual atau upload screenshot.");
            setIsExtracting(false);
            setPkStatus("idle");
            return;
          }
        } else {
          setInputMode("text");
          textPayload = currentInput;
        }
      } else {
        toast.error("Tidak ada input untuk diproses");
        setIsExtracting(false);
        setPkStatus("idle");
        return;
      }

      const pkStartedAt = Date.now();
      const pk = await extractPromoV10({
        text: textPayload,
        images: imagePayloads,
        client_id_hint: "",
      });

      if (pk.ok && pk.record) {
        setPkRecord(pk.record);
        setExtractionSource(pk.extraction_source ?? null);
        setPkStatus("ready");
        console.log("[Phase2C/PK] pkRecord siap", {
          elapsed_ms: Date.now() - pkStartedAt,
          model: pk.model,
          extraction_source: pk.extraction_source,
        });

        pkSession.save({
          pkRecord: pk.record,
          inputMode,
          lastInput: currentInput,
          imagePreview,
        });

        const status = sel.validationStatus(pk.record);
        if (status === "ready") {
          toast.success("Ekstraksi selesai! Promo siap digunakan.");
        } else {
          toast.info("Ekstraksi selesai. Review data sebelum melanjutkan.", {
            description: "Klik 'Gunakan Promo' untuk simpan sebagai draft.",
          });
        }
      } else {
        setPkStatus("failed");
        setPkFailReason(pk.error || "UNKNOWN");
        console.warn("[Phase2C/PK] extractor gagal:", pk.error, pk.message);
        toast.error(`Ekstraksi gagal — ${pk.error || "UNKNOWN"}`, {
          description: pk.message,
        });
      }
    } catch (error) {
      console.error("Extraction error:", error);
      setPkStatus("failed");
      setPkFailReason("EXCEPTION");
      toast.error("Gagal mengekstrak promo", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  // ============================================
  // ACTIONS
  // ============================================
  const handleRestart = () => {
    setPkRecord(null);
    setPkStatus("idle");
    setPkFailReason("");
    setExtractionSource(null);
    setIsExtracting(false);
    setInputMode("url");
    setCurrentInput("");
    setImagePreview(null);
    setImageBase64(null);
    setHasUnsavedData(false);
    pkSession.clear();
    toast.success("Extractor direset", { description: "Siap untuk ekstraksi baru" });
  };

  const handleReExtract = () => {
    if (isExtracting) return;
    if (!currentInput.trim() && !imageBase64) {
      toast.error("Tidak ada input untuk di-extract ulang");
      return;
    }
    setPkRecord(null);
    setPkStatus("idle");
    setPkFailReason("");
    handleExtract();
  };

  const handleCopyJSON = async () => {
    if (!pkRecord) {
      if (pkStatus === "loading") {
        toast.info("Pseudo Engine masih memproses", { description: "Tunggu badge ✅ siap, lalu coba lagi." });
        return;
      }
      setJsonMissingAction("Copy JSON");
      setShowJsonMissingDialog(true);
      return;
    }
    try {
      const jsonString = JSON.stringify(pkRecord, null, 2);
      const label = `${jsonString.length} karakter • Pseudo Engine V.10 (PkV10Record)`;
      await navigator.clipboard.writeText(jsonString);
      toast.success("JSON disalin ke clipboard", { description: label });
    } catch {
      toast.error("Gagal menyalin ke clipboard");
    }
  };

  const handleDownloadJSON = () => {
    if (!pkRecord) {
      if (pkStatus === "loading") {
        toast.info("Pseudo Engine masih memproses", { description: "Tunggu badge ✅ siap, lalu coba lagi." });
        return;
      }
      setJsonMissingAction("Download JSON");
      setShowJsonMissingDialog(true);
      return;
    }
    try {
      const jsonString = JSON.stringify(pkRecord, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `pkb-wolfbrain-v10-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("JSON file di-download");
    } catch (e) {
      console.error("Download JSON failed", e);
      toast.error("Gagal download JSON");
    }
  };

  const handleCommitPromo = () => {
    if (!pkRecord) {
      if (pkStatus === "loading") {
        toast.info("Pseudo Engine masih memproses", { description: "Tunggu badge ✅ siap, lalu coba lagi." });
        return;
      }
      setJsonMissingAction("Gunakan Promo");
      setShowJsonMissingDialog(true);
      return;
    }

    if (sel.programClassification(pkRecord) === "C") {
      toast.info("Ini adalah System Rule, bukan promo", {
        description: "Aturan sistem tidak disimpan ke Promo KB. Gunakan Copy JSON jika perlu referensi.",
        duration: 5000,
      });
      return;
    }

    try {
      savePkRecord(pkRecord);
      toast.success("Promo anda berhasil disimpan sebagai Draft.", {
        description: "Anda bisa melakukan edit dan verifikasi di option edit.",
      });
      handleRestart();
      if (onNavigateToPromo) onNavigateToPromo();
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Gagal menyimpan draft", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // ============================================
  // RENDER — VARIANT CARD (V.10.1 selectors only)
  // ============================================
  const renderSubCategoryCard = (
    sub: PkV10Subcategory,
    idx: number,
    attachGlobalBlacklist: boolean,
  ) => {
    const record = pkRecord!;

    // Per-variant blacklist
    const subBL = sub.blacklist;
    const hasPerVariantBlacklist = subBL?.enabled && (
      (subBL.types?.length || 0) > 0 ||
      (subBL.providers?.length || 0) > 0 ||
      (subBL.games?.length || 0) > 0 ||
      (subBL.rules?.length || 0) > 0
    );

    // Global blacklist (attached to the designated card only)
    const gbl = attachGlobalBlacklist ? sel.gameBlacklist(record) : { providers: [], games: [], rules: [] };
    const gblTypes: string[] = []; // Step 7 selector intentionally omits types[]
    const hasGlobalBlacklist =
      gbl.providers.length + gbl.games.length + gbl.rules.length + gblTypes.length > 0;

    const hasBlacklist = hasPerVariantBlacklist || hasGlobalBlacklist;

    const isFixedMode = sel.rewardMode(record) === "fixed";
    const variantRewardType = sub.reward_type ?? sel.rewardType(record);
    const isUnitBased = isFixedMode && ["lucky_spin", "voucher", "ticket"].includes(variantRewardType ?? "");
    const isApkPromo = sel.apkRequired(record) || sel.triggerEvent(record) === "apk_download";

    const variantName = sel.subVariantName(record, idx) ?? `Varian ${idx + 1}`;
    const subCount = sel.subcategoryCount(record);

    // Calculation display
    const calcMethod = sub.calculation_method ?? null;
    const calcValue = sub.calculation_value;

    // Min Deposit display
    const minDepoValue = sub.min_deposit ?? sel.minDeposit(record);

    // Max reward display
    const maxRewardUnlimited = sub.max_reward_unlimited === true;
    const maxRewardValue = sub.max_reward;

    return (
      <div
        key={idx}
        className="bg-card border border-border rounded-xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h4 className="text-base font-semibold text-button-hover">{variantName}</h4>
          </div>
          {subCount > 1 && (
            <Badge variant="outline" className="text-xs text-muted-foreground border-0 bg-muted">
              Varian {idx + 1}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {/* Calculation / Reward value */}
          {!isUnitBased && (
            <div className="bg-muted rounded-lg p-3">
              <span className="text-muted-foreground text-xs block mb-1">
                {calcMethod === "threshold" ? "Target" : "Perhitungan Bonus"}
              </span>
              <span className="text-button-hover font-semibold">
                {calcValue != null && calcValue > 0
                  ? calcMethod === "fixed"
                    ? `Rp ${Number(calcValue).toLocaleString("id-ID")}`
                    : calcMethod === "percentage"
                      ? `${calcValue}%`
                      : `Rp ${Number(calcValue).toLocaleString("id-ID")}`
                  : "-"}
              </span>
            </div>
          )}

          {/* Min Deposit */}
          <div className="bg-muted rounded-lg p-3">
            <span className="text-muted-foreground text-xs block mb-1">Min Deposit</span>
            <span className="text-foreground font-medium">
              {minDepoValue != null ? `Rp ${Number(minDepoValue).toLocaleString("id-ID")}` : "-"}
            </span>
          </div>

          {/* Max Bonus / Max Claim Reward */}
          <div className="bg-muted rounded-lg p-3">
            {isUnitBased ? (
              <>
                <span className="text-muted-foreground text-xs block mb-1">Max Claim Reward</span>
                <span className="text-foreground font-medium">
                  {(() => {
                    const cap = sub.lucky_spin_max_per_day ?? sel.luckySpinMaxPerDay(record);
                    return cap != null ? `${cap} / hari` : "Unlimited";
                  })()}
                </span>
              </>
            ) : (
              <>
                <span className="text-muted-foreground text-xs block mb-1">Max Bonus</span>
                <span className="text-foreground font-medium">
                  {maxRewardUnlimited
                    ? "Unlimited"
                    : maxRewardValue != null && maxRewardValue > 0
                      ? `Rp ${Number(maxRewardValue).toLocaleString("id-ID")}`
                      : "-"}
                </span>
              </>
            )}
          </div>

          {/* Reward type */}
          <div className="bg-muted rounded-lg p-3">
            <span className="text-muted-foreground text-xs block mb-1">Jenis Hadiah</span>
            <span className={`font-medium ${formatRewardColor(variantRewardType)}`}>
              {formatRewardLabel(variantRewardType)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Turnover */}
          <div className="bg-muted rounded-lg p-3">
            <span className="text-muted-foreground text-xs block mb-1">Turnover</span>
            {(() => {
              const basis = record?.taxonomy_engine?.logic_block?.turnover_basis;
              const normalized = typeof basis === "string" ? basis.trim().toLowerCase() : basis;
              if (normalized === "none") {
                return <span className="text-muted-foreground/60 italic">Tidak Berlaku</span>;
              }
              if (normalized == null || normalized === "") {
                return <span className="text-warning italic">Perlu Verifikasi</span>;
              }
              return <span className="text-foreground font-medium">Memiliki Syarat Turnover</span>;
            })()}
          </div>

          {/* Payout */}
          <div className="bg-muted rounded-lg p-3">
            <span className="text-muted-foreground text-xs block mb-1">Payout</span>
            {(() => {
              if (isApkPromo) return <span className="text-muted-foreground/60 italic">-</span>;
              const payoutValue = sub.payout_direction ?? sel.payoutDirection(record);
              const isDepan = payoutValue === "depan";
              const isBelakang = payoutValue === "belakang";
              return (
                <span className={`font-semibold ${isDepan ? "text-success" : isBelakang ? "text-warning" : "text-muted-foreground"}`}>
                  {isDepan ? "DEPAN" : isBelakang ? "BELAKANG" : "-"}
                </span>
              );
            })()}
          </div>

          {/* Game domain */}
          <div className="bg-muted rounded-lg p-3">
            <span className="text-muted-foreground text-xs block mb-1">Jenis Game</span>
            {isApkPromo ? (
              <span className="text-muted-foreground/60 italic">-</span>
            ) : (
              <span className="text-foreground font-medium">
                {formatGameDomainLabel(sub.game_domain ?? sel.gameDomain(record))}
              </span>
            )}
          </div>

          {/* Blacklist flag */}
          <div className="bg-muted rounded-lg p-3">
            <span className="text-muted-foreground text-xs block mb-1">Blacklist</span>
            <span className={`font-medium ${hasBlacklist ? "text-destructive" : "text-muted-foreground"}`}>
              {hasBlacklist ? "Aktif" : "Tidak Aktif"}
            </span>
          </div>
        </div>

        {/* Lucky Spin / Voucher / Ticket details */}
        {isUnitBased && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-400">
                Detail {variantRewardType === "lucky_spin" ? "Lucky Spin" : variantRewardType === "voucher" ? "Voucher" : "Ticket"}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted rounded-lg p-3">
                <span className="text-muted-foreground text-xs block mb-1">Jumlah Reward</span>
                <span className="text-foreground font-medium">
                  {sub.reward_quantity ?? sel.physicalQuantity(record) ?? 1}
                </span>
              </div>
              {variantRewardType === "lucky_spin" && (
                <>
                  <div className="bg-muted rounded-lg p-3">
                    <span className="text-muted-foreground text-xs block mb-1">Max Spin/Hari</span>
                    <span className="text-foreground font-medium">
                      {sub.lucky_spin_max_per_day ?? sel.luckySpinMaxPerDay(record) ?? "-"}
                    </span>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <span className="text-muted-foreground text-xs block mb-1">ID Lucky Spin</span>
                    <span className="text-foreground font-medium">
                      {sub.lucky_spin_id ?? sel.luckySpinRefId(record) ?? "-"}
                    </span>
                  </div>
                </>
              )}
              {variantRewardType === "voucher" && (
                <div className="bg-muted rounded-lg p-3">
                  <span className="text-muted-foreground text-xs block mb-1">Jenis Voucher</span>
                  <span className="text-foreground font-medium">
                    {sub.voucher_kind ?? sel.voucherKind(record) ?? "Umum"}
                  </span>
                </div>
              )}
              <div className="bg-muted rounded-lg p-3">
                <span className="text-muted-foreground text-xs block mb-1">Waktu Berlaku</span>
                {(() => {
                  const unlimited = sub.voucher_valid_unlimited === true || sel.spinValidUntilUnlimited(record);
                  const validUntil = sub.voucher_valid_until ?? sel.spinValidUntil(record);
                  if (unlimited) return <span className="text-foreground font-medium">Tidak Terbatas</span>;
                  if (validUntil) return <span className="text-foreground font-medium">{validUntil}</span>;
                  return <span className="text-muted-foreground/60 italic text-xs">Belum tersedia dari PromoKnowledgeRecord V.10.2</span>;
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Physical reward details */}
        {variantRewardType === "physical" && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-400">Detail Hadiah Fisik</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted rounded-lg p-3">
                <span className="text-muted-foreground text-xs block mb-1">Nama Item</span>
                <span className="text-foreground font-medium">
                  {sub.physical_reward_name ?? sel.physicalItemName(record) ?? "-"}
                </span>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <span className="text-muted-foreground text-xs block mb-1">Jumlah Item</span>
                <span className="text-foreground font-medium">
                  {(() => {
                    const q = sub.physical_reward_quantity ?? sel.physicalQuantity(record);
                    return q !== null && q !== undefined ? q.toLocaleString("id-ID") : "-";
                  })()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Blacklist details */}
        {hasBlacklist && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="bg-destructive/10 rounded-lg p-3">
              <span className="text-destructive text-xs font-medium flex items-center gap-1 mb-2">
                <Ban className="w-3 h-3" />
                Blacklist:
              </span>
              {(() => {
                const rules = [...(subBL?.rules ?? []), ...gbl.rules];
                const providers = [...(subBL?.providers ?? []), ...gbl.providers];
                const types = [...(subBL?.types ?? [])];
                const games = [...(subBL?.games ?? []), ...gbl.games];
                return (
                  <>
                    {rules.length > 0 && (
                      <ul className="list-disc list-inside text-xs text-foreground">
                        {rules.map((rule, i) => <li key={i}>{rule}</li>)}
                      </ul>
                    )}
                    {providers.length > 0 && (
                      <div className="mt-2">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Providers</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {providers.map((p, i) => (
                            <Badge key={i} variant="outline" className="text-xs bg-destructive/20 text-destructive border-0">{p}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {types.length > 0 && (
                      <div className="mt-2">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Types</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {types.map((t, i) => (
                            <Badge key={i} variant="outline" className="text-xs bg-destructive/20 text-destructive border-0">{t}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {games.length > 0 && (
                      <div className="mt-2">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Games</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {games.map((g, i) => (
                            <Badge key={i} variant="outline" className="text-xs bg-destructive/20 text-destructive border-0">{g}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER — RESULT CARD
  // ============================================
  const renderExtractedData = () => {
    if (!pkRecord) return null;

    const headerPromoName = sel.promoName(pkRecord) ?? "-";
    const headerStatusRaw = sel.validationStatus(pkRecord);
    const headerClientId = sel.clientId(pkRecord);
    const headerWarnings = sel.validationWarnings(pkRecord);
    const promoMode = sel.promoMode(pkRecord);
    const promoType = sel.promoType(pkRecord) ?? "";
    const isReferral = /referral|referal|refferal|ajak.*teman/i.test(promoType);
    const subs = sel.subcategories(pkRecord);
    const termsList = sel.termsConditions(pkRecord);
    const requirementsList = sel.specialRequirements(pkRecord);

    return (
      <Card className="w-full bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 flex items-start gap-4">
          <div className="icon-circle">
            {headerStatusRaw === "ready" ? (
              <CheckCircle2 className="icon-circle-icon" />
            ) : (
              <Info className="icon-circle-icon text-blue-400" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-foreground">{headerPromoName}</h3>
              <Badge variant="outline" className={getStatusBadgeStyle(headerStatusRaw)}>
                {headerStatusRaw === "ready" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                {headerStatusRaw === "draft" && <Info className="w-3 h-3 mr-1" />}
                {getStatusLabel(headerStatusRaw)}
              </Badge>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {headerClientId && (
                <Badge variant="outline" className="bg-cyan-500/20 text-cyan-400 border-0 gap-1.5">
                  <Globe className="h-3 w-3" />
                  {headerClientId}
                </Badge>
              )}
              {(() => {
                const unlimited = sel.validUntilUnlimited(pkRecord);
                const validUntil = sel.promoValidUntil(pkRecord);
                const display = unlimited ? "Tidak Terbatas" : validUntil ?? "-";
                return (
                  <Badge variant="outline" className="bg-muted text-foreground border-0 gap-1.5">
                    <Calendar className="h-3 w-3" />
                    Periode Promo: {display}
                  </Badge>
                );
              })()}
              {(() => {
                const unlimited = sel.maxRewardUnlimited(pkRecord);
                const maxR = sel.maxReward(pkRecord);
                const display = unlimited ? "Tidak Terbatas" : maxR !== null ? maxR.toLocaleString("id-ID") : "-";
                return (
                  <Badge variant="outline" className="bg-muted text-foreground border-0 gap-1.5">
                    <Trophy className="h-3 w-3" />
                    Max Total Reward: {display}
                  </Badge>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Image Source Warning */}
        {(extractionSource === "image" || extractionSource === "multimodal") && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-500">
                Data diekstrak dari image — mohon verifikasi angka-angka penting sebelum commit.
              </p>
            </div>
          </div>
        )}

        {/* COMBO Summary Bar — multi-variant */}
        {promoMode === "multi" && subs.length > 1 && !isReferral && (
          <div className="px-6 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-muted rounded-lg p-3 text-center">
                <span className="text-2xl font-bold text-button-hover">{subs.length}</span>
                <span className="text-xs text-muted-foreground block mt-1">Sub Kategori</span>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <span className="text-sm font-semibold text-foreground">{getVariantPayoutSummary(subs)}</span>
                <span className="text-xs text-muted-foreground block mt-1">Payout</span>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <span className="text-sm font-semibold text-foreground capitalize">{getVariantGameDomainSummary(subs)}</span>
                <span className="text-xs text-muted-foreground block mt-1">Game Domain</span>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <span className={`text-sm font-semibold ${sel.globalBlacklistActive(pkRecord) || subs.some(s => s.blacklist?.enabled) ? "text-destructive" : "text-muted-foreground"}`}>
                  {getBlacklistSummary(pkRecord)}
                </span>
                <span className="text-xs text-muted-foreground block mt-1">Blacklist</span>
              </div>
            </div>
          </div>
        )}

        {/* Referral tier summary */}
        {isReferral && subs.length > 0 && (
          <div className="px-6 pb-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-3">Struktur Tier Komisi</p>
              <div className="space-y-2">
                {[...subs]
                  .sort((a, b) => (Number(a.calculation_value) || 0) - (Number(b.calculation_value) || 0))
                  .map((tier, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-card rounded-lg px-3 py-2">
                      <span className="text-foreground font-medium">{tier.variant_name || `Tier ${idx + 1}`}</span>
                      <Badge className="bg-button-hover/20 text-button-hover border-0">
                        {tier.calculation_value ?? "-"}%
                      </Badge>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-6 pb-6 space-y-6">
          {/* Validation warnings */}
          {headerWarnings.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <h4 className="text-blue-400 font-medium text-sm flex items-center gap-2 mb-2">
                <Info className="w-4 h-4" />
                Review ({headerWarnings.length}) — Dapat dilengkapi manual
              </h4>
              <ul className="list-disc list-outside pl-4 space-y-1 text-sm text-muted-foreground">
                {headerWarnings.map((warn, idx) => <li key={idx}>{warn}</li>)}
              </ul>
            </div>
          )}

          {/* Subcategories — only for non-referral, render full variant cards */}
          {!isReferral && subs.length > 0 && (
            <div>
              {subs.length > 1 && (
                <h4 className="text-base font-semibold text-button-hover mb-4">
                  Sub Kategori ({subs.length} Varian)
                </h4>
              )}
              <div className="space-y-4">
                {(() => {
                  const sortedSubs = [...subs].sort(
                    (a, b) => (Number(a.calculation_value) || 0) - (Number(b.calculation_value) || 0),
                  );
                  // Pick attach target for global blacklist: variant whose game_domain is "slot",
                  // else first variant.
                  const slotIdx = sortedSubs.findIndex(s => /slot/i.test(String(s.game_domain ?? "")));
                  const attachIdx = slotIdx >= 0 ? slotIdx : 0;
                  return sortedSubs.map((sub, idx) =>
                    renderSubCategoryCard(sub, idx, idx === attachIdx),
                  );
                })()}
              </div>
            </div>
          )}

          {/* Special Requirements */}
          {requirementsList.length > 0 && (
            <div>
              <h4 className="text-base font-semibold text-amber-500 mb-4">Syarat Khusus</h4>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <div className="flex flex-wrap gap-2">
                  {requirementsList.map((req, idx) => (
                    <Badge key={idx} variant="outline" className="bg-amber-500/20 text-amber-400 border-0">
                      {req}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Terms & Conditions */}
          {termsList.length > 0 && (
            <div>
              <h4 className="text-base font-semibold text-button-hover mb-4">Syarat & Ketentuan</h4>
              <div className="bg-muted rounded-lg p-4">
                <ul className="list-disc list-outside pl-4 space-y-1 text-sm text-foreground">
                  {termsList.map((term, idx) => <li key={idx}>{term}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  };

  // ============================================
  // MAIN RENDER
  // ============================================
  const showInputCard = !pkRecord && !isExtracting;

  return (
    <div className="relative flex flex-col h-[calc(100vh-120px)]">
      <ScrollArea className="flex-1">
        <div className={`page-wrapper p-6 pb-20 ${showInputCard ? "min-h-[calc(100vh-160px)] flex flex-col justify-center" : ""} space-y-6`}>

          {/* INPUT SECTION */}
          {showInputCard && (
            <Card className="p-8">
              <div className="flex flex-col items-center text-center gap-3 mb-8">
                <img src={wolfclawIcon} alt="Wolfclaw" className="h-12 w-12 rounded-xl" />
                <h2 className="text-2xl font-semibold text-foreground">Promo Extractor</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Paste link, HTML, atau drop screenshot — AI akan mengekstrak ke format Knowledge Base.
                </p>
                <Badge className="bg-success/10 text-success border-0 mt-1 hover:bg-success/15">
                  <span className="w-2 h-2 rounded-full bg-success mr-2" />
                  Wolfclaw AI
                </Badge>
              </div>

              {imagePreview && currentInput.trim().length > 50 && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Badge className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-0 text-blue-600 dark:text-blue-400">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Mode HYBRID aktif
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Text = angka & syarat | Image = layout
                  </span>
                </div>
              )}

              {imagePreview && (
                <div className="relative mb-6 flex justify-center">
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="Preview" className="max-h-48 rounded-lg shadow-md border border-border" />
                    <Button variant="destructive" size="icon-sm" className="absolute -top-2 -right-2 rounded-full" onClick={clearImage}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-2xl border bg-background transition-colors ${
                  isDragOver ? "border-button-hover bg-button-hover/5" : "border-border hover:border-border/80"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Textarea
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={handleKeyDown}
                  placeholder={isDragOver ? "Lepaskan untuk upload screenshot…" : "Paste link promo atau konten promo..."}
                  className="min-h-40 max-h-80 resize-none border-0 bg-transparent px-5 pt-5 pb-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                  disabled={isExtracting}
                />
                <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isExtracting}
                      className="h-9 w-9 rounded-full bg-muted hover:bg-muted/80 text-foreground shrink-0"
                      title="Lampirkan screenshot"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="golden"
                    size="icon"
                    onClick={handleExtract}
                    disabled={isExtracting || (!currentInput.trim() && !imageBase64)}
                    className="h-9 w-9 rounded-full shrink-0"
                    title="Ekstrak promo (Enter)"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs text-muted-foreground">
                  Wolfclaw menggunakan AI dan bisa melakukan kesalahan. Pastikan lakukan pengecekan ganda.
                </p>
              </div>
            </Card>
          )}

          {/* PROCESSING STATE */}
          {isExtracting && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="rounded-xl border border-border bg-muted/40 p-5 space-y-4 w-full max-w-3xl pointer-events-auto">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative h-10 w-10 rounded-full bg-button-hover/15 flex items-center justify-center shrink-0">
                      <Loader2 className="h-5 w-5 text-button-hover animate-spin" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">Extractor V.10.2 sedang bekerja…</div>
                      <div className="text-xs text-muted-foreground">
                        Engine dan Canonical Projection
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-sm font-mono tabular-nums text-foreground" aria-live="polite">
                      {(() => {
                        const totalSec = Math.floor(extractionElapsedMs / 1000);
                        const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
                        const ss = String(totalSec % 60).padStart(2, "0");
                        return `${mm}:${ss}`;
                      })()}
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCancelExtract} className="rounded-full">
                      <X className="h-3.5 w-3.5" />
                      Batal
                    </Button>
                  </div>
                </div>

                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="pseudo-shimmer absolute inset-y-0 w-1/3 rounded-full bg-button-hover" />
                </div>
                <style>{`
                  @keyframes pseudo-shimmer-slide {
                    0%   { left: -33%; }
                    100% { left: 100%; }
                  }
                  .pseudo-shimmer {
                    animation: pseudo-shimmer-slide 1.4s ease-in-out infinite;
                  }
                `}</style>
              </div>
            </div>
          )}

          {/* RESULT SECTION */}
          {pkRecord && (
            <>
              {/* SYSTEM RULE BANNER */}
              {sel.programClassification(pkRecord) === "C" && (
                <div className="flex items-start gap-3 p-4 bg-pink-500/10 border border-pink-500/30 rounded-xl">
                  <Info className="w-5 h-5 text-pink-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-medium text-pink-400">System Rule Terdeteksi</h4>
                    <p className="text-sm text-muted-foreground">
                      Ini adalah <strong>aturan sistem</strong>, bukan promo yang bisa diklaim.
                      System Rule tidak akan disimpan ke Promo KB.
                    </p>
                  </div>
                </div>
              )}

              {renderExtractedData()}

              {/* Admin Verification — Phase 1: questions auto-generated from pkRecord */}
              {pkStatus === "ready" && (
                <AdminVerifySection record={pkRecord} onApply={setPkRecord} />
              )}
            </>
          )}

          <div ref={scrollBottomRef} />
        </div>
      </ScrollArea>

      {/* FIXED ACTION BAR */}
      {pkRecord && (
        <div className="footer-bar">
          <div className="footer-bar-content">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleRestart}
                className="h-11 px-6 gap-2 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
              >
                <RotateCcw className="w-4 h-4" />
                Restart
              </Button>
              <Button
                variant="outline"
                onClick={handleReExtract}
                disabled={isExtracting || (!currentInput.trim() && !imageBase64)}
                className="h-11 px-6 gap-2 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
                title="Jalankan ulang extraction dengan input yang sama"
              >
                <RefreshCw className={`w-4 h-4 ${isExtracting ? "animate-spin" : ""}`} />
                Re-Extract
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {pkStatus === "loading" && (
                <div className="h-11 inline-flex items-center px-4 rounded-full border-0 bg-muted text-sm font-medium text-muted-foreground">
                  Menyiapkan {pkElapsedSec}s
                </div>
              )}
              {pkStatus === "ready" && (
                <div className="h-11 inline-flex items-center gap-2 px-4 rounded-full border-0 bg-emerald-500/10 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Wolfbrain.V10
                </div>
              )}
              {pkStatus === "failed" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="h-11 inline-flex items-center gap-2 px-4 rounded-full border-0 bg-destructive/10 text-sm font-medium text-destructive cursor-help">
                        <span className="inline-block w-2 h-2 rounded-full bg-destructive" />
                        Wolfbrain.V10: gagal{pkFailReason ? ` (${pkFailReason})` : ""}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>
                        {pkFailReason === "NO_TOOL_CALL"
                          ? "Claude reply tanpa tool_use. Cek console untuk lihat text reply."
                          : pkFailReason === "INVALID_TOOL_ARGS"
                            ? "Claude panggil tool tapi argumen kosong/invalid."
                            : pkFailReason === "PAYMENT_REQUIRED"
                              ? "Anthropic credits habis. Top-up di console.anthropic.com."
                              : pkFailReason === "RATE_LIMITED"
                                ? "Rate limit Anthropic — coba sebentar lagi."
                                : pkFailReason === "OVERLOADED"
                                  ? "Server Anthropic overload — coba lagi."
                                  : pkFailReason === "EXCEPTION"
                                    ? "Network/JS exception — cek console."
                                    : "Gagal — cek console untuk detail."}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={pkStatus === "loading"}
                    className="h-11 px-6 gap-2"
                    title="Pilih aksi untuk JSON V.10"
                  >
                    <FileJson className="w-4 h-4" />
                    {pkStatus === "loading" ? `Menyiapkan ${pkElapsedSec}s` : "Json File"}
                    <ChevronDown className="w-4 h-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleCopyJSON} className="gap-2 cursor-pointer">
                    <Copy className="w-4 h-4" />
                    Copy JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadJSON} className="gap-2 cursor-pointer">
                    <Download className="w-4 h-4" />
                    Download JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {sel.programClassification(pkRecord) === "C" ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" disabled className="h-11 px-6 gap-2 opacity-50 cursor-not-allowed">
                        <Ban className="w-4 h-4" />
                        Bukan Promo
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>System Rule tidak dapat disimpan ke Promo KB. Ini adalah aturan sistem, bukan promo yang bisa diklaim.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button
                  onClick={handleCommitPromo}
                  variant="golden"
                  disabled={pkStatus === "loading"}
                  className="h-11 px-6 gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {pkStatus === "loading" ? `Menyiapkan ${pkElapsedSec}s` : "Gunakan Promo"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* JSON Missing Dialog */}
      <AlertDialog open={showJsonMissingDialog} onOpenChange={setShowJsonMissingDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              JSON anda belum tersedia
            </AlertDialogTitle>
            <AlertDialogDescription>
              {jsonMissingAction
                ? `"${jsonMissingAction}" butuh JSON V.10 final, tapi belum ada di sesi ini. `
                : "JSON V.10 final belum ada di sesi ini. "}
              Apakah anda ingin extract ulang?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowJsonMissingDialog(false)}>Tidak</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowJsonMissingDialog(false);
                handleReExtract();
              }}
            >
              Ya, extract ulang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Warning Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Hasil ekstraksi belum digunakan
            </AlertDialogTitle>
            <AlertDialogDescription>
              Salin JSON atau klik "Gunakan Promo" sebelum keluar.
              Data akan hilang jika Anda meninggalkan halaman ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowLeaveDialog(false);
                setPendingNavigation(null);
              }}
            >
              Kembali
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                pkSession.clear();
                setShowLeaveDialog(false);
                if (pendingNavigation) {
                  pendingNavigation();
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Lanjutkan Keluar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
