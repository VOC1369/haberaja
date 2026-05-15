/**
 * APBE Import Dialog Component
 * Handles file upload, validation, and preview for importing APBE configurations
 */

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileJson, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  X,
  FileText
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { APBEConfig } from "@/types/apbe-config";
import {
  validateImportedConfig,
  readFileAsJSON,
  ImportValidationResult,
  APBEExportMeta,
} from "@/lib/apbe-export-import";

interface APBEImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (config: APBEConfig, meta: APBEExportMeta | null) => void;
}

export function APBEImportDialog({ open, onOpenChange, onImport }: APBEImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsLoading(true);

    try {
      const json = await readFileAsJSON(selectedFile);
      const result = validateImportedConfig(json);
      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        isValid: false,
        errors: [error instanceof Error ? error.message : "Gagal memproses file"],
        warnings: [],
        config: null,
        meta: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleImport = () => {
    if (validationResult?.isValid && validationResult.config) {
      onImport(validationResult.config, validationResult.meta);
      handleClose();
    }
  };

  const handleClose = () => {
    setFile(null);
    setValidationResult(null);
    setIsLoading(false);
    onOpenChange(false);
  };

  // formatDate now imported from @/lib/utils

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Upload className="h-5 w-5 text-button-hover" />
            Import Konfigurasi APBE
          </DialogTitle>
          <DialogDescription>
            Upload file JSON untuk mengimport konfigurasi persona
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Drop Zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
              dragActive
                ? "border-button-hover bg-button-hover/10"
                : "border-border hover:border-button-hover/50",
              file && "border-success/50 bg-success/5"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleInputChange}
            />

            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center">
                  <FileJson className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setValidationResult(null);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Ganti File
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Drag & drop file JSON di sini
                  </p>
                  <p className="text-sm text-muted-foreground">
                    atau klik untuk pilih file
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-4">
              <div className="animate-spin h-8 w-8 border-2 border-button-hover border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Memvalidasi file...</p>
            </div>
          )}

          {/* Validation Result */}
          {validationResult && !isLoading && (
            <div className="space-y-4">
              {/* Meta Preview */}
              {validationResult.meta && (
                <div className="bg-muted rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-button-hover" />
                    <span className="font-medium text-foreground">Preview Konfigurasi</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Persona</p>
                      <p className="font-medium text-foreground">
                        {validationResult.meta.persona_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Version</p>
                      <p className="font-medium text-foreground">
                        v{validationResult.meta.persona_version}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Exported</p>
                      <p className="font-medium text-foreground">
                        {formatDate(validationResult.meta.export_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">By</p>
                      <p className="font-medium text-foreground">
                        {validationResult.meta.exported_by}
                      </p>
                    </div>
                  </div>
                  
                  {/* Block Status */}
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Blocks:</p>
                    <div className="flex flex-wrap gap-2">
                      {["A", "agent", "C", "L", "O", "B", "V"].map((block) => (
                        <Badge
                          key={block}
                          variant="outline"
                          className={cn(
                            validationResult.config
                              ? "bg-success/10 text-success border-success/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          )}
                        >
                          {validationResult.config ? "✓" : "✗"} {block}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Validation Status */}
              <div
                className={cn(
                  "rounded-lg p-4",
                  validationResult.isValid
                    ? validationResult.warnings.length > 0
                      ? "bg-yellow-500/10 border border-yellow-500/30"
                      : "bg-success/10 border border-success/30"
                    : "bg-destructive/10 border border-destructive/30"
                )}
              >
                <div className="flex items-start gap-3">
                  {validationResult.isValid ? (
                    validationResult.warnings.length > 0 ? (
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                    )
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p
                      className={cn(
                        "font-medium",
                        validationResult.isValid
                          ? validationResult.warnings.length > 0
                            ? "text-yellow-500"
                            : "text-success"
                          : "text-destructive"
                      )}
                    >
                      {validationResult.isValid
                        ? validationResult.warnings.length > 0
                          ? `✓ Valid dengan ${validationResult.warnings.length} peringatan`
                          : "✓ Validasi Berhasil"
                        : `✗ ${validationResult.errors.length} Error Ditemukan`}
                    </p>

                    {/* Errors */}
                    {validationResult.errors.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {validationResult.errors.map((error, idx) => (
                          <li key={idx} className="text-sm text-destructive">
                            • {error}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Warnings */}
                    {validationResult.warnings.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {validationResult.warnings.map((warning, idx) => (
                          <li key={idx} className="text-sm text-yellow-500">
                            ⚠ {warning}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-border text-foreground hover:bg-muted"
          >
            Batal
          </Button>
          <Button
            onClick={handleImport}
            disabled={!validationResult?.isValid || isLoading}
            className="bg-button-hover text-button-hover-foreground hover:bg-button-hover/90"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Config
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
