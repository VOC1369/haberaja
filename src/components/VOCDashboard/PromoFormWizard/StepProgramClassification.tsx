import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProgramType = "reward" | "event" | "policy" | null;

interface StepProgramClassificationProps {
  selectedProgram: ProgramType;
  onSelect: (program: ProgramType) => void;
}

interface ProgramCard {
  id: ProgramType;
  badgeText: string;
  badgeVariant: "success" | "warning" | "outline" | "secondary";
  title: string;
  subtitle: string;
  description: string;
  examples: string[];
  characteristics: string[];
  ctaText: string;
}

const PROGRAM_CARDS: ProgramCard[] = [
  {
    id: "reward",
    badgeText: "⚡ Bonus Instan",
    badgeVariant: "warning",
    title: "Reward Programs",
    subtitle: "(Deterministic)",
    description: "Program dengan perhitungan jelas dan bisa dihitung secara pasti.",
    examples: [
      "Welcome Bonus",
      "Cashback / Rollingan",
      "Referral %",
      "Level Up Reward",
    ],
    characteristics: [
      "Ada rumus",
      "Bisa dihitung",
      "Bisa dijelaskan AI secara pasti",
    ],
    ctaText: "Gunakan Bonus Instan",
  },
  {
    id: "event",
    badgeText: "🏆 Event/Kompetisi",
    badgeVariant: "secondary",
    title: "Event Programs",
    subtitle: "(Non-Deterministic)",
    description: "Program berbasis event atau keberuntungan, hadiah tidak bisa dipastikan.",
    examples: [
      "Lucky Box",
      "Pohon Hadiah",
      "Lucky Draw",
      "Grand Prize Event",
    ],
    characteristics: [
      "Hadiah acak / undian",
      "Klaim manual / via CS",
      "Tidak bisa dihitung dengan rumus",
    ],
    ctaText: "Gunakan Event Program",
  },
  {
    id: "policy",
    badgeText: "🧠 Program Sistem",
    badgeVariant: "outline",
    title: "Policy Programs",
    subtitle: "(Policy / Rules)",
    description: "Bukan bonus. Mengatur cara bermain, deposit, atau perhitungan game.",
    examples: [
      "Deposit Pulsa Tanpa Potongan",
      "Diskon Togel",
      "Max Bet / Restriction Rule",
    ],
    characteristics: [
      "Tidak ada reward",
      "Tidak ada klaim bonus",
      "Murni aturan sistem",
    ],
    ctaText: "Gunakan Policy Program",
  },
];

export function StepProgramClassification({
  selectedProgram,
  onSelect,
}: StepProgramClassificationProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Pilih Jenis Program
        </h2>
        <p className="text-sm text-muted-foreground">
          Jenis program menentukan cara sistem membaca promo dan form apa yang akan kamu isi selanjutnya.
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PROGRAM_CARDS.map((card) => {
          const isSelected = selectedProgram === card.id;

          return (
            <div
              key={card.id}
              onClick={() => onSelect(card.id)}
              className={cn(
                "flex flex-col p-6 rounded-xl border-2 cursor-pointer transition-all",
                isSelected
                  ? "border-button-hover bg-button-hover/5"
                  : "border-border hover:border-button-hover/50"
              )}
            >
              {/* Badge */}
              <div className="mb-4">
                <Badge 
                  size="sm"
                  className={
                    card.id === "reward" 
                      ? "bg-warning/20 text-warning border border-warning/30" 
                      : card.id === "event"
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                  }
                >
                  {card.badgeText}
                </Badge>
              </div>

              {/* Title & Subtitle */}
              <h3 className="text-lg font-semibold text-foreground">
                {card.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {card.subtitle}
              </p>

              {/* Description */}
              <p className="text-sm text-foreground mb-4">
                {card.description}
              </p>

              {/* Examples */}
              <div className="mb-4">
                <ul className="text-sm text-muted-foreground space-y-1">
                  {card.examples.map((example, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                      {example}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Characteristics */}
              <div className="flex-1 mb-4">
                <ul className="text-sm space-y-2">
                  {card.characteristics.map((char, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-foreground">
                      <Check className="h-4 w-4 text-button-hover flex-shrink-0" />
                      {char}
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA Button */}
              <Button
                variant={isSelected ? "golden" : "outline"}
                className="w-full mt-auto rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(card.id);
                }}
              >
                {card.ctaText}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { ProgramType };
