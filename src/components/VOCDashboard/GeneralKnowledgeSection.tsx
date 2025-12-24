import { useState, useEffect } from "react";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Upload, FileText, Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  GeneralKnowledgeItem,
  getGeneralKnowledge,
  addGeneralKnowledge,
  updateGeneralKnowledge,
  deleteGeneralKnowledge,
  generalCategories,
  generalKnowledgeTypes,
} from "@/types/knowledge";

interface GeneralKnowledgeSectionProps {
  onBack?: () => void;
}

export function GeneralKnowledgeSection({ onBack }: GeneralKnowledgeSectionProps) {
  const [items, setItems] = useState<GeneralKnowledgeItem[]>([]);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GeneralKnowledgeItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Form state
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("");
  const [knowledgeType, setKnowledgeType] = useState("");

  useEffect(() => {
    setItems(getGeneralKnowledge());
  }, []);

  const resetForm = () => {
    setQuestion("");
    setAnswer("");
    setCategory("");
    setKnowledgeType("");
    setEditingItem(null);
  };

  const handleOpenFormDialog = (item?: GeneralKnowledgeItem) => {
    if (item) {
      setEditingItem(item);
      setQuestion(item.question);
      setAnswer(item.answer);
      setCategory(item.category);
      setKnowledgeType(item.knowledgeType);
    } else {
      resetForm();
    }
    setIsFormDialogOpen(true);
  };

  const handleSave = () => {
    if (!question.trim() || !answer.trim() || !category || !knowledgeType) {
      toast.error("Semua field wajib diisi");
      return;
    }

    if (editingItem) {
      updateGeneralKnowledge(editingItem.id, { question, answer, category, knowledgeType });
      toast.success("Knowledge berhasil diupdate");
    } else {
      addGeneralKnowledge({ question, answer, category, knowledgeType });
      toast.success("Knowledge berhasil ditambahkan");
    }
    
    setItems(getGeneralKnowledge());
    setIsFormDialogOpen(false);
    resetForm();
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteGeneralKnowledge(deleteId);
      setItems(getGeneralKnowledge());
      toast.success("Knowledge berhasil dihapus");
      setDeleteId(null);
    }
  };

  // formatDate now imported from @/lib/utils

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
            onClick={() => setIsUploadDialogOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
          </Button>
          <Button 
            variant="outline"
            className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
            onClick={() => handleOpenFormDialog()}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New General Entry
          </Button>
        </div>
      </div>

      {/* Title */}
      <div>
        <h2 className="text-lg font-semibold text-button-hover">General Knowledge Base</h2>
        <p className="text-sm text-muted-foreground">
          Kelola informasi umum untuk AI assistant
        </p>
      </div>

      {/* Content Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-button-hover/20 flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-button-hover" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Belum ada data general knowledge
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Mulai tambahkan informasi umum untuk AI assistant
            </p>
            <Button 
              variant="outline"
              className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
              onClick={() => handleOpenFormDialog()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Knowledge Pertama
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-[35%] text-foreground font-semibold">Question</TableHead>
                <TableHead className="text-foreground font-semibold">Category</TableHead>
                <TableHead className="text-foreground font-semibold">Knowledge Type</TableHead>
                <TableHead className="text-foreground font-semibold">Last Updated</TableHead>
                <TableHead className="text-right text-foreground font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="hover:bg-card">
                  <TableCell className="py-4">
                    <div className="text-sm font-medium text-foreground truncate max-w-[280px]">{item.question}</div>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge variant="outline" className="text-xs">{item.category}</Badge>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge variant="secondary" className="text-xs">{item.knowledgeType}</Badge>
                  </TableCell>
                  <TableCell className="py-4 text-sm text-muted-foreground">
                    {formatDate(item.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 hover:bg-button-hover/20 hover:text-button-hover"
                        onClick={() => handleOpenFormDialog(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 hover:bg-destructive/20 hover:text-destructive"
                        onClick={() => setDeleteId(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-button-hover text-base">
              {editingItem ? "Edit Knowledge" : "Add New General Entry"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">Question / Topic <span className="text-destructive">*</span></Label>
              <Input 
                placeholder="Masukkan pertanyaan atau topik..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="mt-1.5 text-sm"
              />
            </div>
            <div>
              <Label className="text-sm">Answer / Content <span className="text-destructive">*</span></Label>
              <Textarea 
                placeholder="Masukkan jawaban atau konten..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="mt-1.5 min-h-[80px] text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Category <span className="text-destructive">*</span></Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1.5 text-sm">
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {generalCategories.map(cat => (
                      <SelectItem key={cat} value={cat} className="text-sm">{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Knowledge Type <span className="text-destructive">*</span></Label>
                <Select value={knowledgeType} onValueChange={setKnowledgeType}>
                  <SelectTrigger className="mt-1.5 text-sm">
                    <SelectValue placeholder="Pilih tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {generalKnowledgeTypes.map(type => (
                      <SelectItem key={type} value={type} className="text-sm">{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsFormDialogOpen(false)} className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
              Batal
            </Button>
            <Button 
              variant="outline"
              size="sm"
              className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
              onClick={handleSave}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload CSV Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-button-hover text-base">Upload CSV</DialogTitle>
          </DialogHeader>
          <div className="py-2">
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
            <div className="mt-4">
              <Button variant="outline" size="sm" className="w-full border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
                <FileText className="h-4 w-4 mr-2" />
                Download Template (CSV)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Hapus Knowledge?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Apakah Anda yakin ingin menghapus knowledge ini? Tindakan ini tidak dapat dibatalkan.
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
      </div>
    </div>
  );
}
