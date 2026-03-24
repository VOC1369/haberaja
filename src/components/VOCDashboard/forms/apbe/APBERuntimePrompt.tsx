/**
 * APBE v1.2 Runtime Prompt Compiler & Preview
 */

import { useState, useMemo } from "react";
import { APBEConfig } from "@/types/apbe-config";
import { compileRuntimePrompt, downloadPrompt } from "@/lib/apbe-prompt-template";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/notify";
import { Copy, Download, Check, ArrowLeft, Sparkles } from "lucide-react";

interface ValidationIssue {
  type: "error" | "warning";
  category: string;
  message: string;
  location?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

// Validate runtime prompt for issues - V3.0: Only structural validation
function validateRuntimePrompt(prompt: string, _config: APBEConfig): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // 1. Check for unreplaced placeholders
  const placeholderRegex = /\{\{[^}]+\}\}/g;
  const unreplacedPlaceholders = prompt.match(placeholderRegex);
  if (unreplacedPlaceholders) {
    const uniquePlaceholders = [...new Set(unreplacedPlaceholders)];
    uniquePlaceholders.forEach(placeholder => {
      errors.push({
        type: "error",
        category: "Placeholder",
        message: `Placeholder ${placeholder} tidak ter-replace`,
        location: "Runtime Prompt"
      });
    });
  }

  // 2. Check for potential template syntax errors
  const brokenTemplatePatterns = [
    { pattern: /\{\{[^}]*$/gm, message: "Template bracket tidak tertutup" },
  ];

  brokenTemplatePatterns.forEach(({ pattern, message }) => {
    if (pattern.test(prompt)) {
      errors.push({
        type: "error",
        category: "Syntax",
        message,
        location: "Runtime Prompt"
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

interface APBERuntimePromptProps {
  config: APBEConfig;
  onClose: () => void;
}

export function APBERuntimePrompt({ config, onClose }: APBERuntimePromptProps) {
  const [copied, setCopied] = useState(false);

  const runtimePrompt = compileRuntimePrompt(config);
  
  // Validate prompt
  const validation = useMemo(() => validateRuntimePrompt(runtimePrompt, config), [runtimePrompt, config]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(runtimePrompt);
      setCopied(true);
      toast.success("Prompt berhasil disalin ke clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Gagal menyalin prompt");
    }
  };

  const handleDownload = () => {
    downloadPrompt(runtimePrompt, `apbe-runtime-prompt-${new Date().toISOString().split("T")[0]}.txt`);
    toast.success("Prompt berhasil didownload!");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden page-wrapper px-6 py-6">
      {/* HEADER - flex-shrink-0, tidak scroll */}
      <div className="flex-shrink-0 pb-4">
        <Button 
          variant="outline" 
          onClick={onClose}
          className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
      </div>

      {/* OUTER CARD - flex-1 min-h-0, NO SCROLL */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-xl bg-card border border-border">
        {/* Title section - inside card */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="icon-circle">
              <Sparkles className="h-5 w-5 icon-circle-icon" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground">Runtime Prompt</h2>
                <Badge className="bg-button-hover/20 text-button-hover border-button-hover/30">
                  LLM-Ready
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Prompt yang sudah diinjeksi dengan nilai dari konfigurasi Anda
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCopy} className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
              {copied ? (
                <><Check className="h-4 w-4 mr-2 text-green-500" /> Copied!</>
              ) : (
                <><Copy className="h-4 w-4 mr-2" /> Copy</>
              )}
            </Button>
            <Button variant="outline" onClick={handleDownload} className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
              <Download className="h-4 w-4 mr-2" /> Download .txt
            </Button>
          </div>
        </div>
        
        {/* Important Notice */}
        <div className="flex-shrink-0 mx-6 mt-6 p-4 bg-button-hover/10 border border-button-hover/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-button-hover mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-button-hover">Prompt ini tidak dapat diedit manual</p>
              <p className="text-sm text-muted-foreground mt-1">
                Jika ingin mengubah isi prompt, silakan edit form input di section yang relevan.
              </p>
            </div>
          </div>
        </div>
        
        {/* INNER CONTENT - HANYA INI YANG SCROLL */}
        <div className="flex-1 min-h-0 overflow-auto rounded-xl bg-[#1E1E1E] m-6">
          <pre className="font-mono text-[12px] leading-[1.6] text-foreground whitespace-pre-wrap break-words p-6">
            {runtimePrompt}
          </pre>
        </div>
      </div>
    </div>
  );
}