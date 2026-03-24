import { useState, useEffect, Fragment, useRef } from "react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Gift, Plus, Pencil, Trash2, ArrowLeft, Upload, Download, MoreHorizontal, Eye, Copy, ChevronRight, ChevronDown, Infinity, Loader2, Edit2, Zap, Trophy, Cog, RefreshCw, FileJson, Lock, Unlock } from "lucide-react";
import { classifyContent, type ProgramCategory } from "@/lib/extractors/category-classifier";
import { toast } from "sonner";
import { PromoFormWizard } from "./PromoFormWizard";
import { PromoItem, deletePromoDraft, duplicatePromo, normalizePromoData } from "./PromoFormWizard/types";
import { promoKB, localDraftKB } from "@/lib/promo-storage";
import { generateTermsList, formatNumber } from "./PromoFormWizard/Step4Review";
import { inferRewardType, formatSubcategoryName, getRewardBadgeInfo } from "@/lib/reward-normalization";

type ViewMode = "list" | "form" | "upload";

interface PromoKnowledgeSectionProps {
  onBack?: () => void;
  forceResetKey?: number;
}

export function PromoKnowledgeSection({ onBack, forceResetKey }: PromoKnowledgeSectionProps) {
  const [items, setItems] = useState<PromoItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingPromo, setEditingPromo] = useState<PromoItem | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewTermsItem, setViewTermsItem] = useState<PromoItem | null>(null);
  const [expandedPromos, setExpandedPromos] = useState<Set<string>>(new Set());
  
  // Auto-classification states
  const [classifyingIds, setClassifyingIds] = useState<Set<string>>(new Set());
  
  // Regenerate S&K states
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false);
  const classifyQueueRef = useRef<Set<string>>(new Set()); // To prevent duplicate calls

  // Delete All state
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);

  // Upload JSON states
  const [showJsonDialog, setShowJsonDialog] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [isImportingJson, setIsImportingJson] = useState(false);

  const handleJsonImport = async () => {
    if (!jsonInput.trim()) {
      toast.error('JSON kosong, silakan paste data JSON');
      return;
    }

    setIsImportingJson(true);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonInput);
      } catch {
        toast.error('JSON tidak valid — cek format dan coba lagi');
        setIsImportingJson(false);
        return;
      }

      const promoArray: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed];

      if (promoArray.length === 0) {
        toast.error('Array JSON kosong');
        setIsImportingJson(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const raw of promoArray) {
        if (!raw || typeof raw !== 'object') {
          failCount++;
          continue;
        }
        const obj = raw as Record<string, unknown>;
        if (!obj.promo_name || typeof obj.promo_name !== 'string' || !obj.promo_name.trim()) {
          failCount++;
          continue;
        }

        try {
          const normalized = normalizePromoData(obj as any);
          await promoKB.add(normalized as any);
          successCount++;
        } catch (err) {
          console.error('[UploadJSON] Failed to add promo:', err);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} promo berhasil diimport${failCount > 0 ? ` (${failCount} gagal)` : ''}`);
        await loadPromos();
      } else {
        toast.error(`Semua ${failCount} promo gagal diimport — pastikan setiap object punya field "promo_name"`);
      }

      setShowJsonDialog(false);
      setJsonInput('');
    } catch (error) {
      console.error('[UploadJSON] Unexpected error:', error);
      toast.error('Terjadi error saat import JSON');
    } finally {
      setIsImportingJson(false);
    }
  };

  const toggleExpanded = (promoId: string) => {
    setExpandedPromos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(promoId)) {
        newSet.delete(promoId);
      } else {
        newSet.add(promoId);
      }
      return newSet;
    });
  };

  // Load promos: gabungkan Supabase data + localStorage drafts dari Pseudo KB
  const loadPromos = async () => {
    try {
      // 1. Load dari Supabase
      const supabasePromos = await promoKB.getAll();
      // 2. Load localStorage drafts (dari "Gunakan Promo" di Pseudo KB)
      const localDrafts = localDraftKB.getAll();
      // 3. Gabungkan: local drafts di atas (lebih baru), lalu Supabase
      const all = [...localDrafts, ...supabasePromos];
      // 4. Normalize tiap item
      const normalized = all.map(p => {
        try {
          return normalizePromoData(p) as PromoItem;
        } catch (err) {
          console.error('[loadPromos] normalizePromoData failed:', p?.id, err);
          return p as PromoItem;
        }
      });
      setItems(normalized);
      console.log('[PromoKnowledgeSection] Loaded:', localDrafts.length, 'local drafts +', supabasePromos.length, 'Supabase promos');
    } catch (error) {
      console.error('[PromoKnowledgeSection] Failed to load promos:', error);
      setItems([]);
    }
  };

  // Reset viewMode to list when forceResetKey changes (sidebar navigation)
  useEffect(() => {
    if (forceResetKey !== undefined) {
      setViewMode("list");
      setEditingPromo(undefined);
      loadPromos(); // Reload data saat navigasi dari Pseudo Knowledge
    }
  }, [forceResetKey]);

  // Listen for custom event from promo-storage updates (Supabase-backed)
  useEffect(() => {
    const handleStorageEvent = () => {
      console.log('[PromoKnowledgeSection] Storage event, reloading promos...');
      loadPromos();
    };
    
    window.addEventListener('promo-storage-updated', handleStorageEvent);
    
    return () => {
      window.removeEventListener('promo-storage-updated', handleStorageEvent);
    };
  }, []);

  useEffect(() => {
    loadPromos();
  }, []);

  const handleEdit = (promo: PromoItem) => {
    setEditingPromo(promo);
    setViewMode("form");
  };

  const handleAddNew = () => {
    setEditingPromo(undefined);
    setViewMode("form");
  };

  const handleSaveSuccess = async () => {
    setEditingPromo(undefined);
    await loadPromos();   // Tunggu data fresh dari Supabase dulu
    setViewMode("list");  // Baru switch ke list
  };

  const handleDelete = async () => {
    if (deleteId) {
      try {
        const promo = items.find(i => i.id === deleteId);
        if (promo?.is_locked) {
          toast.error(`"${promo.promo_name}" terkunci — buka kunci dulu sebelum menghapus`);
          setDeleteId(null);
          return;
        }
        // Cek apakah ini local draft atau Supabase record
        if (localDraftKB.isLocal(deleteId)) {
          localDraftKB.delete(deleteId);
          toast.success("Draft lokal berhasil dihapus");
          await loadPromos();
        } else {
          const success = await promoKB.delete(deleteId);
          if (success) {
            toast.success("Promo berhasil dihapus");
            await loadPromos();
          } else {
            toast.error("Gagal menghapus promo");
          }
        }
      } catch (error) {
        console.error('[PromoKnowledgeSection] Delete failed:', error);
        toast.error("Gagal menghapus promo");
      } finally {
        setDeleteId(null);
      }
    }
  };

  const handleToggleLock = async (promo: PromoItem) => {
    const newLockState = !promo.is_locked;
    try {
      await promoKB.update(promo.id, { is_locked: newLockState } as Partial<PromoItem>);
      await loadPromos(); // Reload untuk sinkron dengan Supabase
      toast.success(newLockState
        ? `"${promo.promo_name}" dikunci — tidak bisa dihapus`
        : `"${promo.promo_name}" kunci dibuka`
      );
    } catch {
      toast.error("Gagal mengubah status kunci");
    }
  };

  const handleDuplicate = async (promo: PromoItem) => {
    try {
      const newPromo = await duplicatePromo(promo);
      toast.success(`Promo "${promo.promo_name}" berhasil diduplikasi`);
      // Reload dari storage (bukan optimistic update) untuk hindari double entry
      await loadPromos();
      // Langsung buka edit page
      handleEdit(newPromo);
    } catch (error) {
      console.error('[PromoKnowledgeSection] Duplicate failed:', error);
      toast.error("Gagal menduplikasi promo");
    }
  };

  // ============================================
  // CONTRACT PATCH S&K HANDLERS
  // Strategi: Patch kalimat spesifik, bukan regenerate full
  // ============================================
  
  // Kalimat lama yang melanggar kontrak (hardcoded manual claim)
  const OLD_MANUAL_SENTENCE = "Bonus HARUS diklaim secara manual melalui CS.";
  // Kalimat netral pengganti (sesuai kontrak epistemik)
  const NEUTRAL_SENTENCE = "Bonus diproses sesuai mekanisme klaim yang berlaku.";
  
  // Regex untuk menangkap variasi (spasi, titik, case-insensitive)
  const OLD_SENTENCE_REGEX = /Bonus\s+HARUS\s+diklaim\s+secara\s+manual\s+melalui\s+CS\.?/gi;
  
  const patchCustomTerms = (customTerms: string | undefined, promoName?: string): { patched: string; wasChanged: boolean } => {
    console.log('[PatchSK] === START PATCH ===');
    console.log('[PatchSK] Promo:', promoName || 'unknown');
    console.log('[PatchSK] Input customTerms:', customTerms?.substring(0, 200) + '...');
    
    if (!customTerms) {
      console.log('[PatchSK] No custom_terms, returning empty');
      return { patched: '', wasChanged: false };
    }
    
    // Reset regex before testing
    OLD_SENTENCE_REGEX.lastIndex = 0;
    const containsOld = OLD_SENTENCE_REGEX.test(customTerms);
    console.log('[PatchSK] Regex test result:', containsOld);
    console.log('[PatchSK] Regex pattern:', OLD_SENTENCE_REGEX.source);
    
    // Also try simple string includes as fallback check
    const simpleContains = customTerms.includes('HARUS diklaim secara manual');
    console.log('[PatchSK] Simple includes check:', simpleContains);
    
    if (containsOld || simpleContains) {
      // Reset regex for replace
      OLD_SENTENCE_REGEX.lastIndex = 0;
      const patched = customTerms.replace(OLD_SENTENCE_REGEX, NEUTRAL_SENTENCE);
      
      // Verify replacement happened
      const stillContains = patched.includes('HARUS diklaim secara manual');
      console.log('[PatchSK] After patch, still contains old?:', stillContains);
      console.log('[PatchSK] Output patched:', patched.substring(0, 200) + '...');
      console.log('[PatchSK] === CHANGED: TRUE ===');
      
      return { patched, wasChanged: true };
    }
    
    console.log('[PatchSK] === NO CHANGE NEEDED ===');
    return { patched: customTerms, wasChanged: false };
  };
  
  const handleRegenerateSK = async (promo: PromoItem) => {
    console.log('[PatchSK] Starting single patch for:', promo.promo_name);
    console.log('[PatchSK] Promo ID:', promo.id);
    console.log('[PatchSK] Full custom_terms:', promo.custom_terms);
    
    setRegeneratingIds(prev => new Set(prev).add(promo.id));
    
    try {
      const { patched, wasChanged } = patchCustomTerms(promo.custom_terms, promo.promo_name);
      
      if (!wasChanged) {
        console.log('[PatchSK] No change needed for:', promo.promo_name);
        toast.info(`"${promo.promo_name}" sudah netral, tidak perlu patch`);
        return;
      }
      
      console.log('[PatchSK] Calling promoKB.update with patched terms...');
      const success = await promoKB.update(promo.id, {
        custom_terms: patched,
      } as Partial<PromoItem>);
      
      console.log('[PatchSK] Update result:', success);
      
      if (success) {
        toast.success(`S&K "${promo.promo_name}" berhasil dipatch ke netral`);
        loadPromos();
      } else {
        console.error('[PatchSK] promoKB.update returned false!');
        toast.error(`Gagal patch S&K untuk "${promo.promo_name}"`);
      }
    } catch (error) {
      console.error('[PatchSK] Failed:', error);
      toast.error(`Gagal patch S&K untuk "${promo.promo_name}"`);
    } finally {
      setRegeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(promo.id);
        return next;
      });
    }
  };

  const handleRegenerateAllSK = async () => {
    setIsRegeneratingAll(true);
    let patchedCount = 0;
    let skippedCount = 0;
    let failCount = 0;
    
    try {
      for (const promo of items) {
        try {
          const { patched, wasChanged } = patchCustomTerms(promo.custom_terms);
          
          if (!wasChanged) {
            skippedCount++;
            continue;
          }
          
          const success = await promoKB.update(promo.id, {
            custom_terms: patched,
          } as Partial<PromoItem>);
          
          if (success) {
            patchedCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error('[PatchAllSK] Failed for promo:', promo.id, error);
          failCount++;
        }
      }
      
      await loadPromos();
      
      // Post-patch verification
      const updatedPromos = await promoKB.getAll();
      const stillContainsOld = updatedPromos.filter(p => 
        p.custom_terms && OLD_SENTENCE_REGEX.test(p.custom_terms)
      ).length;
      OLD_SENTENCE_REGEX.lastIndex = 0; // Reset regex
      
      if (failCount === 0 && stillContainsOld === 0) {
        toast.success(`✅ ${patchedCount} promo dipatch. ${skippedCount} sudah netral. 0 promo masih manual.`);
      } else if (stillContainsOld > 0) {
        toast.warning(`⚠️ ${patchedCount} dipatch, tapi ${stillContainsOld} promo MASIH mengandung kalimat manual!`);
      } else {
        toast.warning(`${patchedCount} dipatch, ${skippedCount} skip, ${failCount} gagal`);
      }
    } finally {
      setIsRegeneratingAll(false);
    }
  };

  const getStatusBadge = (promo: PromoItem) => {
    // Calculate status based on dates
    const now = new Date();
    const validFrom = promo.valid_from ? new Date(promo.valid_from) : null;
    const validUntil = promo.valid_until ? new Date(promo.valid_until) : null;
    
    let displayStatus: 'active' | 'draft' | 'upcoming' | 'expired' = promo.status === 'draft' ? 'draft' : 'active';
    
    if (promo.status !== 'draft') {
      if (validUntil && now > validUntil) {
        displayStatus = 'expired';
      } else if (validFrom && now < validFrom) {
        displayStatus = 'upcoming';
      } else if (validFrom && validUntil && now >= validFrom && now <= validUntil) {
        displayStatus = 'active';
      }
    }
    
    switch (displayStatus) {
      case "active":
        return <Badge className="bg-success/30 text-success border-0 rounded-full px-3 py-1">Active</Badge>;
      case "upcoming":
        return <Badge className="bg-button-hover/30 text-button-hover border-0 rounded-full px-3 py-1">Upcoming</Badge>;
      case "draft":
        return <Badge className="bg-muted text-muted-foreground border-0 rounded-full px-3 py-1">Draft</Badge>;
      case "expired":
        return <Badge className="bg-declined/30 text-declined border-0 rounded-full px-3 py-1">Expired</Badge>;
      default:
        return <Badge variant="outline" className="rounded-full px-3 py-1">{displayStatus}</Badge>;
    }
  };

  // formatDate and formatDateTime now imported from @/lib/utils
  const formatValidPeriod = (from?: string, until?: string): React.ReactNode => {
    if (!from && !until) return "-";
    const fromFormatted = from ? formatDate(from) : null;
    const untilFormatted = until ? formatDate(until) : null;
    
    return (
      <span className="inline-flex items-center gap-1">
        {fromFormatted || <Infinity className="h-4 w-4 text-muted-foreground" />}
        <span>–</span>
        {untilFormatted || <Infinity className="h-4 w-4 text-muted-foreground" />}
      </span>
    );
  };

  const formatLastUpdated = (dateString?: string) => {
    if (!dateString) return "-";
    return formatDateTime(dateString);
  };

  // ============================================
  // AUTO-CLASSIFICATION LOGIC
  // ============================================
  
  const autoClassifyPromo = async (promo: PromoItem) => {
    // Prevent duplicate calls
    if (classifyingIds.has(promo.id) || classifyQueueRef.current.has(promo.id)) {
      return;
    }
    
    classifyQueueRef.current.add(promo.id);
    setClassifyingIds(prev => new Set(prev).add(promo.id));
    
    try {
      // Build content from promo data for classification
      const content = [
        promo.promo_name,
        promo.promo_type,
        promo.custom_terms || '',
        promo.special_requirements?.join(' ') || '',
      ].filter(Boolean).join('\n');
      
      console.log('[AutoClassify] Classifying promo:', promo.id, promo.promo_name);
      
      const result = await classifyContent(content);
      
      // Update promo in Supabase
      const success = await promoKB.update(promo.id, {
        program_classification: result.category,
        classification_confidence: result.confidence,
      } as Partial<PromoItem>);
      
      if (success) {
        console.log('[AutoClassify] Saved classification:', result.category, 'for', promo.promo_name);
        // Reload promos to reflect change
        loadPromos();
      }
    } catch (error) {
      console.error('[AutoClassify] Failed to classify promo:', promo.id, error);
      toast.error(`Gagal mengklasifikasi ${promo.promo_name}`);
    } finally {
      setClassifyingIds(prev => {
        const next = new Set(prev);
        next.delete(promo.id);
        return next;
      });
      classifyQueueRef.current.delete(promo.id);
    }
  };

  // ============================================
  // CATEGORY BADGE WITH OVERRIDE
  // ============================================
  
  const CategoryBadgeWithOverride = ({ promo, parentPromo }: { promo: PromoItem; parentPromo?: PromoItem }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<ProgramCategory>(promo.program_classification || 'A');
    const [overrideReason, setOverrideReason] = useState('');
    
    const isClassifying = classifyingIds.has(promo.id);
    
    // For sub-promos, inherit classification from parent
    const isSubPromo = !!(promo as any).parent_id;
    const classification = isSubPromo && parentPromo?.program_classification 
      ? parentPromo.program_classification 
      : promo.program_classification;
    
    // Only trigger auto-classification for main promos (not sub-promos)
    useEffect(() => {
      if (!isSubPromo && !classification && !isClassifying) {
        autoClassifyPromo(promo);
      }
    }, [classification, isClassifying, promo, isSubPromo]);
    
    // Loading state (only for main promos)
    if (!isSubPromo && isClassifying) {
      return (
        <Badge variant="outline" className="border-border text-muted-foreground animate-pulse">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Menganalisis...
        </Badge>
      );
    }
    
    // Not classified yet (fallback during loading)
    if (!classification) {
      if (isSubPromo) {
        // Sub-promo without parent classification - show dash
        return <span className="text-muted-foreground">-</span>;
      }
      return (
        <Badge variant="outline" className="border-border text-muted-foreground animate-pulse">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Menganalisis...
        </Badge>
      );
    }
    
    const getBadgeContent = () => {
      switch (classification) {
        case 'A': return { icon: Zap, text: 'Bonus Instan', className: 'bg-warning/20 text-warning border border-warning/30' };
        case 'B': return { icon: Trophy, text: 'Event/Kompetisi', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' };
        case 'C': return { icon: Cog, text: 'System Rule', className: 'bg-pink-500/20 text-pink-400 border border-pink-500/30' };
        default: return null;
      }
    };
    
    const badge = getBadgeContent();
    if (!badge) return <span className="text-muted-foreground">-</span>;
    
    const handleOverride = async () => {
      if (selectedCategory === classification) {
        toast.error('Kategori tidak berubah');
        return;
      }
      if (!overrideReason.trim()) {
        toast.error('Alasan override wajib diisi');
        return;
      }
      
      // Update in Supabase
      try {
        const success = await promoKB.update(promo.id, {
          program_classification: selectedCategory,
          classification_override: {
            from: classification,
            to: selectedCategory,
            reason: overrideReason.trim(),
            overridden_by: 'Admin',
            timestamp: new Date().toISOString(),
          },
        } as Partial<PromoItem>);
        
        if (success) {
          loadPromos();
          toast.success('Kategori berhasil diubah');
          setIsOpen(false);
          setOverrideReason('');
        } else {
          toast.error('Gagal mengubah kategori');
        }
      } catch (error) {
        console.error('[CategoryOverride] Failed:', error);
        toast.error('Gagal mengubah kategori');
      }
    };
    
    const hasOverride = !!promo.classification_override;
    
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Badge 
            className={`${badge.className} cursor-pointer hover:opacity-80 transition-opacity`}
          >
            <badge.icon className="h-3 w-3 mr-1" /> {badge.text}
            {hasOverride && <Edit2 className="h-3 w-3 ml-1 opacity-60" />}
          </Badge>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah Kategori Promo</DialogTitle>
            <DialogDescription>
              AI mendeteksi: <strong>{badge.text}</strong>. Ubah jika salah.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Kategori Baru</label>
              <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as ProgramCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A - Bonus Instan (Welcome, Cashback, dll)</SelectItem>
                  <SelectItem value="B">B - Event/Kompetisi (Tournament, Race, dll)</SelectItem>
                  {/* C is System Rule - should not be selectable as override target */}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Alasan Override</label>
              <Textarea 
                placeholder="Jelaskan kenapa kategori ini salah..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            
            {hasOverride && (
              <div className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
                <p><strong>Override sebelumnya:</strong></p>
                <p>• Dari {promo.classification_override?.from} → {promo.classification_override?.to}</p>
                <p>• Alasan: {promo.classification_override?.reason}</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Batal
            </Button>
            <Button 
              onClick={handleOverride}
              disabled={selectedCategory === classification || !overrideReason.trim()}
            >
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const getCategoryBadge = (promo: PromoItem, parentPromo?: PromoItem) => {
    return <CategoryBadgeWithOverride promo={promo} parentPromo={parentPromo} />;
  };

  // Upload View
  if (viewMode === "upload") {
    return (
      <div className="page-wrapper">
        <div className="space-y-5">
        {/* Top Row */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setViewMode("list")}
            className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Kembali
          </Button>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-lg font-semibold text-button-hover">Add New Promo (Upload)</h2>
          <p className="text-sm text-muted-foreground">
            Upload file CSV untuk menambahkan data promo
          </p>
        </div>

        {/* Step 1 Card */}
        <Card className="p-6 border-2 border-dashed border-border bg-card">
          <h3 className="text-base font-semibold text-button-hover mb-1">Step 1: Download Template</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Download template CSV untuk diisi dengan data promo.
          </p>
          <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
            <Download className="h-4 w-4 mr-2" />
            Download Template (CSV)
          </Button>
        </Card>

        {/* Step 2 Card */}
        <Card className="p-6 border-2 border-dashed border-border bg-card">
          <h3 className="text-base font-semibold text-button-hover mb-1">Step 2: Upload File yang Sudah Diisi</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload file CSV yang sudah diisi dengan data promo.
          </p>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground/60 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              Drag and drop file CSV, atau klik untuk browse
            </p>
            <p className="text-xs text-muted-foreground/70 mb-4">
              CSV files only
            </p>
            <Button size="sm" variant="outline" className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
              <Upload className="h-4 w-4 mr-2" />
              Pilih File
            </Button>
          </div>
        </Card>
        </div>
      </div>
    );
  }

  // Form View
  if (viewMode === "form") {
    return (
      <PromoFormWizard 
        onBack={() => {
          setViewMode("list");
          setEditingPromo(undefined);
          loadPromos();
        }}
        initialData={editingPromo}
        onSaveSuccess={handleSaveSuccess}
      />
    );
  }

  // List View
  return (
    <div className="page-wrapper">
      <div className="space-y-5">
      {/* Top Row: Back button left, Action buttons right */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Kembali
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
            onClick={handleRegenerateAllSK}
            disabled={isRegeneratingAll || items.length === 0}
          >
            {isRegeneratingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {isRegeneratingAll ? 'Regenerating...' : 'Regenerate All S&K'}
          </Button>
          <Button 
            variant="outline"
            className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
            onClick={() => setViewMode("upload")}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
          </Button>
          <Button 
            variant="outline"
            className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
            onClick={() => setShowJsonDialog(true)}
          >
            <FileJson className="h-4 w-4 mr-2" />
            Upload JSON
          </Button>
          <Button 
            variant="outline"
            className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
            onClick={handleAddNew}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Promo
          </Button>
        </div>
      </div>

      {/* Title */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-button-hover">Promo Knowledge Base</h2>
          <p className="text-sm text-muted-foreground">
            Kelola informasi promo untuk AI assistant
          </p>
        </div>
        {items.length > 0 && (
          <Button
            variant="outline"
            className="h-11 px-6 border-border text-destructive hover:bg-destructive/20 hover:text-destructive hover:border-destructive"
            onClick={() => setIsDeleteAllOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete All
          </Button>
        )}
      </div>

      {/* Content Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-button-hover/20 flex items-center justify-center mb-4">
              <Gift className="h-8 w-8 text-button-hover" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Belum ada data promo
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Mulai tambahkan promo ke knowledge base
            </p>
            <Button 
              variant="outline"
              className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
              onClick={handleAddNew}
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Promo Pertama
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="text-foreground font-semibold w-12 text-center">No</TableHead>
                <TableHead className="text-foreground font-semibold">Promo Name</TableHead>
                <TableHead className="text-foreground font-semibold">Category</TableHead>
                <TableHead className="text-foreground font-semibold">Valid Period</TableHead>
                <TableHead className="text-foreground font-semibold">Last Updated</TableHead>
                <TableHead className="text-foreground font-semibold">Status</TableHead>
                <TableHead className="text-right text-foreground font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...items].sort((a, b) => {
                const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                return dateB - dateA;
              }).map((item, index) => {
                const hasSubcategories = item.has_subcategories && item.subcategories && item.subcategories.length > 0;
                const isExpanded = expandedPromos.has(item.id);
                
                return (
                  <Fragment key={item.id}>
                    {/* Main Promo Row */}
                    <TableRow 
                      className={`hover:bg-card ${hasSubcategories ? 'cursor-pointer' : ''}`}
                      onClick={hasSubcategories ? () => toggleExpanded(item.id) : undefined}
                    >
                      <TableCell className="py-4 text-center text-sm text-muted-foreground font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          {hasSubcategories && (
                            <span className="text-muted-foreground">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </span>
                          )}
                           <span className="text-sm font-medium text-foreground">{item.promo_name?.toUpperCase() || "UNTITLED PROMO"}</span>
                          {item.is_locked && (
                            <Lock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                          )}
                          {hasSubcategories && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-0 rounded-full h-7 w-7 p-0 flex items-center justify-center text-xs">
                              {item.subcategories!.length}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {getCategoryBadge(item)}
                      </TableCell>
                      <TableCell className="py-4 text-sm text-muted-foreground">
                        {formatValidPeriod(item.valid_from, item.valid_until)}
                      </TableCell>
                      <TableCell className="py-4 text-sm text-muted-foreground">
                        {formatLastUpdated(item.updated_at)}
                      </TableCell>
                      <TableCell className="py-4">
                        {getStatusBadge(item)}
                      </TableCell>
                      <TableCell className="py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-button-hover hover:text-button-hover-foreground"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card border-border w-48">
                            <DropdownMenuItem 
                              onClick={() => setViewTermsItem(item)}
                              className="cursor-pointer hover:bg-button-hover hover:text-button-hover-foreground"
                            >
                              <div className="h-7 w-7 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
                                <Eye className="h-4 w-4 text-blue-500" />
                              </div>
                              <span>Lihat S&K</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleEdit(item)}
                              className="cursor-pointer hover:bg-button-hover hover:text-button-hover-foreground"
                            >
                              <div className="h-7 w-7 rounded-full bg-success/20 flex items-center justify-center mr-3">
                                <Pencil className="h-4 w-4 text-success" />
                              </div>
                              <span>Edit Promo</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDuplicate(item)}
                              className="cursor-pointer hover:bg-button-hover hover:text-button-hover-foreground"
                            >
                              <div className="h-7 w-7 rounded-full bg-purple-500/20 flex items-center justify-center mr-3">
                                <Copy className="h-4 w-4 text-purple-500" />
                              </div>
                              <span>Duplicate Promo</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleRegenerateSK(item)}
                              disabled={regeneratingIds.has(item.id)}
                              className="cursor-pointer hover:bg-button-hover hover:text-button-hover-foreground"
                            >
                              <div className="h-7 w-7 rounded-full bg-amber-500/20 flex items-center justify-center mr-3">
                                {regeneratingIds.has(item.id) ? (
                                  <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4 text-amber-500" />
                                )}
                              </div>
                              <span>{regeneratingIds.has(item.id) ? 'Regenerating...' : 'Regenerate S&K'}</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem 
                              onClick={() => handleToggleLock(item)}
                              className="cursor-pointer hover:bg-button-hover hover:text-button-hover-foreground"
                            >
                              <div className={`h-7 w-7 rounded-full flex items-center justify-center mr-3 ${item.is_locked ? 'bg-amber-500/20' : 'bg-muted'}`}>
                                {item.is_locked
                                  ? <Unlock className="h-4 w-4 text-amber-500" />
                                  : <Lock className="h-4 w-4 text-muted-foreground" />
                                }
                              </div>
                              <span>{item.is_locked ? 'Buka Kunci' : 'Kunci Promo'}</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem 
                              onClick={() => !item.is_locked && setDeleteId(item.id)}
                              disabled={item.is_locked}
                              className={item.is_locked ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-destructive/20 hover:text-destructive focus:bg-destructive/20 focus:text-destructive'}
                            >
                              <div className="h-7 w-7 rounded-full bg-destructive/20 flex items-center justify-center mr-3">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </div>
                              <span>{item.is_locked ? 'Terkunci' : 'Delete Promo'}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    
                    {/* Subcategory Rows - Sorted by calculation_value ascending */}
                    {hasSubcategories && isExpanded && [...item.subcategories!]
                      .sort((a, b) => {
                        const valueA = Number(a.calculation_value) || 0;
                        const valueB = Number(b.calculation_value) || 0;
                        return valueA - valueB; // ascending (smallest first)
                      })
                      .map((sub, subIndex) => (
                      <TableRow key={`${item.id}-sub-${subIndex}`} className="bg-muted/30 hover:bg-muted/50">
                        {/* No - kosongkan untuk subcategory */}
                        <TableCell className="py-3"></TableCell>
                        
                        {/* Promo Name - dengan indent */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2 pl-6">
                            <span className="text-muted-foreground">↳</span>
                            <span className="text-sm text-foreground font-medium">{formatSubcategoryName(sub, inferRewardType(sub, item), `Varian ${subIndex + 1}`)}</span>
                            {sub.game_types && sub.game_types.length > 0 && (
                              <Badge className="bg-button-hover/20 text-button-hover border-0 rounded-full px-2 py-0.5 text-xs">
                                {sub.game_types.map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).join(", ")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        
                        {/* Category - tampilkan reward type */}
                        <TableCell className="py-3">
                          {(() => {
                            const rewardType = inferRewardType(sub, item);
                            const badgeInfo = getRewardBadgeInfo(rewardType);
                            if (badgeInfo) {
                              return (
                                <Badge className={`${badgeInfo.bgClass} ${badgeInfo.textClass} border ${badgeInfo.borderClass} text-xs`}>
                                  {badgeInfo.emoji} {badgeInfo.label}
                                </Badge>
                              );
                            }
                            return <span className="text-muted-foreground">-</span>;
                          })()}
                        </TableCell>
                        
                        {/* Valid Period */}
                        <TableCell className="py-3 text-sm text-muted-foreground">-</TableCell>
                        
                        {/* Last Updated */}
                        <TableCell className="py-3"></TableCell>
                        
                        {/* Status */}
                        <TableCell className="py-3"></TableCell>
                        
                        {/* Actions */}
                        <TableCell className="py-3"></TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Hapus Promo?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Apakah Anda yakin ingin menghapus promo ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-sm">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-sm"
              onClick={handleDelete}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* S&K Dialog */}
      <Dialog open={!!viewTermsItem} onOpenChange={() => setViewTermsItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-button-hover">
              Syarat & Ketentuan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Generate S&K on-the-fly jika custom_terms kosong */}
            {(() => {
              if (!viewTermsItem) return null;
              
              // Jika custom_terms sudah ada, tampilkan dengan proper formatting
              if (viewTermsItem.custom_terms && viewTermsItem.custom_terms.trim()) {
                // Parse custom_terms: split by newline, remove empty lines, remove number prefix
                // Normalize: split by semicolon or newline, trim, remove empty/header lines
                const termsList = viewTermsItem.custom_terms
                  .split(/[\n;]+/)  // Split by newline OR semicolon for draft promos
                  .map(line => line.trim())
                  .filter(line => line !== '')
                  .map(line => line.replace(/^\d+\.\s*/, '').replace(/^Syarat & Ketentuan:\s*/i, '').trim())
                  .filter(line => {
                    if (line === '' || line.length <= 10) return false;
                    // Skip separator lines (dashes only)
                    if (/^[-–—]+$/.test(line)) return false;
                    // Skip "Contoh Perhitungan" section headers
                    if (/^Contoh Perhitungan/i.test(line)) return false;
                    // Skip calculation formula examples
                    if (/^\d[\d.,]*\s*[x×].*=.*\(.*\)$/i.test(line)) return false;
                    // Skip formula template lines
                    if (/^Total\s+.*\s*[x×].*%.*=/i.test(line)) return false;
                    // Skip lines that are ONLY numbers (e.g., "0", "100", "1.000.000")
                    if (/^[\d.,\s]+$/.test(line)) return false;
                    return true;
                  });

                return (
                  <div className="bg-muted rounded-lg p-4 space-y-4">
                    {/* Header nama promo */}
                    <div className="text-base font-bold text-button-hover">
                      {viewTermsItem.promo_name?.toUpperCase() || 'NAMA PROMO'}
                    </div>
                    
                    {/* Contoh Perhitungan untuk formula (dinamis) mode */}
                    {viewTermsItem.reward_mode === 'formula' && (viewTermsItem.calculation_value ?? 0) > 0 && (
                      <div className="bg-background rounded-lg p-3 font-mono text-xs space-y-1 border border-border">
                        <p className="font-semibold text-foreground mb-1">Contoh Perhitungan:</p>
                        <p className="text-muted-foreground">
                          Total {viewTermsItem.calculation_base || 'Turnover'} x {viewTermsItem.calculation_value}% = Nilai Bonus
                        </p>
                        <p className="text-muted-foreground">-----------------------------------------------</p>
                        <p className="text-foreground">
                          {formatNumber(viewTermsItem.min_calculation && viewTermsItem.min_calculation > 0 ? viewTermsItem.min_calculation : 1000000)} x {viewTermsItem.calculation_value}% = {formatNumber((viewTermsItem.min_calculation && viewTermsItem.min_calculation > 0 ? viewTermsItem.min_calculation : 1000000) * (viewTermsItem.calculation_value / 100))} (Bonus yang didapat)
                        </p>
                      </div>
                    )}
                    
                    {/* S&K dengan proper ordered list - scrollable for long lists */}
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground text-sm">Syarat & Ketentuan:</p>
                      <ScrollArea className="max-h-[350px] pr-4">
                        <ol className="list-decimal list-outside pl-6 space-y-1 text-sm text-muted-foreground">
                          {termsList.map((term, i) => (
                            <li key={i} className="pl-2 leading-relaxed">
                              {term}
                            </li>
                          ))}
                        </ol>
                      </ScrollArea>
                    </div>
                  </div>
                );
              }
              
              const terms = generateTermsList(viewTermsItem);
              return (
                <div className="bg-muted rounded-lg p-4 space-y-4">
                  {/* Header nama promo */}
                  <div className="text-base font-bold text-button-hover">
                    {viewTermsItem.promo_name?.toUpperCase() || 'NAMA PROMO'}
                  </div>
                  
                  {/* Contoh Perhitungan untuk formula (dinamis) mode */}
                  {viewTermsItem.reward_mode === 'formula' && (viewTermsItem.calculation_value ?? 0) > 0 && (
                    <div className="bg-background rounded-lg p-3 font-mono text-xs space-y-1 border border-border">
                      <p className="font-semibold text-foreground mb-1">Contoh Perhitungan:</p>
                      <p className="text-muted-foreground">
                        Total {viewTermsItem.calculation_base || 'Turnover'} x {viewTermsItem.calculation_value}% = Nilai Bonus
                      </p>
                      <p className="text-muted-foreground">-----------------------------------------------</p>
                      <p className="text-foreground">
                        {formatNumber(viewTermsItem.min_calculation && viewTermsItem.min_calculation > 0 ? viewTermsItem.min_calculation : 1000000)} x {viewTermsItem.calculation_value}% = {formatNumber((viewTermsItem.min_calculation && viewTermsItem.min_calculation > 0 ? viewTermsItem.min_calculation : 1000000) * (viewTermsItem.calculation_value / 100))} (Bonus yang didapat)
                      </p>
                    </div>
                  )}
                  
                  {/* Generated S&K */}
                  <div className="space-y-2">
                    <p className="font-semibold text-foreground text-sm">Syarat & Ketentuan:</p>
                    <ol className="list-decimal list-outside pl-6 space-y-1 text-sm text-muted-foreground">
                      {terms.map((term, i) => (
                        <li key={i} className="pl-2 leading-relaxed">
                          {term}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              );
            })()}
            
            {viewTermsItem?.special_requirements && viewTermsItem.special_requirements.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Syarat Khusus:</h4>
                <ul className="space-y-1">
                  {viewTermsItem.special_requirements.map((req, idx) => (
                    <li key={idx} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="flex-shrink-0">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload JSON Dialog */}
      <Dialog open={showJsonDialog} onOpenChange={setShowJsonDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload JSON Promo</DialogTitle>
            <DialogDescription>
              Paste JSON promo (single object atau array). Setiap object harus punya field <code className="text-foreground">promo_name</code>.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={'{\n  "promo_name": "Welcome Bonus 100%",\n  "promo_type": "deposit",\n  "reward_amount": 100,\n  ...\n}'}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="min-h-[300px] font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowJsonDialog(false); setJsonInput(''); }}>
              Batal
            </Button>
            <Button onClick={handleJsonImport} disabled={isImportingJson || !jsonInput.trim()}>
              {isImportingJson ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <FileJson className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Hapus Semua Promo?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {(() => {
                const locked = items.filter(i => i.is_locked).length;
                const deletable = items.length - locked;
                return locked > 0
                  ? <>Anda akan menghapus <strong>{deletable}</strong> promo. <strong>{locked}</strong> promo terkunci akan dilewati dan tidak terhapus.</>
                  : <>Anda akan menghapus <strong>{items.length}</strong> promo. Tindakan ini tidak dapat dibatalkan.</>;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-sm">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-sm"
              onClick={async () => {
                try {
                  const deletable = items.filter(i => !i.is_locked);
                  const skipped = items.filter(i => i.is_locked).length;
                  for (const item of deletable) {
                    await promoKB.delete(item.id); // Supabase delete
                  }
                  await loadPromos(); // Reload 1:1 dari Supabase
                  if (skipped > 0) {
                    toast.success(`${deletable.length} promo dihapus. ${skipped} promo terkunci dilewati.`);
                  } else {
                    toast.success("Semua promo berhasil dihapus");
                  }
                } catch (error) {
                  console.error('[PromoKnowledgeSection] Delete all failed:', error);
                  toast.error("Gagal menghapus semua promo");
                  await loadPromos();
                }
                setIsDeleteAllOpen(false);
              }}
            >
              Hapus Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
