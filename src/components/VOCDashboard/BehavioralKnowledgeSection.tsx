import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil, Trash2, Brain } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BehavioralWizard } from "./BehavioralWizard";
import { BehavioralRuleItem, getBehavioralRules, deleteBehavioralRule } from "./BehavioralWizard/types";
import { toast } from "sonner";

interface BehavioralKnowledgeSectionProps {
  onBack?: () => void;
  forceResetKey?: number;
}

export function BehavioralKnowledgeSection({ onBack, forceResetKey }: BehavioralKnowledgeSectionProps) {
  const [items, setItems] = useState<BehavioralRuleItem[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "wizard">("list");
  const [editingItem, setEditingItem] = useState<BehavioralRuleItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  // Reset viewMode to list when forceResetKey changes (sidebar navigation)
  useEffect(() => {
    if (forceResetKey !== undefined) {
      setViewMode("list");
      setEditingItem(null);
    }
  }, [forceResetKey]);

  const loadItems = () => {
    setItems(getBehavioralRules());
  };

  const handleOpenWizard = (item?: BehavioralRuleItem) => {
    setEditingItem(item || null);
    setViewMode("wizard");
  };

  const handleCloseWizard = () => {
    setEditingItem(null);
    setViewMode("list");
    loadItems();
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteBehavioralRule(deleteId);
      loadItems();
      toast.success("Aturan berhasil dihapus");
      setDeleteId(null);
    }
  };

  const getSeverityBadge = (level: number) => {
    if (level >= 5) return <Badge className="bg-declined/20 text-declined border-declined/50">Crisis</Badge>;
    if (level >= 4) return <Badge className="bg-warning/20 text-warning border-warning/50">High</Badge>;
    if (level >= 3) return <Badge className="bg-button-hover/20 text-button-hover border-button-hover/50">Medium</Badge>;
    return <Badge className="bg-success/20 text-success border-success/50">Low</Badge>;
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") return <Badge className="bg-success/20 text-success border-success/50">Active</Badge>;
    if (status === "draft") return <Badge className="bg-muted text-muted-foreground border-border">Draft</Badge>;
    return <Badge className="bg-declined/20 text-declined border-declined/50">Expired</Badge>;
  };

  const getHandoffBadge = (handoff: BehavioralRuleItem["handoff_protocol"]) => {
    if (handoff.required) {
      return <Badge className="bg-declined/20 text-declined border-declined/50">🔴 Handoff</Badge>;
    }
    if (handoff.tag_alert === "FIRM_RESPONSE") {
      return <Badge className="bg-warning/20 text-warning border-warning/50">🟠 Firm</Badge>;
    }
    return <Badge className="bg-success/20 text-success border-success/50">💚 Soft</Badge>;
  };

  // Wizard View
  if (viewMode === "wizard") {
    return <BehavioralWizard onBack={handleCloseWizard} editingItem={editingItem} />;
  }

  // List View
  return (
    <div className="page-wrapper">
      <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Kembali
        </Button>
        <Button
          variant="outline"
          className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
          onClick={() => handleOpenWizard()}
        >
          <Plus className="h-4 w-4 mr-2" />
          Buat Aturan Baru
        </Button>
      </div>

      {/* Title */}
      <div>
        <h2 className="text-lg font-semibold text-button-hover">Behavioral Knowledge Base</h2>
        <p className="text-sm text-muted-foreground">
          B-KB V5.0 — Kelola aturan perilaku AI dengan Wizard
        </p>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-button-hover/20 flex items-center justify-center mb-4">
              <Brain className="h-8 w-8 text-button-hover" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Belum ada aturan behavioral
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Gunakan Wizard untuk membuat aturan dengan mudah
            </p>
            <Button
              variant="outline"
              className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
              onClick={() => handleOpenWizard()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Buat Aturan Pertama
            </Button>
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="text-foreground font-semibold">Nama Aturan</TableHead>
                <TableHead className="text-foreground font-semibold">System ID</TableHead>
                <TableHead className="text-foreground font-semibold">Mode Respons</TableHead>
                <TableHead className="text-foreground font-semibold">Reaksi</TableHead>
                <TableHead className="text-foreground font-semibold">Severity</TableHead>
                <TableHead className="text-foreground font-semibold">Status</TableHead>
                <TableHead className="text-foreground font-semibold text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="hover:bg-card">
                  <TableCell className="py-4">
                    <div className="text-sm font-medium text-foreground">{item.display_name || item.rule_name}</div>
                    <div className="text-xs text-muted-foreground">{item.behavior_category}</div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="text-xs text-muted-foreground font-mono">{item.rule_name}</div>
                    <div className="text-xs text-muted-foreground">v{item.version}</div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="text-sm text-foreground">{item.mode_respons}</div>
                  </TableCell>
                  <TableCell className="py-4">{getHandoffBadge(item.handoff_protocol)}</TableCell>
                  <TableCell className="py-4">{getSeverityBadge(item.severity_level)}</TableCell>
                  <TableCell className="py-4">{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenWizard(item)}
                        className="h-10 w-10 rounded-full hover:bg-button-hover/20 hover:text-button-hover"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(item.id)}
                        className="h-10 w-10 rounded-full hover:bg-destructive/20 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-foreground">Hapus Aturan?</AlertDialogTitle>
            <AlertDialogDescription>
              Aturan ini akan dihapus secara permanen dan tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
