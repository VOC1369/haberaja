import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Circle, Clock } from "lucide-react";

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  timestamp?: string;
  checkedBy?: string;
}

export interface ExecutionChecklistData {
  items: ChecklistItem[];
}

interface ExecutionChecklistProps {
  data: ExecutionChecklistData;
  onChange: (updates: Partial<ExecutionChecklistData>) => void;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "promo_detail", label: "Promo detail final", checked: false },
  { id: "creative_approved", label: "Creative approved", checked: false },
  { id: "community_copy", label: "Community copy ready", checked: false },
  { id: "cs_briefed", label: "CS briefed", checked: false },
  { id: "event_live", label: "Event live", checked: false },
  { id: "event_closed", label: "Event closed", checked: false },
];

export function ExecutionChecklist({ data, onChange }: ExecutionChecklistProps) {
  const items = data.items?.length ? data.items : DEFAULT_CHECKLIST;
  
  const checkedCount = items.filter((item) => item.checked).length;
  const progress = (checkedCount / items.length) * 100;

  const handleToggle = (itemId: string) => {
    const updatedItems = items.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          checked: !item.checked,
          timestamp: !item.checked ? new Date().toLocaleString("id-ID") : undefined,
        };
      }
      return item;
    });
    onChange({ items: updatedItems });
  };

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress Eksekusi</span>
          <span className="font-medium text-foreground">
            {checkedCount} / {items.length} selesai
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Checklist Items */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
              item.checked
                ? "bg-success/5 border-success/20"
                : "bg-card border-border"
            }`}
          >
            {/* Step Number / Icon */}
            <div className="flex-shrink-0">
              {item.checked ? (
                <CheckCircle className="h-6 w-6 text-success" />
              ) : (
                <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-3">
                <Checkbox
                  id={item.id}
                  checked={item.checked}
                  onCheckedChange={() => handleToggle(item.id)}
                />
                <Label
                  htmlFor={item.id}
                  className={`text-sm cursor-pointer ${
                    item.checked
                      ? "text-success line-through"
                      : "text-foreground"
                  }`}
                >
                  {item.label}
                </Label>
              </div>

              {/* Timestamp */}
              {item.checked && item.timestamp && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground ml-7">
                  <Clock className="h-3 w-3" />
                  <span>Diselesaikan: {item.timestamp}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Completion Status */}
      {checkedCount === items.length && (
        <div className="flex items-center gap-2 p-4 bg-success/10 border border-success/20 rounded-lg">
          <CheckCircle className="h-5 w-5 text-success" />
          <span className="text-sm text-success font-medium">
            Semua checklist selesai! Event siap dijalankan.
          </span>
        </div>
      )}
    </div>
  );
}
