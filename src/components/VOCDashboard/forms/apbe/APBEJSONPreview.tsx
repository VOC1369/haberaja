/**
 * APBE v1.2 JSON Preview Panel
 */

import { useState } from "react";
import { APBEConfig } from "@/types/apbe-config";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Download, Check, ArrowLeft } from "lucide-react";
interface APBEJSONPreviewProps {
  config: APBEConfig;
  onClose: () => void;
}
export function APBEJSONPreview({
  config,
  onClose
}: APBEJSONPreviewProps) {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(config, null, 2);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      toast.success("JSON berhasil disalin ke clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Gagal menyalin JSON");
    }
  };
  const handleDownload = () => {
    const blob = new Blob([jsonString], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apbe-config-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("JSON berhasil didownload!");
  };
  return <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden page-wrapper px-6 py-6">
      {/* HEADER - flex-shrink-0, tidak scroll */}
      <div className="flex-shrink-0 pb-4">
        <Button variant="outline" onClick={onClose} className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
      </div>

      {/* OUTER CARD - flex-1 min-h-0, NO SCROLL */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-xl bg-card border border-border">
        {/* Title section - inside card */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="icon-circle">
              <Copy className="h-5 w-5 icon-circle-icon" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">APBE JSON Config</h2>
              <p className="text-xs text-[#828284]">
                JSON konfigurasi lengkap untuk backend dan AI runtime
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCopy} className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
              {copied ? <><Check className="h-4 w-4 mr-2 text-green-500" /> Copied!</> : <><Copy className="h-4 w-4 mr-2" /> Copy JSON</>}
            </Button>
            <Button variant="outline" onClick={handleDownload} className="h-11 px-6 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
              <Download className="h-4 w-4 mr-2" /> Download JSON
            </Button>
          </div>
        </div>
        
        {/* INNER CODE BLOCK - HANYA INI YANG SCROLL */}
        <div className="flex-1 min-h-0 overflow-auto rounded-xl bg-[#1E1E1E] m-6">
          <pre className="font-mono text-[12px] leading-[1.6] text-foreground whitespace-pre-wrap break-words p-6">
            {jsonString}
          </pre>
        </div>
      </div>
    </div>;
}