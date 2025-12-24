import { useState, useEffect, Fragment } from "react";
import { formatDate, formatDateTime } from "@/lib/utils";
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
import { FileText, Plus, Pencil, Trash2, Eye, MoreHorizontal, Copy, ChevronRight, ChevronDown, Infinity } from "lucide-react";
import { toast } from "sonner";
import { PromoItem, getPromoDrafts, deletePromoDraft, savePromoDraft } from "./PromoFormWizard/types";

interface PromoListViewProps {
  onEdit?: (promo: PromoItem) => void;
  onAddNew?: () => void;
}

// Helper: Normalize reward type dari berbagai format legacy data
const normalizeRewardType = (sub: any): 'hadiah_fisik' | 'credit_game' | 'uang_tunai' | null => {
  // Coba dari jenis_hadiah dulu
  const jh = (sub.jenis_hadiah || '').toLowerCase();
  if (jh.includes('fisik') || jh === 'hadiah_fisik') return 'hadiah_fisik';
  if (jh.includes('credit') || jh === 'credit_game') return 'credit_game';
  if (jh.includes('tunai') || jh === 'uang_tunai') return 'uang_tunai';
  
  // Coba dari dinamis_reward_type (legacy)
  const drt = (sub.dinamis_reward_type || '').toLowerCase();
  if (drt.includes('fisik')) return 'hadiah_fisik';
  if (drt.includes('credit') || drt === 'freechip') return 'credit_game';
  if (drt.includes('tunai')) return 'uang_tunai';
  
  // Infer dari nama subcategory
  const name = (sub.name || '').toLowerCase();
  if (/honda|pcx|iphone|macbook|samsung|watch|emas|motor|mobil|apple|gold|voucher\s*(belanja|alfamart|indomaret)/.test(name)) return 'hadiah_fisik';
  if (/credit\s*game|freechip|freebet|chip|rp\s*[\d.,]+/.test(name)) return 'credit_game';
  if (/uang\s*tunai|cash|transfer/.test(name)) return 'uang_tunai';
  
  return null;
};

// Helper: Get quantity dengan fallback ke 1
const getQuantity = (sub: any): number => {
  return sub.physical_reward_quantity ?? 1;
};

