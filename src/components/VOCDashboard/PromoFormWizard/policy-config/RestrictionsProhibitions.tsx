import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { RestrictionsData } from "./types";

interface RestrictionsProhibitionsProps {
  data: RestrictionsData;
  onChange: (updates: Partial<RestrictionsData>) => void;
}

export function RestrictionsProhibitions({ data, onChange }: RestrictionsProhibitionsProps) {
  const [newProhibition, setNewProhibition] = useState("");

  const addProhibition = () => {
    if (!newProhibition.trim()) return;
    onChange({ prohibitions: [...data.prohibitions, newProhibition.trim()] });
    setNewProhibition("");
  };

  const removeProhibition = (index: number) => {
    onChange({ prohibitions: data.prohibitions.filter((_, i) => i !== index) });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addProhibition();
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <Label>Daftar Larangan</Label>

      {/* List of prohibitions */}
      <div className="space-y-2">
        {data.prohibitions.map((prohibition, index) => (
          <div
            key={index}
            className="flex items-center gap-2 p-3 bg-muted/30 border border-border rounded-lg"
          >
            <span className="text-muted-foreground text-sm w-6">{index + 1}.</span>
            <span className="flex-1 text-sm">{prohibition}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => removeProhibition(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add new prohibition */}
      <div className="flex gap-2">
        <Input
          value={newProhibition}
          onChange={(e) => setNewProhibition(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tambah larangan baru..."
          className="flex-1"
        />
        <Button variant="outline" onClick={addProhibition}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Larangan
        </Button>
      </div>
    </div>
  );
}
