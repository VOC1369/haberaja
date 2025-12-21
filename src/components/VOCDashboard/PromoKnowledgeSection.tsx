import { useState, useEffect, Fragment } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Gift, Plus, Pencil, Trash2, ArrowLeft, Upload, Download, MoreHorizontal, Eye, Copy, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { PromoFormWizard } from "./PromoFormWizard";
import { PromoItem, forceSeedSamplePromos } from "./PromoFormWizard/types";
import { generateTermsList, formatNumber } from "./PromoFormWizard/Step4Review";

const PROMO_STORAGE_KEY = "voc_promo_drafts";

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

  // Simple loadPromos - just read from localStorage, no seeding
  const loadPromos = () => {
    const stored = localStorage.getItem(PROMO_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setItems(Array.isArray(parsed) ? parsed : []);
        console.log('[PromoKnowledgeSection] Loaded promos:', parsed?.length || 0);
      } catch {
        setItems([]);
      }
    } else {
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

  // Listen for storage changes (when promo added from PseudoKnowledgeSection)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PROMO_STORAGE_KEY) {
        console.log('[PromoKnowledgeSection] Storage changed, reloading promos...');
        loadPromos();
      }
    };
    
    // Also listen for custom event from same-window storage updates
    const handleCustomStorageEvent = () => {
      console.log('[PromoKnowledgeSection] Custom storage event, reloading promos...');
      loadPromos();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('promo-storage-updated', handleCustomStorageEvent);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('promo-storage-updated', handleCustomStorageEvent);
    };
  }, []);

  useEffect(() => {
    // One-time seed: hanya jalankan sekali saja (flag disimpan di localStorage, bukan sessionStorage)
    const SEED_FLAG_KEY = 'voc_promo_initial_seed_v1';
    const hasInitialSeed = localStorage.getItem(SEED_FLAG_KEY);
    
    if (!hasInitialSeed) {
      forceSeedSamplePromos();
      localStorage.setItem(SEED_FLAG_KEY, 'true');
      toast.success("Sample promo Welcome Bonus dengan 3 varian berhasil dimuat");
    }
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

  const handleSaveSuccess = () => {
    setEditingPromo(undefined);
    setViewMode("list");
    loadPromos();
  };

  const handleDelete = () => {
    if (deleteId) {
      const updatedItems = items.filter(item => item.id !== deleteId);
      localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(updatedItems));
      setItems(updatedItems);
      toast.success("Promo berhasil dihapus");
      setDeleteId(null);
    }
  };

  const handleDuplicate = (promo: PromoItem) => {
    const newPromo: PromoItem = {
      ...promo,
      id: crypto.randomUUID(),
      promo_name: `${promo.promo_name} (Copy)`,
      status: "draft",
      is_active: false,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updatedItems = [newPromo, ...items];
    localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(updatedItems));
    setItems(updatedItems);
    toast.success(`Promo "${promo.promo_name}" berhasil diduplikasi`);
    // Langsung buka edit page
    handleEdit(newPromo);
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

  const formatValidPeriod = (from?: string, until?: string) => {
    if (!from && !until) return "-";
    const formatSingleDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    };
    const fromFormatted = from ? formatSingleDate(from) : "?";
    const untilFormatted = until ? formatSingleDate(until) : "?";
    return `${fromFormatted} – ${untilFormatted}`;
  };

  const formatLastUpdated = (dateString?: string) => {
    if (!dateString) return "-";
    
    try {
      const dateObj = new Date(dateString);
      if (isNaN(dateObj.getTime())) return "-";
      
      const date = dateObj.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
      const time = dateObj.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      return `${date}, ${time}`;
    } catch {
      return "-";
    }
  };

  const getCategoryBadge = (classification?: string) => {
    switch (classification) {
      case 'A':
        return <Badge className="bg-success/20 text-success border border-success/30">Reward</Badge>;
      case 'B':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Event</Badge>;
      case 'C':
        return <Badge variant="outline" className="border-border text-muted-foreground">Policy</Badge>;
      default:
        return <Badge variant="outline" className="border-border text-muted-foreground/50">-</Badge>;
    }
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
            onClick={() => setViewMode("upload")}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
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
      <div>
        <h2 className="text-lg font-semibold text-button-hover">Promo Knowledge Base</h2>
        <p className="text-sm text-muted-foreground">
          Kelola informasi promo untuk AI assistant
        </p>
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
                <TableHead className="text-foreground font-semibold">Promo Name</TableHead>
                <TableHead className="text-foreground font-semibold text-center">Category</TableHead>
                <TableHead className="text-foreground font-semibold">Valid Period</TableHead>
                <TableHead className="text-foreground font-semibold">Last Updated</TableHead>
                <TableHead className="text-foreground font-semibold">Status</TableHead>
                <TableHead className="text-right text-foreground font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const hasSubcategories = item.has_subcategories && item.subcategories && item.subcategories.length > 0;
                const isExpanded = expandedPromos.has(item.id);
                
                return (
                  <Fragment key={item.id}>
                    {/* Main Promo Row */}
                    <TableRow 
                      className={`hover:bg-card ${hasSubcategories ? 'cursor-pointer' : ''}`}
                      onClick={hasSubcategories ? () => toggleExpanded(item.id) : undefined}
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          {hasSubcategories && (
                            <span className="text-muted-foreground">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </span>
                          )}
                          <span className="text-sm font-medium text-foreground">{item.promo_name || "Untitled Promo"}</span>
                          {hasSubcategories && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-0 rounded-full px-2 py-0.5 text-xs">
                              {item.subcategories!.length} Varian
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        {getCategoryBadge(item.program_classification)}
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
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem 
                              onClick={() => setDeleteId(item.id)}
                              className="cursor-pointer hover:bg-destructive/20 hover:text-destructive focus:bg-destructive/20 focus:text-destructive"
                            >
                              <div className="h-7 w-7 rounded-full bg-destructive/20 flex items-center justify-center mr-3">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </div>
                              <span>Delete Promo</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    
                    {/* Subcategory Rows */}
                    {hasSubcategories && isExpanded && item.subcategories!.map((sub, subIndex) => (
                      <TableRow key={`${item.id}-sub-${subIndex}`} className="bg-muted/30 hover:bg-muted/50">
                        <TableCell className="py-3 pl-10">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">↳</span>
                            <span className="text-sm text-foreground">{sub.name || `Varian ${subIndex + 1}`}</span>
                            {sub.game_types && sub.game_types.length > 0 && (
                              <Badge className="bg-button-hover/20 text-button-hover border-0 rounded-full px-2 py-0.5 text-xs">
                                {sub.game_types.map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).join(", ")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground">
                          {sub.game_providers?.join(", ") || "-"}
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground">
                          {sub.calculation_method || "-"}
                        </TableCell>
                        <TableCell className="py-3">
                          {sub.calculation_value && (
                            <span className="text-xs text-muted-foreground">
                              {sub.calculation_value}%
                            </span>
                          )}
                        </TableCell>
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
                const termsList = viewTermsItem.custom_terms
                  .split('\n')
                  .filter(line => line.trim() !== '')
                  .map(line => line.replace(/^\d+\.\s*/, '').replace(/^Syarat & Ketentuan:\s*/i, '').trim())
                  .filter(line => line !== '');

                return (
                  <div className="bg-muted rounded-lg p-4 space-y-4">
                    {/* Header nama promo */}
                    <div className="text-base font-bold text-button-hover">
                      {viewTermsItem.promo_name?.toUpperCase() || 'NAMA PROMO'}
                    </div>
                    
                    {/* Contoh Perhitungan untuk formula (dinamis) mode */}
                    {viewTermsItem.reward_mode === 'formula' && viewTermsItem.calculation_value && (
                      <div className="bg-background rounded-lg p-3 font-mono text-xs space-y-1 border border-border">
                        <p className="font-semibold text-foreground mb-1">Contoh Perhitungan:</p>
                        <p className="text-muted-foreground">
                          Total {viewTermsItem.calculation_base || 'Turnover'} x {viewTermsItem.calculation_value}% = Nilai Bonus
                        </p>
                        <p className="text-muted-foreground">-----------------------------------------------</p>
                        <p className="text-foreground">
                          {formatNumber(viewTermsItem.minimum_base && viewTermsItem.minimum_base > 0 ? viewTermsItem.minimum_base : 1000000)} x {viewTermsItem.calculation_value}% = {formatNumber((viewTermsItem.minimum_base && viewTermsItem.minimum_base > 0 ? viewTermsItem.minimum_base : 1000000) * (viewTermsItem.calculation_value / 100))} (Bonus yang didapat)
                        </p>
                      </div>
                    )}
                    
                    {/* S&K dengan proper ordered list */}
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground text-sm">Syarat & Ketentuan:</p>
                      <ol className="list-decimal list-outside pl-6 space-y-1 text-sm text-muted-foreground">
                        {termsList.map((term, i) => (
                          <li key={i} className="pl-2 leading-relaxed">
                            {term}
                          </li>
                        ))}
                      </ol>
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
                  {viewTermsItem.reward_mode === 'formula' && viewTermsItem.calculation_value && (
                    <div className="bg-background rounded-lg p-3 font-mono text-xs space-y-1 border border-border">
                      <p className="font-semibold text-foreground mb-1">Contoh Perhitungan:</p>
                      <p className="text-muted-foreground">
                        Total {viewTermsItem.calculation_base || 'Turnover'} x {viewTermsItem.calculation_value}% = Nilai Bonus
                      </p>
                      <p className="text-muted-foreground">-----------------------------------------------</p>
                      <p className="text-foreground">
                        {formatNumber(viewTermsItem.minimum_base && viewTermsItem.minimum_base > 0 ? viewTermsItem.minimum_base : 1000000)} x {viewTermsItem.calculation_value}% = {formatNumber((viewTermsItem.minimum_base && viewTermsItem.minimum_base > 0 ? viewTermsItem.minimum_base : 1000000) * (viewTermsItem.calculation_value / 100))} (Bonus yang didapat)
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
      </div>
    </div>
  );
}