export function PromoListView({ onEdit, onAddNew }: PromoListViewProps) {
  const [promos, setPromos] = useState<PromoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewTermsPromo, setViewTermsPromo] = useState<PromoItem | null>(null);
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

  const loadPromos = async () => {
    setIsLoading(true);
    try {
      const data = await getPromoDrafts();
      setPromos(data);
    } catch (error) {
      console.error('Failed to load promos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPromos();
  }, []);

  const handleDelete = async () => {
    if (deleteId) {
      const promo = promos.find(p => p.id === deleteId);
      await deletePromoDraft(deleteId);
      toast.success(`Promo "${promo?.promo_name || 'Untitled'}" berhasil dihapus`);
      await loadPromos();
      setDeleteId(null);
    }
  };

  const handleDuplicate = async (promo: PromoItem) => {
    const newPromoData = {
      ...promo,
      promo_name: `${promo.promo_name} (Copy)`,
      status: "draft" as const,
      is_active: false,
    };
    
    // Remove id so savePromoDraft creates a new one
    const { id, version, created_at, updated_at, ...dataWithoutMeta } = newPromoData;
    
    const savedPromo = await savePromoDraft(dataWithoutMeta);
    if (savedPromo) {
      toast.success(`Promo "${promo.promo_name}" berhasil diduplikasi`);
      await loadPromos();
      onEdit?.(savedPromo);
    }
  };

  // formatDate and formatDateTime now imported from @/lib/utils

  const getCategoryBadge = (classification?: string) => {
    switch (classification) {
      case 'A':
        return <Badge className="bg-warning/20 text-warning border border-warning/30">⚡ Bonus Instan</Badge>;
      case 'B':
        return <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">🏆 Event/Kompetisi</Badge>;
      case 'C':
        return <Badge className="bg-pink-500/20 text-pink-400 border border-pink-500/30">🧠 Program Sistem</Badge>;
      default:
        return <Badge variant="outline" className="border-border text-muted-foreground/50">-</Badge>;
    }
  };

  const formatValidPeriod = (promo: PromoItem): React.ReactNode => {
    if (promo.valid_from && promo.valid_until) {
      return `${formatDate(promo.valid_from)} - ${formatDate(promo.valid_until)}`;
    }
    if (promo.valid_from) {
      return (
        <span className="inline-flex items-center gap-1">
          {formatDate(promo.valid_from)} – <Infinity className="h-4 w-4 text-muted-foreground" />
        </span>
      );
    }
    return "-";
  };

  if (promos.length === 0) {
    return (
      <div className="page-wrapper space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-button-hover mb-2">Promo Knowledge Base</h2>
            <p className="text-muted-foreground">
              Kelola informasi promo untuk AI assistant
            </p>
          </div>
          {onAddNew && (
            <Button variant="outline" onClick={onAddNew} className="rounded-full border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
              <Plus className="h-4 w-4 mr-2" />
              Tambah Promo
            </Button>
          )}
        </div>
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-button-hover/20 flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-button-hover" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Belum ada data promo
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Mulai tambahkan promo ke knowledge base
            </p>
            {onAddNew && (
              <Button variant="outline" onClick={onAddNew} className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Promo Pertama
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-wrapper space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-button-hover mb-2">Promo Knowledge Base</h2>
          <p className="text-muted-foreground">
            Kelola informasi promo untuk AI assistant
          </p>
        </div>
        {onAddNew && (
          <Button variant="outline" onClick={onAddNew} className="rounded-full border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Promo
          </Button>
        )}
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-foreground font-semibold px-4 w-[22%]">Promo Name</TableHead>
              <TableHead className="text-foreground font-semibold px-4 w-[14%] text-center">Category</TableHead>
              <TableHead className="text-foreground font-semibold px-4 w-[20%]">Valid Period</TableHead>
              <TableHead className="text-foreground font-semibold px-4 w-[18%]">Last Updated</TableHead>
              <TableHead className="text-foreground font-semibold px-4 w-[12%] text-center">Status</TableHead>
              <TableHead className="text-foreground font-semibold px-4 w-[14%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promos.map((promo) => {
              // DEBUG: Check subcategory data
              console.log('Promo Debug:', promo.promo_name, {
                has_subcategories: promo.has_subcategories,
                subcategories: promo.subcategories,
                subcategoriesCount: promo.subcategories?.length
              });
              
              const hasSubcategories = promo.has_subcategories && promo.subcategories && promo.subcategories.length > 0;
              const isExpanded = expandedPromos.has(promo.id);
              
              return (
                <Fragment key={promo.id}>
                  {/* Main Promo Row */}
                  <TableRow 
                    className={`hover:bg-muted/20 ${hasSubcategories ? 'cursor-pointer' : ''}`}
                    onClick={hasSubcategories ? () => toggleExpanded(promo.id) : undefined}
                  >
                    <TableCell className="font-medium text-foreground px-4 py-4">
                      <div className="flex items-center gap-2">
                        {hasSubcategories && (
                          <div className="flex-shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-button-hover" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        )}
                        <span>{promo.promo_name || <span className="text-muted-foreground italic">Untitled Promo</span>}</span>
                        {hasSubcategories && (
                          <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full h-7 w-7 p-0 flex items-center justify-center text-xs">
                            {promo.subcategories.length}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center px-4 py-4">
                      {getCategoryBadge(promo.program_classification)}
                    </TableCell>
                    <TableCell className="text-muted-foreground px-4 py-4">
                      {formatValidPeriod(promo)}
                    </TableCell>
                    <TableCell className="text-muted-foreground px-4 py-4">
                      {formatDateTime(promo.updated_at)}
                    </TableCell>
                    <TableCell className="text-center px-4 py-4">
                      {promo.is_active ? (
                        <Badge className="bg-success/20 text-success border border-success/30">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground border border-border">
                          Draft
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right px-4 py-4" onClick={(e) => e.stopPropagation()}>
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
                            onClick={() => setViewTermsPromo(promo)}
                            className="cursor-pointer hover:bg-button-hover hover:text-button-hover-foreground"
                          >
                            <div className="h-7 w-7 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
                              <Eye className="h-4 w-4 text-blue-500" />
                            </div>
                            <span>Lihat S&K</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onEdit?.(promo)}
                            className="cursor-pointer hover:bg-button-hover hover:text-button-hover-foreground"
                          >
                            <div className="h-7 w-7 rounded-full bg-success/20 flex items-center justify-center mr-3">
                              <Pencil className="h-4 w-4 text-success" />
                            </div>
                            <span>Edit Promo</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(promo)}
                            className="cursor-pointer hover:bg-button-hover hover:text-button-hover-foreground"
                          >
                            <div className="h-7 w-7 rounded-full bg-purple-500/20 flex items-center justify-center mr-3">
                              <Copy className="h-4 w-4 text-purple-500" />
                            </div>
                            <span>Duplicate Promo</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-border" />
                          <DropdownMenuItem
                            onClick={() => setDeleteId(promo.id)}
                            disabled={promo.is_active}
                            className="cursor-pointer hover:bg-destructive/20 hover:text-destructive focus:bg-destructive/20 focus:text-destructive"
                          >
                            <div className="h-7 w-7 rounded-full bg-destructive/20 flex items-center justify-center mr-3">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </div>
                            <span>{promo.is_active ? "Tidak bisa hapus" : "Delete Promo"}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded Subcategories Rows */}
                  {hasSubcategories && isExpanded && promo.subcategories.map((sub, idx) => (
                    <TableRow key={`${promo.id}-sub-${idx}`} className="bg-muted/10 hover:bg-muted/20">
                      <TableCell className="pl-10 pr-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-purple-500/50 rounded-full" />
                          <span className="text-sm text-foreground font-medium">
                            {getQuantity(sub)} {sub.name || `Varian ${idx + 1}`}
                          </span>
                          {/* Value Badge untuk Credit Game */}
                          {normalizeRewardType(sub) === 'credit_game' && (sub.cash_reward_amount ?? 0) > 0 && (
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/20">
                              Rp {sub.cash_reward_amount?.toLocaleString('id-ID')}
                            </Badge>
                          )}
                          {/* Value Badge untuk Uang Tunai */}
                          {normalizeRewardType(sub) === 'uang_tunai' && (sub.cash_reward_amount ?? 0) > 0 && (
                            <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                              Rp {sub.cash_reward_amount?.toLocaleString('id-ID')}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm px-4 py-3">
                        {(() => {
                          const rewardType = normalizeRewardType(sub);
                          if (rewardType === 'hadiah_fisik') {
                            return <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs">🎁 Hadiah Fisik</Badge>;
                          } else if (rewardType === 'credit_game') {
                            return <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 text-xs">🎮 Credit Game</Badge>;
                          } else if (rewardType === 'uang_tunai') {
                            return <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs">💰 Uang Tunai</Badge>;
                          } else {
                            return <span className="text-muted-foreground">-</span>;
                          }
                        })()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm px-4 py-3">
                        -
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm px-4 py-3">
                        -
                      </TableCell>
                      <TableCell className="text-center px-4 py-3">
                        <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs">
                          Varian
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-4 py-3">
                        {/* No actions for subcategory rows */}
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* S&K Terms Popup Dialog */}
      <Dialog open={!!viewTermsPromo} onOpenChange={() => setViewTermsPromo(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-button-hover text-xl">
              Syarat & Ketentuan: {viewTermsPromo?.promo_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {viewTermsPromo?.custom_terms ? (
              <div className="bg-muted rounded-lg p-4">
                <ol className="list-decimal list-outside pl-6 space-y-1 text-sm text-foreground">
                  {viewTermsPromo.custom_terms
                    .split('\n')
                    .filter(line => line.trim() !== '')
                    .map((term, i) => (
                      <li key={i} className="pl-2 leading-relaxed">
                        {term.replace(/^\d+\.\s*/, '')}
                      </li>
                    ))}
                </ol>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  Belum ada syarat & ketentuan yang ditambahkan untuk promo ini.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Promo?</AlertDialogTitle>
            <AlertDialogDescription>
              Promo ini akan dihapus secara permanen dari daftar. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="rounded-full bg-declined text-white hover:bg-declined/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}