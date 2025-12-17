import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Check, X, Trash2, Pencil } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectWithAddNewProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  onAddOption?: (option: SelectOption) => void;
  onDeleteOption?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SelectWithAddNew({
  value,
  onValueChange,
  options,
  onAddOption,
  onDeleteOption,
  placeholder = "Pilih opsi",
  className = "",
  disabled = false,
}: SelectWithAddNewProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newOptionValue, setNewOptionValue] = useState("");

  const handleAddNewOption = () => {
    if (newOptionValue.trim()) {
      const newValue = newOptionValue.toLowerCase().replace(/\s+/g, '_');
      const newOption = { value: newValue, label: newOptionValue.trim() };
      onAddOption?.(newOption);
      setNewOptionValue("");
      setShowAddInput(false);
    }
  };

  const handleCancelAddNew = () => {
    setNewOptionValue("");
    setShowAddInput(false);
  };

  const handleDeleteOption = (optionValue: string) => {
    onDeleteOption?.(optionValue);
    if (value === optionValue) {
      onValueChange("");
    }
  };

  const handleCloseDialog = () => {
    setIsEditDialogOpen(false);
    setShowAddInput(false);
    setNewOptionValue("");
  };

  return (
    <>
      <Select
        value={value}
        onValueChange={(val) => {
          if (val === '__edit_mode__') {
            setIsEditDialogOpen(true);
          } else {
            onValueChange(val);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger className={className} disabled={disabled}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
          <SelectItem value="__edit_mode__" className="text-button-hover border-t border-border mt-1 pt-2">
            <span className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit Opsi
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Opsi</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Kelola opsi dropdown dengan menambah atau menghapus item.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {options.map((option) => (
              <div
                key={option.value}
                className="flex items-center justify-between py-2 px-3 rounded-full bg-muted hover:bg-button-hover group transition-colors"
              >
                <span className="text-sm text-foreground group-hover:text-button-hover-foreground">{option.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteOption(option.value);
                  }}
                  className="h-8 w-8 rounded-full bg-transparent hover:bg-declined/20 opacity-60 group-hover:opacity-100 group-hover:text-button-hover-foreground transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-button-hover-foreground hover:text-declined" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add new option and Done button */}
          <div className="pt-3 border-t border-border space-y-3">
            {showAddInput ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newOptionValue}
                  onChange={(e) => setNewOptionValue(e.target.value)}
                  placeholder="Masukkan opsi baru..."
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddNewOption();
                    if (e.key === 'Escape') handleCancelAddNew();
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={handleAddNewOption}
                  className="h-9 w-9 rounded-full bg-button-hover hover:bg-button-hover/90"
                >
                  <Check className="h-4 w-4 text-button-hover-foreground" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={handleCancelAddNew}
                  className="h-9 w-9 rounded-full bg-muted hover:bg-card"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddInput(true)}
                className="flex items-center gap-2 w-full py-2 px-3 text-sm text-button-hover hover:bg-muted rounded-full transition-colors"
              >
                <Plus className="h-4 w-4" />
                Tambah Opsi Baru
              </button>
            )}

            {/* Done button - aligned with add button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseDialog}
              className="w-full rounded-full border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
            >
              <Check className="h-4 w-4 mr-2" />
              Selesai
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
