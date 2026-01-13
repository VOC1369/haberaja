/**
 * PROMO EXTRACTOR - Single-Session Extraction Tool
 * 
 * NOT a chat assistant, workspace, or draft manager.
 * Simple: Parse → Mutate → Gate (commit or discard)
 * 
 * Storage:
 * - sessionStorage for temporary state (via extractorSession)
 * - localStorage for final commit to KB (via promoKB)
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { 
  Send, Sparkles, Loader2, FileText, ExternalLink, CheckCircle2, 
  AlertTriangle, Copy, XCircle, AlertCircle, ChevronDown,
  X, RotateCcw, Terminal, HelpCircle, Paperclip, Lightbulb, Ban, Info
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { formatGameTypeLabel, formatProvidersDisplay } from "@/lib/promo-display";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { 
  extractPromoFromContent, 
  extractPromoFromImage,
  fetchUrlContent, 
  getStatusBadgeStyle,
  getStatusLabel,
  mapExtractedToPromoFormData,
  detectRewardArchetype,
  detectGameDomain,
  getFieldStatus,
  type ExtractedPromo,
  type ExtractedPromoSubCategory,
  type ConfidenceLevel,
  type RewardArchetype,
  type GameDomain,
  type TogelEventReward,
  type ProgramCategory,
  type ClassificationConfidence,
  type QAnswer,
  type QualityFlag,
} from "@/lib/openai-extractor";
import { promoKB, extractorSession, type InputMode, type EditHistoryItem } from "@/lib/promo-storage";
import { parseEditCommand, executeEditCommand, COMMAND_EXAMPLES, formatValue } from "@/lib/edit-commands";
import { formatPromoType, getPromoSubTypeDisplay } from "@/lib/utils";
import { ClassificationOverride } from "./ClassificationOverride";
import { ConfidenceGateModal } from "./ConfidenceGateModal";
import type { PromoFormData } from "./PromoFormWizard/types";

// Helper: Title Case for mode badges
const formatPromoMode = (mode: string | null | undefined): string => {
  if (!mode) return '-';
  if (mode === 'multi') return 'Multi Variant';
  if (mode === 'single') return 'Single';
  return mode.charAt(0).toUpperCase() + mode.slice(1);
};

// Helper: Format game type to Titlecase
const formatGameType = (type: string): string => {
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};

// Helper: COMBO Summary - Payout direction (simplified: "Payout: Depan")
const getPayoutSummary = (subs: ExtractedPromoSubCategory[]): string => {
  const depan = subs.filter(s => s.payout_direction === 'depan').length;
  const belakang = subs.filter(s => s.payout_direction === 'belakang').length;
  if (depan > 0 && belakang > 0) return 'Payout: Campuran';
  if (depan > 0) return 'Payout: Depan';
  if (belakang > 0) return 'Payout: Belakang';
  return '-';
};

// Helper: COMBO Summary - Game types
const getGameTypesSummary = (subs: ExtractedPromoSubCategory[]): string => {
  const types = [...new Set(subs.flatMap(s => s.game_types || []))];
  if (types.length === 0) return '-';
  const formatted = types.map(formatGameType);
  if (formatted.length > 3) return `${formatted.slice(0, 2).join(', ')} +${formatted.length - 2}`;
  return formatted.join(', ');
};

// Helper: COMBO Summary - Blacklist status
const getBlacklistSummary = (data: ExtractedPromo): string => {
  const subsWithBlacklist = data.subcategories.filter(s => s.blacklist?.enabled).length;
  const globalActive = data.global_blacklist?.enabled;
  if (globalActive && subsWithBlacklist > 0) return `Global + ${subsWithBlacklist} Varian`;
  if (globalActive) return 'Global Aktif';
  if (subsWithBlacklist > 0) return `${subsWithBlacklist} Varian`;
  return 'Tidak Aktif';
};

export function PseudoKnowledgeSection() {
  // Input state
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [currentInput, setCurrentInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Extraction state  
  const [extractedPromo, setExtractedPromo] = useState<ExtractedPromo | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  // Memoized mapped preview (single source of truth for badge + commit)
  const mappedPreview = useMemo<PromoFormData | null>(() => {
    if (!extractedPromo) return null;
    return mapExtractedToPromoFormData(extractedPromo);
  }, [extractedPromo]);
  
  // Confidence Gate state (LLM Classifier)
  const [showConfidenceGate, setShowConfidenceGate] = useState(false);
  
  // Edit command state
  const [editInput, setEditInput] = useState('');
  const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);
  const [showEditHelp, setShowEditHelp] = useState(false);
  
  // Navigation guards
  const [hasUnsavedData, setHasUnsavedData] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  
  const scrollBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================
  // SESSION RESTORE (SILENT - Toast Only)
  // ============================================
  
  useEffect(() => {
    const saved = extractorSession.load();
    
    if (saved?.extractedPromo) {
      // Langsung restore TANPA modal/prompt
      setExtractedPromo(saved.extractedPromo);
      setEditHistory(saved.editHistory || []);
      setInputMode(saved.inputMode || 'url');
      setCurrentInput(saved.lastInput || '');
      setImagePreview(saved.imagePreview || null);
      
      // Toast info saja (auto-dismiss 3 detik) - tekankan sifat temporary
      toast.info("Sesi ekstraksi aktif dipulihkan (sementara)", {
        description: saved.extractedPromo.promo_name || "Draft promo",
        duration: 3000
      });
    }
  }, []);

  // ============================================
  // AUTO-SAVE ON CHANGES
  // ============================================
  
  useEffect(() => {
    if (extractedPromo) {
      extractorSession.save({
        extractedPromo,
        editHistory,
        inputMode,
        lastInput: currentInput,
        imagePreview
      });
    }
    setHasUnsavedData(!!extractedPromo);
  }, [extractedPromo, editHistory, inputMode, currentInput, imagePreview]);

  // ============================================
  // BROWSER CLOSE WARNING
  // ============================================
  
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedData) {
        e.preventDefault();
        e.returnValue = 'Hasil ekstraksi belum digunakan. Yakin mau keluar?';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedData]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (extractedPromo || isExtracting) {
      setTimeout(() => {
        scrollBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }, [extractedPromo, isExtracting]);

  // ============================================
  // IMAGE UPLOAD HANDLERS
  // ============================================
  
  const processImageFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File terlalu besar. Maksimal 10MB");
      return;
    }
    
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
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
    e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error("File harus berupa image (PNG, JPG, WebP)");
      return;
    }
    
    processImageFile(file);
  };

  // ============================================
  // AUTO-DETECTION HELPER
  // ============================================
  
  const detectInputType = (input: string): 'url' | 'html' => {
    if (input.startsWith('http://') || input.startsWith('https://')) return 'url';
    return 'html';
  };

  // ============================================
  // DRAG & DROP HANDLERS
  // ============================================
  
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
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    
    // HOTFIX: If current extraction was from image, clear it too to prevent stale data
    if (extractedPromo?._extraction_source === 'image') {
      setExtractedPromo(null);
      setEditHistory([]);
      setEditInput('');
      extractorSession.clear();
      toast.info("Image dan hasil ekstraksi dihapus");
    }
  };

  // ============================================
  // CLIPBOARD PASTE HANDLER
  // ============================================
  
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of items) {
      if (item.type.startsWith('image/')) {
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

  // ============================================
  // KEYBOARD HANDLER
  // ============================================
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isExtracting && (currentInput.trim() || imageBase64)) {
        handleExtract();
      }
    }
  };

  // ============================================
  // MAIN EXTRACT HANDLER
  // ============================================
  
  const handleExtract = async () => {
    setIsExtracting(true);
    
    try {
      let result: ExtractedPromo;
      
      // Priority: Image > URL > HTML (auto-detect)
      if (imageBase64) {
        setInputMode('image');
        toast.info("Mengekstrak dari image dengan VOC AI Knowledge...");
        result = await extractPromoFromImage(imageBase64);
      } else if (currentInput.trim()) {
        const detectedType = detectInputType(currentInput.trim());
        setInputMode(detectedType);
        
        if (detectedType === 'url') {
          toast.info("Mengambil konten dari URL...");
          try {
            const htmlContent = await fetchUrlContent(currentInput);
            if (!htmlContent || htmlContent.length < 500) {
              throw new Error("Konten tidak valid");
            }
            toast.success(`Berhasil fetch ${(htmlContent.length / 1024).toFixed(1)}KB`);
            result = await extractPromoFromContent(htmlContent, currentInput);
          } catch {
            toast.error("Gagal fetch URL. Coba paste HTML manual atau upload screenshot.");
            setIsExtracting(false);
            return;
          }
        } else {
          toast.info("Mengekstrak dari konten HTML...");
          result = await extractPromoFromContent(currentInput);
        }
      } else {
        toast.error("Tidak ada input untuk diproses");
        setIsExtracting(false);
        return;
      }
      
      setExtractedPromo(result);
      setEditHistory([]);
      
      // Auto-save to session
      extractorSession.save({
        extractedPromo: result,
        editHistory: [],
        inputMode,
        lastInput: currentInput,
        imagePreview
      });
      
      const status = result.validation?.status || 'draft';
      if (status === 'ready') {
        toast.success("Ekstraksi selesai! Promo siap digunakan.");
      } else {
        toast.info("Ekstraksi selesai. Review data sebelum melanjutkan.", {
          description: "Klik 'Gunakan Promo' untuk edit manual di form wizard"
        });
      }
      
    } catch (error) {
      console.error('Extraction error:', error);
      toast.error("Gagal mengekstrak promo", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsExtracting(false);
    }
  };

  // ============================================
  // EDIT COMMAND HANDLER (FAIL FAST)
  // ============================================
  
  const handleEditCommand = () => {
    if (!editInput.trim() || !extractedPromo) return;
    
    const command = parseEditCommand(editInput);
    const result = executeEditCommand(command, extractedPromo);
    
    if (result.success) {
      setExtractedPromo(result.data);
    }
    
    const historyItem: EditHistoryItem = {
      command: editInput,
      success: result.success,
      message: result.message,
      timestamp: Date.now()
    };
    
    setEditHistory(prev => [...prev, historyItem]);
    
    // Auto-save to session
    extractorSession.save({
      extractedPromo: result.success ? result.data : extractedPromo,
      editHistory: [...editHistory, historyItem]
    });
    
    setEditInput('');
    
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message.split('\n')[0]); // Show first line only in toast
    }
  };

  // ============================================
  // ACTION HANDLERS
  // ============================================
  
  const handleRestart = () => {
    // HOTFIX: Complete state reset to prevent carryover
    // Clear ALL extraction state
    setExtractedPromo(null);
    setEditHistory([]);
    setEditInput('');        // Reset edit input
    setShowEditHelp(false);  // Reset help visibility
    setIsExtracting(false);  // Safety reset
    
    // Clear ALL input state
    setInputMode('url');
    setCurrentInput('');
    setImagePreview(null);
    setImageBase64(null);
    
    // Clear flags
    setHasUnsavedData(false);
    
    // Clear session storage
    extractorSession.clear();
    
    toast.success("Extractor direset", { description: "Siap untuk ekstraksi baru" });
  };

  const handleCopyJSON = async () => {
    if (!extractedPromo) return;
    
    try {
      const jsonString = JSON.stringify(extractedPromo, null, 2);
      await navigator.clipboard.writeText(jsonString);
      toast.success("JSON disalin ke clipboard", { description: `${jsonString.length} karakter` });
    } catch {
      toast.error("Gagal menyalin ke clipboard");
    }
  };

  const handleCommitPromo = () => {
    if (!extractedPromo) {
      toast.error("Tidak ada promo untuk disimpan");
      return;
    }
    
    // ============================================
    // SYSTEM RULE GATE: C is NOT a promo - cannot be saved to KB
    // Show informational message instead of commit
    // ============================================
    if (extractedPromo.program_classification === 'C') {
      toast.info("Ini adalah System Rule, bukan promo", {
        description: "Aturan sistem tidak disimpan ke Promo KB. Gunakan Copy JSON jika perlu referensi.",
        duration: 5000
      });
      return;
    }
    
    // ============================================
    // CONFIDENCE GATE: Block commit if LOW confidence
    // Human must acknowledge before proceeding
    // ============================================
    if (extractedPromo.classification_confidence === 'low') {
      console.log('[ConfidenceGate] LOW confidence detected, showing gate modal');
      setShowConfidenceGate(true);
      return;
    }
    
    // Proceed with commit
    proceedWithCommit();
  };
  
  // Separated commit logic for reuse after gate confirmation
  // Uses memoized mappedPreview to ensure badge ↔ commit consistency
  const proceedWithCommit = async () => {
    if (!mappedPreview) return;
    
    try {
      const savedPromo = await promoKB.add(mappedPreview);
      
      toast.success("Promo berhasil ditambahkan!", {
        description: `"${savedPromo.promo_name}" sekarang ada di Knowledge Base`
      });
      
      handleRestart();
    } catch (error) {
      console.error('Error saving promo:', error);
      toast.error("Gagal menyimpan promo", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // ============================================
  // RENDER SUB CATEGORY CARD
  // ============================================
  
  const renderSubCategoryCard = (sub: ExtractedPromoSubCategory, idx: number, archetype: RewardArchetype) => {
    const hasBlacklist = sub.blacklist?.enabled && (
      (sub.blacklist.types?.length || 0) > 0 ||
      (sub.blacklist.providers?.length || 0) > 0 || 
      (sub.blacklist.games?.length || 0) > 0 || 
      (sub.blacklist.rules?.length || 0) > 0
    );
    
    // Only flag critical issues for REQUIRED fields based on archetype
    const hasCriticalIssue = ['calculation_value', 'turnover_rule', 'payout_direction'].some(f => {
      const status = getFieldStatus(f, archetype);
      if (status !== 'required') return false; // Skip non-required fields
      const conf = sub.confidence?.[f as keyof typeof sub.confidence];
      return conf === 'ambiguous' || conf === 'missing';
    });
    
    // Helper: Get display value for a field based on archetype
    const getFieldDisplay = (field: string, value: any, suffix?: string) => {
      const status = getFieldStatus(field, archetype);
      
      // Not applicable → show "Tidak Berlaku" in muted/italic style
      if (status === 'not_applicable') {
        return <span className="text-muted-foreground/60 italic">Tidak Berlaku</span>;
      }
      
      // Has value → show normally
      if (value != null && value !== '') {
        return <span className="text-foreground font-medium">{value}{suffix || ''}</span>;
      }
      
      // Empty → show dash
      return <span className="text-muted-foreground">-</span>;
    };
    
    return (
      <div 
        key={idx} 
        className={`bg-card border rounded-xl p-6 ${
          hasCriticalIssue ? 'border-destructive/50' : 'border-border'
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
          <h4 className="text-base font-semibold text-button-hover">
              {sub.sub_name || (extractedPromo?.subcategories.length === 1 
                ? extractedPromo?.promo_name 
                : `Varian ${idx + 1}`)}
            </h4>
            {hasCriticalIssue && (
              <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/40 text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Needs Review
              </Badge>
            )}
          </div>
          {extractedPromo && extractedPromo.subcategories.length > 1 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Varian {idx + 1}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {/* ✅ Hide "Nilai Bonus" for unit-based rewards (Lucky Spin/Voucher/Ticket) in Fixed mode */}
          {(() => {
            const isFixedMode = mappedPreview?.reward_mode === 'fixed';
            const rewardType = isFixedMode ? mappedPreview?.fixed_reward_type : sub.reward_type;
            const isUnitBased = isFixedMode && ['lucky_spin', 'voucher', 'ticket'].includes(rewardType || '');
            
            // Skip rendering for unit-based rewards - "Jumlah Reward" shown in detail section instead
            if (isUnitBased) return null;
            
            return (
              <div className="bg-muted rounded-lg p-3">
                <span className="text-muted-foreground text-xs block mb-1">
                  {sub.calculation_method === 'threshold' ? 'Target' : 'Perhitungan Bonus'}
                </span>
                {getFieldStatus('calculation_value', archetype) === 'not_applicable' ? (
                  <span className="text-muted-foreground/60 italic">Tidak Berlaku</span>
                ) : (
                  <span className="text-button-hover font-semibold">
                    {sub.calculation_value != null 
                      ? (sub.calculation_method === 'threshold'
                          ? `Rp ${Number(sub.calculation_value).toLocaleString('id-ID')}`
                          : sub.calculation_method === 'percentage'
                            ? `${sub.calculation_value}%`
                            : `Rp ${Number(sub.calculation_value).toLocaleString('id-ID')}`)
                      : '-'}
                  </span>
                )}
              </div>
            );
          })()}
          <div className="bg-muted rounded-lg p-3">
            {(() => {
              // Rollingan/Cashback: No min deposit, use min_claim instead
              const isRollinganArchetype = sub.calculation_base === 'turnover' || 
                archetype?.toLowerCase().includes('rollingan') ||
                archetype?.toLowerCase().includes('cashback');
              
              if (isRollinganArchetype) {
                const minClaim = (sub as any).min_reward_claim || (sub as any).min_claim;
                return (
                  <>
                    <span className="text-muted-foreground text-xs block mb-1">Min Bonus Cair</span>
                    <span className="text-foreground font-medium">
                      {minClaim ? `Rp ${Number(minClaim).toLocaleString('id-ID')}` : "Tidak ada batas"}
                    </span>
                  </>
                );
              }
              
              // ✅ Withdraw Bonus: use min_calculation as "Min WD", not min_deposit
              const isWithdrawTrigger = mappedPreview?.trigger_event === 'Withdraw' || 
                /withdraw|bonus.*wd|extra.*wd/i.test(extractedPromo?.promo_name || '');
              
              if (isWithdrawTrigger) {
                const minWdValue = mappedPreview?.min_calculation_enabled 
                  ? mappedPreview?.min_calculation 
                  : null;
                return (
                  <>
                    <span className="text-muted-foreground text-xs block mb-1">Min WD</span>
                    <span className="text-foreground font-medium">
                      {minWdValue ? `Rp ${Number(minWdValue).toLocaleString('id-ID')}` : "-"}
                    </span>
                  </>
                );
              }
              
              // Default: Min Deposit for other promo types
              // ✅ For Fixed Mode, read from mappedPreview (guarded values)
              const isFixedMode = mappedPreview?.reward_mode === 'fixed';
              const minDepoValue = isFixedMode 
                ? mappedPreview?.fixed_min_depo 
                : sub.minimum_base;
              
              return (
                <>
                  <span className="text-muted-foreground text-xs block mb-1">Min Deposit</span>
                  {getFieldStatus('minimum_base', archetype) === 'not_applicable' ? (
                    <span className="text-muted-foreground/60 italic">Tidak Berlaku</span>
                  ) : (
                    <span className="text-foreground font-medium">
                      {minDepoValue ? `Rp ${Number(minDepoValue).toLocaleString('id-ID')}` : "-"}
                    </span>
                  )}
                </>
              );
            })()}
          </div>
          <div className="bg-muted rounded-lg p-3">
            {(() => {
              // ✅ Use mappedPreview for Fixed mode (single source of truth)
              const isFixedMode = mappedPreview?.reward_mode === 'fixed';
              const rewardType = isFixedMode 
                ? mappedPreview?.fixed_reward_type 
                : sub.reward_type;
              const isUnitBased = ['lucky_spin', 'voucher', 'ticket'].includes(rewardType || '');
              
              // For unit-based rewards, show "Max Claim Reward" with unit count
              if (isUnitBased && isFixedMode) {
                const maxPerDay = mappedPreview?.fixed_lucky_spin_max_per_day;
                return (
                  <>
                    <span className="text-muted-foreground text-xs block mb-1">Max Claim Reward</span>
                    <span className="text-foreground font-medium">
                      {maxPerDay ? `${maxPerDay} / hari` : 'Unlimited'}
                    </span>
                  </>
                );
              }
              
              // Regular max bonus logic
              const isUnlimited = (sub as any).dinamis_max_claim_unlimited || (sub as any).max_bonus_unlimited;
              if (isUnlimited) {
                return (
                  <>
                    <span className="text-muted-foreground text-xs block mb-1">Max Bonus</span>
                    <span className="text-foreground font-medium">Unlimited</span>
                  </>
                );
              }
              
              const maxValue = sub.max_bonus || (sub as any).dinamis_max_claim;
              return (
                <>
                  <span className="text-muted-foreground text-xs block mb-1">Max Bonus</span>
                  <span className="text-foreground font-medium">
                    {maxValue && maxValue > 0 ? `Rp ${maxValue.toLocaleString('id-ID')}` : 'Unlimited'}
                  </span>
                </>
              );
            })()}
          </div>
          <div className="bg-muted rounded-lg p-3">
            {(() => {
              // ✅ Use mappedPreview for Fixed mode (single source of truth)
              const isFixedMode = mappedPreview?.reward_mode === 'fixed';
              const rewardType = isFixedMode 
                ? mappedPreview?.fixed_reward_type 
                : sub.reward_type;
              
              // Display label based on reward type
              const getRewardLabel = (type: string | undefined) => {
                switch (type) {
                  case 'lucky_spin': return 'Lucky Spin';
                  case 'voucher': return 'Voucher';
                  case 'ticket': return 'Ticket';
                  case 'hadiah_fisik': return isFixedMode 
                    ? (mappedPreview?.fixed_physical_reward_name || 'Hadiah Fisik')
                    : (sub.physical_reward_name || 'Hadiah Fisik');
                  case 'uang_tunai': return 'Uang Tunai';
                  default: return 'Credit Game';
                }
              };
              
              const getRewardColor = (type: string | undefined) => {
                switch (type) {
                  case 'lucky_spin': return 'text-purple-400';
                  case 'voucher': return 'text-blue-400';
                  case 'ticket': return 'text-cyan-400';
                  case 'hadiah_fisik': return 'text-amber-400';
                  case 'uang_tunai': return 'text-green-400';
                  default: return 'text-foreground';
                }
              };
              
              return (
                <>
                  <span className="text-muted-foreground text-xs block mb-1">Jenis Hadiah</span>
                  <span className={`font-medium ${getRewardColor(rewardType)}`}>
                    {getRewardLabel(rewardType)}
                  </span>
                </>
              );
            })()}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted rounded-lg p-3">
            {/* ✅ Use mappedPreview for Fixed mode turnover */}
            {(() => {
              const isFixedMode = mappedPreview?.reward_mode === 'fixed';
              
              // Fixed mode: read from mappedPreview
              if (isFixedMode) {
                const turnoverEnabled = mappedPreview?.fixed_turnover_rule_enabled;
                const turnoverValue = mappedPreview?.fixed_turnover_rule;
                return (
                  <>
                    <span className="text-muted-foreground text-xs block mb-1">Turnover</span>
                    <span className="text-foreground font-medium">
                      {!turnoverEnabled ? 'Tidak Berlaku' : (turnoverValue || '-')}
                    </span>
                  </>
                );
              }
              
              // Dinamis mode: ✅ Read from mappedPreview (single source of truth)
              const turnoverEnabled = mappedPreview?.turnover_rule_enabled;
              const turnoverValue = mappedPreview?.turnover_rule;
              
              // If mappedPreview has turnover data, use it
              if (turnoverEnabled && turnoverValue) {
                return (
                  <>
                    <span className="text-muted-foreground text-xs block mb-1">Turnover</span>
                    <span className="text-foreground font-medium">{turnoverValue}x</span>
                  </>
                );
              }
              
              // Fallback: original logic from sub (legacy/extraction)
              const isMinRupiahFormat = sub.turnover_rule_format === 'min_rupiah' 
                || sub.calculation_base === 'turnover';
              return (
                <>
                  <span className="text-muted-foreground text-xs block mb-1">
                    {isMinRupiahFormat ? 'Min Turnover' : 'Turnover'}
                  </span>
                  {getFieldStatus('turnover_rule', archetype) === 'not_applicable' ? (
                    <span className="text-muted-foreground/60 italic">Tidak Berlaku</span>
                  ) : (
                    <span className="text-foreground font-medium">
                      {(() => {
                        const displayValue = isMinRupiahFormat
                          ? (sub.turnover_rule && String(sub.turnover_rule) !== '0' && Number(sub.turnover_rule) !== 0)
                              ? sub.turnover_rule
                              : (sub as any).minimum_base || (sub as any).min_calculation
                          : sub.turnover_rule;
                        
                        if (displayValue == null || displayValue === '' || displayValue === '0' || displayValue === 0) {
                          return '-';
                        }
                        
                        return isMinRupiahFormat
                          ? `Rp ${Number(displayValue).toLocaleString('id-ID')}`
                          : `${displayValue}x`;
                      })()}
                    </span>
                  )}
                </>
              );
            })()}
          </div>
          <div className="bg-muted rounded-lg p-3">
            <span className="text-muted-foreground text-xs block mb-1">Payout</span>
            <span className={`font-semibold ${sub.payout_direction === 'depan' ? 'text-success' : 'text-warning'}`}>
              {sub.payout_direction === 'depan' ? 'DEPAN' : sub.payout_direction === 'belakang' ? 'BELAKANG' : '-'}
            </span>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <span className="text-muted-foreground text-xs block mb-1">Jenis Game</span>
            <span className="text-foreground font-medium">
              {sub.game_types?.length ? sub.game_types.map(formatGameTypeLabel).join(", ") : "Semua"}
            </span>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <span className="text-muted-foreground text-xs block mb-1">Blacklist</span>
            <span className={`font-medium ${hasBlacklist ? 'text-destructive' : 'text-muted-foreground'}`}>
              {hasBlacklist ? "Aktif" : "Tidak Aktif"}
            </span>
          </div>
        </div>

        {/* ✅ Lucky Spin / Voucher / Ticket specific fields (Fixed Mode only) */}
        {(() => {
          const isFixedMode = mappedPreview?.reward_mode === 'fixed';
          const rewardType = isFixedMode ? mappedPreview?.fixed_reward_type : undefined;
          const isUnitBased = isFixedMode && ['lucky_spin', 'voucher', 'ticket'].includes(rewardType || '');
          
          if (!isUnitBased) return null;
          
          return (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-400">
                  Detail {rewardType === 'lucky_spin' ? 'Lucky Spin' : rewardType === 'voucher' ? 'Voucher' : 'Ticket'}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted rounded-lg p-3">
                  <span className="text-muted-foreground text-xs block mb-1">Jumlah Reward</span>
                  <span className="text-foreground font-medium">
                    {mappedPreview?.fixed_reward_quantity || 1}
                  </span>
                </div>
                {rewardType === 'lucky_spin' && (
                  <>
                    <div className="bg-muted rounded-lg p-3">
                      <span className="text-muted-foreground text-xs block mb-1">Max Spin/Hari</span>
                      <span className="text-foreground font-medium">
                        {mappedPreview?.fixed_lucky_spin_max_per_day || 'Unlimited'}
                      </span>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <span className="text-muted-foreground text-xs block mb-1">ID Lucky Spin</span>
                      <span className="text-foreground font-medium">
                        {mappedPreview?.fixed_lucky_spin_id || '-'}
                      </span>
                    </div>
                  </>
                )}
                {rewardType === 'voucher' && (
                  <div className="bg-muted rounded-lg p-3">
                    <span className="text-muted-foreground text-xs block mb-1">Jenis Voucher</span>
                    <span className="text-foreground font-medium">
                      {mappedPreview?.fixed_voucher_kind || 'Umum'}
                    </span>
                  </div>
                )}
                <div className="bg-muted rounded-lg p-3">
                  <span className="text-muted-foreground text-xs block mb-1">Waktu Berlaku</span>
                  <span className="text-foreground font-medium">
                    {(() => {
                      // Check validity mode from mappedPreview
                      const validityMode = mappedPreview?.fixed_spin_validity_mode;
                      if (mappedPreview?.fixed_voucher_valid_unlimited) return 'Tidak Terbatas';
                      if (mappedPreview?.fixed_voucher_valid_until) return `s/d ${mappedPreview.fixed_voucher_valid_until}`;
                      if (validityMode === 'relative') {
                        const duration = mappedPreview?.fixed_spin_validity_duration;
                        const unit = mappedPreview?.fixed_spin_validity_unit;
                        if (duration === 24 && unit === 'hours') return 'Reset Harian';
                        if (duration && unit) return `${duration} ${unit === 'hours' ? 'Jam' : unit === 'days' ? 'Hari' : unit}`;
                      }
                      return 'Reset Harian'; // Default fallback
                    })()}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {hasBlacklist && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="bg-destructive/10 rounded-lg p-3">
              <span className="text-destructive text-xs font-medium flex items-center gap-1 mb-2">
                <Ban className="w-3 h-3" />
                Blacklist:
              </span>
              {sub.blacklist.rules.length > 0 && (
                <ul className="list-disc list-inside text-xs text-foreground">
                  {sub.blacklist.rules.map((rule, i) => <li key={i}>{rule}</li>)}
                </ul>
              )}
              {sub.blacklist.games.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {sub.blacklist.games.map((game, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-destructive/20 text-destructive">
                      {game}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER EXTRACTED DATA CARD
  // ============================================
  
  const renderExtractedData = () => {
    if (!extractedPromo) return null;
    
    const status = extractedPromo.validation?.status || 'draft';
    const warnings = extractedPromo.validation?.warnings || [];
    
    return (
      <Card className="w-full bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 flex items-start gap-4">
          <div className="icon-circle">
            {status === 'ready' ? (
              <CheckCircle2 className="icon-circle-icon" />
            ) : (
              <Info className="icon-circle-icon text-blue-400" />
            )}
          </div>
          <div className="flex-1">
            {/* Row 1: Title + Status Badge (right-aligned) */}
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-foreground">
                {extractedPromo.promo_name || "Promo Tanpa Nama"}
              </h3>
              <Badge variant="outline" className={getStatusBadgeStyle(status)}>
                {status === 'ready' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                {status === 'draft' && <Info className="w-3 h-3 mr-1" />}
                {getStatusLabel(status)}
              </Badge>
            </div>
            {/* Row 2: Other badges */}
            <div className="flex gap-2 mt-2 flex-wrap">
              {/* Client/Website Badge */}
              {extractedPromo.client_id && (
                <Badge variant="outline" className="bg-cyan-500/20 text-cyan-400 border-cyan-500/40">
                  🌐 {extractedPromo.client_id}
                  {extractedPromo.client_id_confidence === 'derived' && (
                    <span className="ml-1 text-xs opacity-60">(derived)</span>
                  )}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Image Source Warning */}
        {extractedPromo._extraction_source === 'image' && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-500">
                Data diekstrak dari image — mohon verifikasi angka-angka penting sebelum commit.
                Gunakan perintah edit jika perlu koreksi.
              </p>
            </div>
          </div>
        )}

        {/* COMBO Summary Bar - Conditional for Referral vs Other */}
        {extractedPromo.promo_mode === 'multi' && extractedPromo.subcategories.length > 1 && (
          /referral|referal|refferal|ajak.*teman/i.test(extractedPromo.promo_type || '') ? (
            // REFERRAL: Show Tier Summary (simpler layout)
            <div className="px-6 pb-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-3">Struktur Tier Komisi</p>
                <div className="space-y-2">
                  {[...extractedPromo.subcategories]
                    .sort((a, b) => (Number(a.calculation_value) || 0) - (Number(b.calculation_value) || 0))
                    .map((tier, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-card rounded-lg px-3 py-2">
                      <span className="text-foreground font-medium">
                        {tier.sub_name || `Tier ${idx + 1}`}
                      </span>
                      <Badge className="bg-button-hover/20 text-button-hover border-button-hover/40">
                        {tier.calculation_value}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // NON-REFERRAL: Keep existing COMBO Summary Bar
            <div className="px-6 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <span className="text-2xl font-bold text-button-hover">
                    {extractedPromo.subcategories.length}
                  </span>
                  <span className="text-xs text-muted-foreground block mt-1">Sub Kategori</span>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <span className="text-sm font-semibold text-foreground">
                    {getPayoutSummary(extractedPromo.subcategories)}
                  </span>
                  <span className="text-xs text-muted-foreground block mt-1">Payout</span>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <span className="text-sm font-semibold text-foreground capitalize">
                    {getGameTypesSummary(extractedPromo.subcategories)}
                  </span>
                  <span className="text-xs text-muted-foreground block mt-1">Game Type</span>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <span className={`text-sm font-semibold ${
                    extractedPromo.global_blacklist?.enabled || extractedPromo.subcategories.some(s => s.blacklist?.enabled) 
                      ? 'text-destructive' : 'text-muted-foreground'
                  }`}>
                    {getBlacklistSummary(extractedPromo)}
                  </span>
                  <span className="text-xs text-muted-foreground block mt-1">Blacklist</span>
                </div>
              </div>
            </div>
          )
        )}

        {/* Content */}
        <div className="px-6 pb-6 space-y-6">
          {/* Review Info (was Errors/Warnings - now informational only) */}
          {warnings.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <h4 className="text-blue-400 font-medium text-sm flex items-center gap-2 mb-2">
                <Info className="w-4 h-4" />
                Review ({warnings.length}) — Dapat dilengkapi manual
              </h4>
              <ul className="list-disc list-outside pl-4 space-y-1 text-sm text-muted-foreground">
                {warnings.map((warn, idx) => <li key={idx}>{warn}</li>)}
              </ul>
            </div>
          )}

          {/* Subcategories - Conditional for Referral vs Other */}
          {extractedPromo.subcategories.length > 0 && (
            /referral|referal|refferal|ajak.*teman/i.test(extractedPromo.promo_type || '') ? (
              // REFERRAL: Render as Tier Table with ALL simulation columns
              <div>
                <h4 className="text-base font-semibold text-button-hover mb-4">
                  Detail Tier Komisi Referral
                </h4>
                <div className="bg-card rounded-lg overflow-hidden border border-border overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left py-3 px-3 font-medium text-foreground">Nama Tier</th>
                        <th className="text-left py-3 px-3 font-medium text-foreground">Min Downline</th>
                        <th className="text-left py-3 px-3 font-medium text-foreground">Winlose</th>
                        <th className="text-left py-3 px-3 font-medium text-foreground">Cashback</th>
                        <th className="text-left py-3 px-3 font-medium text-foreground">Fee</th>
                        <th className="text-left py-3 px-3 font-medium text-foreground">WL Bersih</th>
                        <th className="text-left py-3 px-3 font-medium text-foreground">Komisi %</th>
                        <th className="text-left py-3 px-3 font-medium text-foreground">Komisi Rp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...extractedPromo.subcategories]
                        .sort((a, b) => (Number(a.calculation_value) || 0) - (Number(b.calculation_value) || 0))
                        .map((tier, idx) => {
                          // Extract min_downline from sub data, sub_name, or terms pattern
                          const subMinDownline = (tier as any).min_downline;
                          const nameMatch = tier.sub_name?.match(/(\d+)\s*(id|member|downline)/i);
                          const termsMatch = extractedPromo.terms_conditions?.find(t => 
                            t.includes(`${tier.calculation_value}%`) && /(\d+)\s*(id|member|downline)/i.test(t)
                          )?.match(/(\d+)\s*(id|member|downline)/i);
                          const minDownline = subMinDownline || nameMatch?.[1] || termsMatch?.[1] || ((idx + 1) * 5);
                          
                          // CALCULATION RULES: Ini ATURAN FINAL dari tabel promo, bukan sample!
                          const ruleWinlose = (tier as any).winlose || (tier as any).sample_winlose || tier.minimum_base;
                          const ruleCashback = (tier as any).cashback_deduction || (tier as any).sample_cashback;
                          const ruleFee = (tier as any).fee_deduction || (tier as any).sample_commission_deduction;
                          const ruleNetWL = (tier as any).net_winlose || (tier as any).sample_net_winlose;
                          const ruleKomisi = (tier as any).commission_result || (tier as any).sample_commission_result;
                          
                          // Format helpers
                          const formatRp = (val: any) => val && Number(val) > 0 
                            ? `Rp ${new Intl.NumberFormat('id-ID').format(Number(val))}` 
                            : '-';
                          
                          return (
                            <tr key={idx} className="border-t border-border">
                              <td className="py-3 px-3 text-foreground font-medium">{tier.sub_name || `Tier ${idx + 1}`}</td>
                              <td className="py-3 px-3 text-foreground">{minDownline} ID</td>
                              <td className="py-3 px-3 text-foreground">{formatRp(ruleWinlose)}</td>
                              <td className="py-3 px-3 text-foreground">{formatRp(ruleCashback)}</td>
                              <td className="py-3 px-3 text-foreground">{formatRp(ruleFee)}</td>
                              <td className="py-3 px-3 text-foreground">{formatRp(ruleNetWL)}</td>
                              <td className="py-3 px-3 text-button-hover font-semibold">{tier.calculation_value}%</td>
                              <td className="py-3 px-3 text-amber-400 font-semibold">{formatRp(ruleKomisi)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-2 px-1">
                  * Kolom Winlose, Cashback, Fee, WL Bersih, Komisi Rp adalah ATURAN FINAL dari tabel promo. Threshold tier berdasarkan Min Downline.
                </p>
              </div>
            ) : (
              // NON-REFERRAL: Keep existing variant cards
              <div>
                {/* Only show header if multi-variant */}
                {extractedPromo.subcategories.length > 1 && (
                  <h4 className="text-base font-semibold text-button-hover mb-4">
                    Sub Kategori ({extractedPromo.subcategories.length} Varian)
                  </h4>
                )}
                <div className="space-y-4">
                  {[...extractedPromo.subcategories]
                    .sort((a, b) => {
                      const valueA = Number(a.calculation_value) || 0;
                      const valueB = Number(b.calculation_value) || 0;
                      return valueA - valueB; // ascending (smallest first)
                    })
                    .map((sub, idx) => {
                    const archetype = detectRewardArchetype(extractedPromo);
                    return renderSubCategoryCard(sub, idx, archetype);
                  })}
                </div>
              </div>
            )
          )}

          {/* Tabel Hadiah (Togel Event Rewards) - READ ONLY */}
          {(() => {
            const domain = detectGameDomain(extractedPromo);
            const eventRewards = extractedPromo.event_rewards;
            
            if (domain === 'togel' && eventRewards && eventRewards.length > 0) {
              return (
                <div>
                  <h4 className="text-base font-semibold text-button-hover mb-4">
                    Tabel Hadiah
                  </h4>
                  {extractedPromo.applicable_markets && extractedPromo.applicable_markets.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="text-sm text-muted-foreground">Pasaran:</span>
                      {extractedPromo.applicable_markets.map((market, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-button-hover/20 text-button-hover border-button-hover/40">
                          {market}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="bg-muted rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-card">
                          <th className="text-left py-2 px-4 text-muted-foreground font-medium">Prize</th>
                          <th className="text-left py-2 px-4 text-muted-foreground font-medium">Digit</th>
                          <th className="text-right py-2 px-4 text-muted-foreground font-medium">Hadiah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eventRewards.map((r, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="py-2 px-4 text-foreground">{r.prize_rank}</td>
                            <td className="py-2 px-4 text-foreground">{r.digit_type}</td>
                            <td className="py-2 px-4 text-right font-semibold text-amber-400">
                              Rp {r.reward_amount.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* ============================================ */}
          {/* PHASE 1C: Event Prizes Summary (Read-Only) */}
          {/* Untuk Category B - Tournament/Leaderboard */}
          {/* ============================================ */}
          {extractedPromo.prizes && extractedPromo.prizes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h4 className="text-base font-semibold text-button-hover">
                  Tabel Hadiah Event
                </h4>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs">
                  Read-Only
                </Badge>
              </div>
              <div className="bg-muted rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-card">
                      <th className="text-left py-2 px-4 text-muted-foreground font-medium">Peringkat</th>
                      <th className="text-left py-2 px-4 text-muted-foreground font-medium">Hadiah</th>
                      <th className="text-left py-2 px-4 text-muted-foreground font-medium">Jenis</th>
                      <th className="text-right py-2 px-4 text-muted-foreground font-medium">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedPromo.prizes.map((prize, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-2 px-4 text-foreground font-medium">
                          {prize.rank || `#${i + 1}`}
                        </td>
                        <td className="py-2 px-4 text-foreground">
                          {prize.prize || prize.physical_reward_name || '-'}
                        </td>
                        <td className="py-2 px-4">
                          <Badge variant="outline" className={`text-xs ${
                            prize.reward_type === 'hadiah_fisik' 
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' 
                              : prize.reward_type === 'uang_tunai'
                                ? 'bg-green-500/20 text-green-400 border-green-500/40'
                                : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          }`}>
                            {prize.reward_type === 'hadiah_fisik' ? 'Fisik' 
                              : prize.reward_type === 'uang_tunai' ? 'Tunai' 
                              : 'Credit'}
                          </Badge>
                        </td>
                        <td className="py-2 px-4 text-right font-semibold text-amber-400">
                          {prize.value 
                            ? `Rp ${prize.value.toLocaleString('id-ID')}`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground/60 mt-2 italic">
                Data hadiah event diekstrak dari sumber. Editing belum tersedia di versi ini.
              </p>
            </div>
          )}

          {/* ============================================ */}
          {/* PHASE 1D: Exchange Table Summary (Read-Only) */}
          {/* Untuk Category C - Loyalty Point Redemption */}
          {/* ============================================ */}
          {extractedPromo.loyalty_mechanism?.exchange_table && 
           extractedPromo.loyalty_mechanism.exchange_table.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h4 className="text-base font-semibold text-button-hover">
                  Tabel Penukaran {extractedPromo.loyalty_mechanism.point_name || 'Point'}
                </h4>
                <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30 text-xs">
                  Read-Only
                </Badge>
              </div>
              {extractedPromo.loyalty_mechanism.earning_rule && (
                <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                  <span>Aturan Perolehan:</span>
                  <Badge variant="outline" className="bg-muted text-foreground">
                    {extractedPromo.loyalty_mechanism.earning_rule}
                  </Badge>
                </div>
              )}
              <div className="bg-muted rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-card">
                      <th className="text-right py-2 px-4 text-muted-foreground font-medium">
                        {extractedPromo.loyalty_mechanism.point_name || 'Point'}
                      </th>
                      <th className="text-left py-2 px-4 text-muted-foreground font-medium">Hadiah</th>
                      <th className="text-left py-2 px-4 text-muted-foreground font-medium">Jenis</th>
                      <th className="text-right py-2 px-4 text-muted-foreground font-medium">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedPromo.loyalty_mechanism.exchange_table.map((item, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-2 px-4 text-right font-semibold text-purple-400">
                          {item.points?.toLocaleString('id-ID') || '-'}
                        </td>
                        <td className="py-2 px-4 text-foreground">
                          {item.reward || item.physical_reward_name || '-'}
                        </td>
                        <td className="py-2 px-4">
                          <Badge variant="outline" className={`text-xs ${
                            item.reward_type === 'hadiah_fisik' 
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' 
                              : item.reward_type === 'uang_tunai'
                                ? 'bg-green-500/20 text-green-400 border-green-500/40'
                                : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          }`}>
                            {item.reward_type === 'hadiah_fisik' ? 'Fisik' 
                              : item.reward_type === 'uang_tunai' ? 'Tunai' 
                              : 'Credit'}
                          </Badge>
                        </td>
                        <td className="py-2 px-4 text-right font-semibold text-green-400">
                          {item.cash_reward_amount 
                            ? `Rp ${item.cash_reward_amount.toLocaleString('id-ID')}`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground/60 mt-2 italic">
                Tabel penukaran point diekstrak dari sumber. Editing tier tersedia di Phase 2.
              </p>
            </div>
          )}

          {/* Special Requirements (Syarat Khusus) */}
          {extractedPromo.special_requirements && extractedPromo.special_requirements.length > 0 && (
            <div>
              <h4 className="text-base font-semibold text-amber-500 mb-4">
                Syarat Khusus
              </h4>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <div className="flex flex-wrap gap-2">
                  {extractedPromo.special_requirements.map((req, idx) => (
                    <Badge key={idx} variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/40">
                      {req}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Terms */}
          {extractedPromo.terms_conditions && extractedPromo.terms_conditions.length > 0 && (
            <div>
              <h4 className="text-base font-semibold text-button-hover mb-4">
                Syarat & Ketentuan
              </h4>
              <div className="bg-muted rounded-lg p-4">
                <ul className="list-disc list-outside pl-4 space-y-1 text-sm text-foreground">
                  {extractedPromo.terms_conditions.map((term, idx) => <li key={idx}>{term}</li>)}
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
  
  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <ScrollArea className="flex-1">
        <div className={`p-6 pb-20 max-w-5xl mx-auto ${!extractedPromo && !isExtracting ? 'min-h-[calc(100vh-160px)] flex flex-col justify-center' : ''} space-y-6`}>
          
          {/* INPUT SECTION - Unified Design */}
          {!extractedPromo && !isExtracting && (
            <Card className="form-card">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="icon-circle w-16 h-16 mx-auto mb-4">
                  <Sparkles className="icon-circle-icon w-8 h-8" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Promo Extractor</h2>
                <p className="text-muted-foreground mt-2">
                  Paste link, HTML, atau drop screenshot — AI akan mengekstrak ke format Knowledge Base.
                </p>
              </div>

              {/* API Status Badge */}
              <div className="flex justify-center mb-6">
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                  <span className="w-2 h-2 rounded-full bg-success mr-2" />
                  VOC AI Knowledge
                </Badge>
              </div>

              {/* Hint Text */}
              {!imagePreview && !currentInput && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground/70 mb-8">
                  <Lightbulb className="w-4 h-4" />
                  <span>Contoh: URL promo, HTML content, atau drag & drop screenshot</span>
                </div>
              )}

              {/* Image Preview */}
              {imagePreview && (
                <div className="relative mb-6 flex justify-center">
                  <div className="relative inline-block">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="max-h-48 rounded-lg shadow-md border border-border" 
                    />
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      className="absolute -top-2 -right-2 rounded-full"
                      onClick={clearImage}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Unified Input Bar */}
              <div 
                className={`
                  relative flex items-end gap-2 p-2 rounded-xl border-2
                  transition-all duration-200
                  ${isDragOver 
                    ? 'border-button-hover bg-button-hover/5' 
                    : 'border-border bg-muted/30'
                  }
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* Attachment Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                  title="Upload image"
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                
                {/* Textarea */}
                <Textarea
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={handleKeyDown}
                  placeholder="Paste link promo atau konten promo..."
                  className="flex-1 min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  rows={1}
                />
                
                {/* Send Button */}
                <Button
                  variant="golden"
                  size="icon"
                  onClick={handleExtract}
                  disabled={isExtracting || (!currentInput.trim() && !imageBase64)}
                  className="flex-shrink-0 rounded-full"
                  title="Ekstrak promo"
                >
                  {isExtracting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>

              {/* Helper Text */}
              <p className="text-xs text-muted-foreground text-center mt-3">
                Tekan Enter untuk mengirim, Shift+Enter untuk baris baru
              </p>
            </Card>
          )}

          {/* PROCESSING STATE */}
          {isExtracting && (
            <div className="flex items-center justify-between p-6 bg-card border border-border rounded-xl">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-button-hover" />
                <span className="text-foreground font-medium">Mengekstrak promo...</span>
              </div>
              <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                <span className="w-2 h-2 rounded-full bg-success mr-2" />
                VOC AI Knowledge
              </Badge>
            </div>
          )}

          {/* RESULT SECTION */}
          {extractedPromo && (
            <>
              {/* CLASSIFICATION OVERRIDE (LLM Classifier) */}
              {extractedPromo.program_classification && (
                <ClassificationOverride
                  currentCategory={extractedPromo.program_classification}
                  categoryName={extractedPromo.program_classification_name || 'Unknown'}
                  confidence={extractedPromo.classification_confidence || 'medium'}
                  qualityFlags={extractedPromo.quality_flags || []}
                  rewardMode={mappedPreview?.reward_mode}
                  promoSubType={getPromoSubTypeDisplay(
                    extractedPromo.promo_name,
                    extractedPromo.promo_type
                  )}
                  reasoning={
                    extractedPromo.classification_q1 ? {
                      q1: extractedPromo.classification_q1,
                      q2: extractedPromo.classification_q2!,
                      q3: extractedPromo.classification_q3!,
                      q4: extractedPromo.classification_q4!,
                    } : undefined
                  }
                  onOverride={(newCategory, reason) => {
                    // Apply override and update state
                    const override = {
                      from: extractedPromo.program_classification!,
                      to: newCategory,
                      reason,
                      overridden_by: 'anonymous',
                      timestamp: new Date().toISOString(),
                    };
                    
                    console.log('[ClassificationOverride] Override applied:', override);
                    
                    const categoryNames = { A: 'Reward Program', B: 'Event Program', C: 'System Rule' };
                    setExtractedPromo({
                      ...extractedPromo,
                      program_classification: newCategory,
                      program_classification_name: categoryNames[newCategory],
                      classification_override: override,
                    });
                    
                    toast.success(`Klasifikasi diubah ke ${categoryNames[newCategory]}`);
                  }}
                />
              )}
              
              {/* SYSTEM RULE WARNING BANNER */}
              {extractedPromo.program_classification === 'C' && (
                <div className="flex items-start gap-3 p-4 bg-pink-500/10 border border-pink-500/30 rounded-xl">
                  <Info className="w-5 h-5 text-pink-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-medium text-pink-400">System Rule Terdeteksi</h4>
                    <p className="text-sm text-muted-foreground">
                      Ini adalah <strong>aturan sistem</strong>, bukan promo yang bisa diklaim.
                      System Rule tidak akan disimpan ke Promo KB.
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-2">
                      Jika ini sebenarnya promo (bonus/cashback/event), klik "Override" di atas untuk mengubah klasifikasi ke A atau B.
                    </p>
                  </div>
                </div>
              )}
              
              {renderExtractedData()}

          {/* EDIT SECTION - TEMPORARILY HIDDEN */}
          {false && (
          <Card className="p-4 bg-card border border-border rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-button-hover" />
                    <span className="font-medium text-foreground">Edit dengan perintah</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEditHelp(!showEditHelp)}
                    className="rounded-full"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Command Help */}
                {showEditHelp && (
                  <div className="mb-4 p-3 bg-muted rounded-lg text-sm">
                    <p className="font-medium mb-2 text-foreground">Contoh perintah:</p>
                    <ul className="space-y-1 text-muted-foreground">
                      {COMMAND_EXAMPLES.map((ex, i) => (
                        <li key={i}>• <code className="bg-background px-1 rounded text-xs">{ex}</code></li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Command Input */}
                <div className="flex gap-2">
                  <Input
                    value={editInput}
                    onChange={(e) => setEditInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleEditCommand();
                      }
                    }}
                    placeholder='Ketik perintah, contoh: "set min deposit 50K semua varian"'
                    className="flex-1 font-mono text-sm"
                  />
                  <Button 
                    onClick={handleEditCommand}
                    disabled={!editInput.trim()}
                    size="sm"
                    variant="golden"
                    className="rounded-full"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Edit History */}
                {editHistory.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Riwayat edit:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {editHistory.map((item, idx) => (
                        <div 
                          key={idx}
                          className={`text-sm px-2 py-1 rounded ${
                            item.success 
                              ? 'bg-success/10 text-success' 
                              : 'bg-destructive/10 text-destructive'
                          }`}
                        >
                          {item.message.split('\n')[0]}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
          )}

            </>
          )}
        </div>
      </ScrollArea>

      {/* FIXED ACTION BAR - Consistent with APBESummaryReview */}
      {extractedPromo && (
        <div className="footer-bar">
          <div className="footer-bar-content">
            {/* Left: Back/Restart */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline"
                onClick={handleRestart}
                className="h-11 px-6 gap-2 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
              >
                <RotateCcw className="w-4 h-4" />
                Restart
              </Button>
            </div>
            
            {/* Center: Empty */}
            <div className="flex items-center gap-3" />
            
            {/* Right: Primary Action */}
            <div className="flex items-center gap-3">
              {/* System Rule (C) cannot be saved to promo KB */}
              {extractedPromo.program_classification === 'C' ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline"
                        disabled
                        className="h-11 px-6 gap-2 opacity-50 cursor-not-allowed"
                      >
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
                  className="h-11 px-6 gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Gunakan Promo
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

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
            <AlertDialogCancel onClick={() => {
              setShowLeaveDialog(false);
              setPendingNavigation(null);
            }}>
              Kembali
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                extractorSession.clear();
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

      {/* CONFIDENCE GATE MODAL (LLM Classifier) */}
      <ConfidenceGateModal
        isOpen={showConfidenceGate}
        onClose={() => setShowConfidenceGate(false)}
        onConfirm={() => {
          console.log('[ConfidenceGate] User confirmed commit despite LOW confidence');
          setShowConfidenceGate(false);
          proceedWithCommit();
        }}
        qualityFlags={extractedPromo?.quality_flags || []}
        categoryName={extractedPromo?.program_classification_name || ''}
      />
    </div>
  );
}
