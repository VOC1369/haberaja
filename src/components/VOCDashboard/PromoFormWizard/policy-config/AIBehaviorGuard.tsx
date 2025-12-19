import { Lock, Check, X } from "lucide-react";

export function AIBehaviorGuard() {
  const allowedBehaviors = [
    "AI akan menjelaskan aturan dan syarat",
    "AI akan menjelaskan konsekuensi pelanggaran",
    "AI akan mengarahkan ke CS untuk konfirmasi",
  ];

  const blockedBehaviors = [
    'AI TIDAK akan menyebut ini sebagai "bonus"',
    "AI TIDAK akan menghitung reward",
    "AI TIDAK akan menjanjikan hadiah",
  ];

  return (
    <div className="pt-4">
      {/* Locked header */}
      <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 border border-border rounded-lg">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          Pengaturan AI untuk Policy Program
        </span>
      </div>

      {/* Behavior list */}
      <div className="space-y-2">
        {/* Allowed behaviors */}
        {allowedBehaviors.map((behavior, index) => (
          <div
            key={`allowed-${index}`}
            className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
          >
            <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Check className="h-3 w-3 text-emerald-500" />
            </div>
            <span className="text-sm text-foreground">{behavior}</span>
          </div>
        ))}

        {/* Blocked behaviors */}
        {blockedBehaviors.map((behavior, index) => (
          <div
            key={`blocked-${index}`}
            className="flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
          >
            <div className="h-5 w-5 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
              <X className="h-3 w-3 text-destructive" />
            </div>
            <span className="text-sm text-foreground">{behavior}</span>
          </div>
        ))}
      </div>

      {/* Read-only notice */}
      <p className="text-xs text-muted-foreground mt-4 italic">
        * Pengaturan ini tidak dapat diubah untuk memastikan AI tidak salah mengklasifikasikan policy sebagai bonus.
      </p>
    </div>
  );
}
