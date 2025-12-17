/**
 * APBE v1.2 Persona List View
 * Displays all published persona configurations with Edit/Delete/Activate actions
 * Includes Sample Persona Templates for onboarding
 */

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  ArrowLeft, 
  Plus, 
  Pencil, 
  Trash2,
  Wand2,
  ArrowUpDown,
  Crown,
  Smile,
  Briefcase,
  FileText,
  Download,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { 
  APBEVersion, 
  getConfigVersions, 
  deleteVersion, 
  activateVersion,
  deactivateVersion
} from "@/lib/apbe-storage";
import { SAMPLE_PERSONAS, SamplePersona } from "@/lib/apbe-sample-data";
import { APBEConfig } from "@/types/apbe-config";
import { exportAPBEConfig, APBEExportMeta } from "@/lib/apbe-export-import";
import { APBEImportDialog } from "./APBEImportDialog";

interface APBEPersonaListProps {
  onBack: () => void;
  onCreateNew: () => void;
  onEdit: (version: APBEVersion) => void;
  onLoadSample?: (config: APBEConfig, name: string) => void;
  onImport?: (config: APBEConfig, meta: APBEExportMeta | null) => void;
  searchQuery?: string;
}

type SortOption = "version" | "created_at" | "name";

// Sample persona display config
const samplePersonaCards = [
  {
    name: "Danila",
    subtitle: "Corporate Premium",
    description: "Formal, elite, profesional. Cocok untuk high-value customers dengan standar pelayanan premium.",
    icon: Crown,
    tone: "Elite Formal",
    archetype: "Ruler",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    borderColor: "border-amber-400/30",
    hoverBorderColor: "hover:border-amber-400/60",
    hoverBgOverlay: "bg-amber-400/5",
  },
  {
    name: "Riri",
    subtitle: "Playful Energetic",
    description: "Cheerful, friendly, fun! Cocok untuk audience milenial yang suka interaksi santai dan seru.",
    icon: Smile,
    tone: "Cheerful Playful",
    archetype: "Jester",
    color: "text-pink-400",
    bgColor: "bg-pink-400/10",
    borderColor: "border-pink-400/30",
    hoverBorderColor: "hover:border-pink-400/60",
    hoverBgOverlay: "bg-pink-400/5",
  },
  {
    name: "Maya",
    subtitle: "Balanced Professional",
    description: "Profesional tapi tetap hangat. Keseimbangan antara efisiensi dan kehangatan.",
    icon: Briefcase,
    tone: "Gentle Supportive",
    archetype: "Sage",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    borderColor: "border-blue-400/30",
    hoverBorderColor: "hover:border-blue-400/60",
    hoverBgOverlay: "bg-blue-400/5",
  },
];

export function APBEPersonaList({ onBack, onCreateNew, onEdit, onLoadSample, onImport, searchQuery = "" }: APBEPersonaListProps) {
  const [versions, setVersions] = useState<APBEVersion[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("version");
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Filter versions based on search query
  const filteredVersions = versions.filter(version => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      version.persona_name.toLowerCase().includes(query) ||
      version.persona_json.A?.website_name?.toLowerCase().includes(query) ||
      version.persona_json.A?.group_name?.toLowerCase().includes(query)
    );
  });

  // Filter sample personas based on search query
  const filteredSampleCards = samplePersonaCards.filter(card => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      card.name.toLowerCase().includes(query) ||
      card.subtitle.toLowerCase().includes(query) ||
      card.description.toLowerCase().includes(query) ||
      card.archetype.toLowerCase().includes(query) ||
      card.tone.toLowerCase().includes(query)
    );
  });

  const loadVersions = () => {
    const data = getConfigVersions();
    setVersions(sortVersions(data, sortBy));
  };

  const sortVersions = (data: APBEVersion[], sort: SortOption): APBEVersion[] => {
    return [...data].sort((a, b) => {
      switch (sort) {
        case "version":
          return b.version - a.version;
        case "created_at":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "name":
          return a.persona_name.localeCompare(b.persona_name);
        default:
          return 0;
      }
    });
  };

  useEffect(() => {
    loadVersions();
  }, []);

  useEffect(() => {
    setVersions(prev => sortVersions(prev, sortBy));
  }, [sortBy]);

  const handleDelete = () => {
    if (!deleteId) return;
    
    const version = versions.find(v => v.id === deleteId);
    if (version?.is_active) {
      toast.error("Tidak dapat menghapus persona yang aktif");
      setDeleteId(null);
      return;
    }

    const success = deleteVersion(deleteId);
    if (success) {
      toast.success("Persona berhasil dihapus");
      loadVersions();
    } else {
      toast.error("Gagal menghapus persona");
    }
    setDeleteId(null);
  };

  const handleToggleActive = (versionId: string, currentlyActive: boolean) => {
    if (currentlyActive) {
      setDeactivateId(versionId);
    } else {
      const success = activateVersion(versionId);
      if (success) {
        toast.success("Persona berhasil diaktifkan");
        loadVersions();
      } else {
        toast.error("Gagal mengaktifkan persona");
      }
    }
  };

  const handleConfirmDeactivate = () => {
    if (!deactivateId) return;
    
    const success = deactivateVersion(deactivateId);
    if (success) {
      toast.success("Persona berhasil dinonaktifkan");
      loadVersions();
    } else {
      toast.error("Gagal menonaktifkan persona");
    }
    setDeactivateId(null);
  };

  const handleLoadSamplePersona = (personaName: string) => {
    const sample = SAMPLE_PERSONAS.find(p => p.name.toLowerCase().startsWith(personaName.toLowerCase()));
    if (sample && onLoadSample) {
      onLoadSample(sample.config, sample.name);
      toast.success(`Template "${sample.name}" berhasil dimuat ke draft`);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy, HH:mm", { locale: id });
    } catch {
      return dateString;
    }
  };

  const handleExport = (version: APBEVersion) => {
    if (version.persona_json) {
      exportAPBEConfig(
        version.persona_json,
        version.persona_name,
        version.version,
        version.created_by || "Admin"
      );
      toast.success(`Persona "${version.persona_name}" berhasil diexport`);
    }
  };

  const handleImport = (config: APBEConfig, meta: APBEExportMeta | null) => {
    if (onImport) {
      onImport(config, meta);
      toast.success(`Konfigurasi "${meta?.persona_name || 'Imported'}" berhasil diimport`);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="space-y-8">
      {/* Header Row - Back Button + Import Button */}
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>
        <Button
          variant="outline"
          onClick={() => setImportDialogOpen(true)}
          className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover gap-2"
        >
          <Upload className="h-4 w-4" />
          Upload Config
        </Button>
      </div>

      {/* Sample Personas Section */}
      <Card className="border-border bg-card">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-button-hover flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Choose a Starter Persona
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Pilih template persona untuk memulai, atau buat dari awal
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Sample Persona Cards */}
            {filteredSampleCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.name}
                  className={`relative p-8 rounded-xl border ${card.borderColor} ${card.bgColor} ${card.hoverBorderColor} transition-all cursor-pointer group`}
                  onClick={() => handleLoadSamplePersona(card.name)}
                >
                  <div className={`h-12 w-12 rounded-full ${card.bgColor} border ${card.borderColor} flex items-center justify-center mb-4`}>
                    <Icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                  <h3 className={`text-lg font-semibold ${card.color} mb-1`}>
                    {card.name}
                  </h3>
                  <p className="text-sm text-foreground font-medium mb-2">
                    {card.subtitle}
                  </p>
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                    {card.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={`text-xs ${card.color} border-current`}>
                      {card.archetype}
                    </Badge>
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {card.tone}
                    </Badge>
                  </div>
                  <div className={`absolute inset-0 rounded-xl ${card.hoverBgOverlay} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </div>
              );
            })}

            {/* Create From Scratch Card */}
            <div
              className="relative p-8 rounded-xl border border-dashed border-border hover:border-button-hover/50 bg-muted/20 hover:bg-muted/30 transition-all cursor-pointer group flex flex-col items-center justify-center text-center"
              onClick={onCreateNew}
            >
              <div className="h-12 w-12 rounded-full bg-muted border border-border flex items-center justify-center mb-4 group-hover:bg-button-hover/20 group-hover:border-button-hover/30 transition-colors">
                <Plus className="h-6 w-6 text-muted-foreground group-hover:text-button-hover transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-button-hover transition-colors">
                Create From Scratch
              </h3>
              <p className="text-xs text-muted-foreground">
                Mulai dengan konfigurasi kosong
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Published Personas Section */}
      <Card className="border-border bg-card">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-button-hover flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Published Personas
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Daftar semua persona yang sudah dipublish
              </p>
            </div>
            {versions.length > 0 && (
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="version">Version (Newest)</SelectItem>
                    <SelectItem value="created_at">Created At</SelectItem>
                    <SelectItem value="name">Name (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {filteredVersions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {searchQuery.trim() ? "Tidak ada hasil pencarian" : "Belum ada persona yang dipublish"}
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  {searchQuery.trim() 
                    ? `Tidak ditemukan persona dengan kata kunci "${searchQuery}"`
                    : "Pilih template di atas untuk memulai, atau buat persona dari awal"
                  }
                </p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-foreground font-semibold px-4 w-[14%]">Website</TableHead>
                      <TableHead className="text-foreground font-semibold px-4 w-[18%]">Nama Persona</TableHead>
                      <TableHead className="text-foreground font-semibold px-4 w-[10%]">Version</TableHead>
                      <TableHead className="text-foreground font-semibold px-4 w-[16%]">Created At</TableHead>
                      <TableHead className="text-foreground font-semibold px-4 w-[14%]">Updated By</TableHead>
                      <TableHead className="text-foreground font-semibold px-4 w-[14%] text-center">Status</TableHead>
                      <TableHead className="text-foreground font-semibold px-4 w-[14%] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVersions.map((version) => (
                      <TableRow key={version.id} className="hover:bg-muted/20">
                        <TableCell className="text-muted-foreground px-4 py-4">
                          {version.persona_json?.A?.website_name || "-"}
                        </TableCell>
                        <TableCell className="font-medium text-foreground px-4 py-4">
                          {version.persona_json?.agent?.name || version.persona_name}
                        </TableCell>
                        <TableCell className="px-4 py-4">
                          <Badge variant="outline">
                            V.{version.version}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground px-4 py-4">
                          {formatDate(version.created_at)}
                        </TableCell>
                        <TableCell className="text-muted-foreground px-4 py-4">
                          by {version.updated_by || version.created_by || "Admin"}
                        </TableCell>
                        <TableCell className="text-center px-4 py-4">
                          <div className="flex items-center justify-center gap-3">
                            <Switch
                              checked={version.is_active}
                              onCheckedChange={() => handleToggleActive(version.id, version.is_active)}
                            />
                            {version.is_active ? (
                              <Badge className="bg-success/20 text-success border border-success/30">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-muted text-muted-foreground border border-border">
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-4 py-4">
                          <TooltipProvider>
                            <div className="flex items-center justify-end gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 hover:bg-button-hover/20 hover:text-button-hover"
                                    onClick={() => onEdit(version)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit Persona</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 hover:bg-success/20 hover:text-success"
                                    onClick={() => handleExport(version)}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Export Persona</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 hover:bg-destructive/20 hover:text-destructive"
                                    onClick={() => setDeleteId(version.id)}
                                    disabled={version.is_active}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{version.is_active ? "Tidak bisa hapus persona aktif" : "Hapus Persona"}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Persona?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Persona akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border border-border text-foreground hover:bg-[#D4A017] hover:text-black hover:border-[#D4A017] transition font-medium">
              Batal
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="bg-red-600 text-white hover:!bg-[#FFD700] hover:!text-black transition font-semibold"
            >
              Hapus
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={!!deactivateId} onOpenChange={() => setDeactivateId(null)}>
        <AlertDialogContent className="bg-card border-border rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan Persona?</AlertDialogTitle>
            <AlertDialogDescription>
              Persona yang dinonaktifkan tidak akan digunakan oleh sistem AI. 
              Anda dapat mengaktifkannya kembali kapan saja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeactivate}
              className="bg-button-hover text-button-hover-foreground hover:bg-button-hover/90"
            >
              Nonaktifkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        {/* Import Dialog */}
        <APBEImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImport={handleImport}
        />
      </div>
    </div>
  );
}
