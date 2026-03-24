import { useState, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, ChevronUp, ChevronDown, Sparkles, Save } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  PromoFormData,
  PROMO_TYPES,
  INTENT_CATEGORIES,
  TARGET_SEGMENTS,
  TRIGGER_EVENTS,
} from "./types";
import { SelectWithAddNew, SelectOption } from "./SelectWithAddNew";
import { applyPromoTypeDefaults } from "@/lib/promo-type-defaults";
import { toast } from "@/lib/notify";

interface Step1Props {
  data: PromoFormData;
  onChange: (data: Partial<PromoFormData>) => void;
  isEditingFromReview?: boolean;
  onSaveAndReturn?: () => void;
}

export function Step1Identity({ data, onChange, isEditingFromReview, onSaveAndReturn }: Step1Props) {
  const [isBasicInfoOpen, setIsBasicInfoOpen] = useState(true);
  const [customPromoTypes, setCustomPromoTypes] = useState<SelectOption[]>([]);
  const [customIntentCategories, setCustomIntentCategories] = useState<SelectOption[]>([]);
  const [customTargetSegments, setCustomTargetSegments] = useState<SelectOption[]>([]);
  const [customTriggerEvents, setCustomTriggerEvents] = useState<SelectOption[]>([]);
  
  // Track deleted default options
  const [deletedPromoTypes, setDeletedPromoTypes] = useState<string[]>([]);
  const [deletedIntentCategories, setDeletedIntentCategories] = useState<string[]>([]);
  const [deletedTargetSegments, setDeletedTargetSegments] = useState<string[]>([]);
  const [deletedTriggerEvents, setDeletedTriggerEvents] = useState<string[]>([]);

  const promoTypeOptions: SelectOption[] = [
    ...PROMO_TYPES.filter(type => !deletedPromoTypes.includes(type)).map(type => ({ value: type, label: type })),
    ...customPromoTypes,
  ];

  const intentCategoryOptions: SelectOption[] = [
    ...INTENT_CATEGORIES.filter(cat => !deletedIntentCategories.includes(cat)).map(cat => ({ value: cat, label: cat })),
    ...customIntentCategories,
  ];

  const targetSegmentOptions: SelectOption[] = [
    ...TARGET_SEGMENTS.filter(seg => !deletedTargetSegments.includes(seg)).map(seg => ({ value: seg, label: seg })),
    ...customTargetSegments,
  ];

  const triggerEventOptions: SelectOption[] = [
    ...TRIGGER_EVENTS.filter(event => !deletedTriggerEvents.includes(event)).map(event => ({ value: event, label: event })),
    ...customTriggerEvents,
  ];

  const handleDeletePromoType = (value: string) => {
    // Check if it's a custom option
    if (customPromoTypes.some(p => p.value === value)) {
      setCustomPromoTypes(customPromoTypes.filter(p => p.value !== value));
    } else {
      // It's a default option, add to deleted list
      setDeletedPromoTypes([...deletedPromoTypes, value]);
    }
  };

  const handleDeleteIntentCategory = (value: string) => {
    if (customIntentCategories.some(c => c.value === value)) {
      setCustomIntentCategories(customIntentCategories.filter(c => c.value !== value));
    } else {
      setDeletedIntentCategories([...deletedIntentCategories, value]);
    }
  };

  const handleDeleteTargetSegment = (value: string) => {
    if (customTargetSegments.some(s => s.value === value)) {
      setCustomTargetSegments(customTargetSegments.filter(s => s.value !== value));
    } else {
      setDeletedTargetSegments([...deletedTargetSegments, value]);
    }
  };

  const handleDeleteTriggerEvent = (value: string) => {
    if (customTriggerEvents.some(e => e.value === value)) {
      setCustomTriggerEvents(customTriggerEvents.filter(e => e.value !== value));
    } else {
      setDeletedTriggerEvents([...deletedTriggerEvents, value]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="icon-circle">
          <Sparkles className="icon-circle-icon" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-button-hover">
            Step 1 — Identitas Promo
          </h3>
          <p className="text-sm text-muted-foreground">
            Informasi dasar tentang promosi
          </p>
        </div>
        <Badge variant="pending" size="sm" className="ml-auto">Wajib</Badge>
      </div>

      {/* Basic Info Collapsible Section */}
      <Collapsible open={isBasicInfoOpen} onOpenChange={setIsBasicInfoOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl cursor-pointer hover:bg-muted transition-colors">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-button-hover" />
              <div>
                <h4 className="font-medium">Basic Info</h4>
                <p className="text-sm text-muted-foreground">
                  Informasi identitas dan kategori promo
                </p>
              </div>
            </div>
            {isBasicInfoOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-4">
          {/* Divider Line */}
          <div className="border-t border-border mb-6" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client ID (kode unik website) */}
            <div className="space-y-2">
              <Label htmlFor="client_id">Kode Website / Client ID *</Label>
              <Input
                id="client_id"
                placeholder="misal: citra77, wg77 (huruf kecil, unik)"
                value={data.client_id}
                onChange={(e) => onChange({ client_id: e.target.value.toLowerCase().replace(/\s+/g, '') })}
              />
              <p className="text-xs text-muted-foreground">
                ID unik sistem untuk website ini (auto-lowercase, tanpa spasi)
              </p>
            </div>

            {/* Client Name (nama brand) */}
            <div className="space-y-2">
              <Label htmlFor="client_name">Nama Brand *</Label>
              <Input
                id="client_name"
                placeholder="misal: CITRA77, WG77 (nama asli brand)"
                value={data.client_name ?? ''}
                onChange={(e) => onChange({ client_name: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Nama brand seperti yang tertera di website / teks promo
              </p>
            </div>

            {/* Nama Promo */}
            <div className="space-y-2">
              <Label htmlFor="promo_name">Nama Promo *</Label>
              <Input
                id="promo_name"
                placeholder="misal: Welcome Bonus 100%"
                value={data.promo_name}
                onChange={(e) => onChange({ promo_name: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Nama promo yang unik
              </p>
            </div>

            {/* Tipe Promo */}
            <div className="space-y-2">
              <Label htmlFor="promo_type">Tipe Promo *</Label>
              <SelectWithAddNew
                value={data.promo_type}
                onValueChange={(value) => {
                  // Apply defaults when promo type changes (only for empty fields)
                  const defaults = applyPromoTypeDefaults(data, value);
                  const hasDefaults = Object.keys(defaults).length > 0;
                  
                  onChange({ 
                    promo_type: value,
                    ...defaults 
                  });
                  
                  if (hasDefaults) {
                    toast.success(`Default untuk "${value}" diterapkan`, {
                      description: 'Hanya field kosong yang diisi otomatis',
                      duration: 3000,
                    });
                  }
                }}
                options={promoTypeOptions}
                onAddOption={(option) => setCustomPromoTypes([...customPromoTypes, option])}
                onDeleteOption={handleDeletePromoType}
                placeholder="Pilih tipe promo"
              />
              <p className="text-xs text-muted-foreground">
                Kategori promo (LP, EXP, freechip, bonus deposit, cashback, mission)
              </p>
            </div>

            {/* Tujuan Promo */}
            <div className="space-y-2">
              <Label htmlFor="intent_category">Tujuan Promo *</Label>
              <SelectWithAddNew
                value={data.intent_category}
                onValueChange={(value) => onChange({ intent_category: value })}
                options={intentCategoryOptions}
                onAddOption={(option) => setCustomIntentCategories([...customIntentCategories, option])}
                onDeleteOption={handleDeleteIntentCategory}
                placeholder="Pilih tujuan"
              />
              <p className="text-xs text-muted-foreground">
                Tujuan promo (acquisition, retention, reactivation, VIP)
              </p>
            </div>

            {/* Target User */}
            <div className="space-y-2">
              <Label htmlFor="target_segment">Target User *</Label>
              <SelectWithAddNew
                value={data.target_segment}
                onValueChange={(value) => onChange({ target_segment: value })}
                options={targetSegmentOptions}
                onAddOption={(option) => setCustomTargetSegments([...customTargetSegments, option])}
                onDeleteOption={handleDeleteTargetSegment}
                placeholder="Pilih target user"
              />
              <p className="text-xs text-muted-foreground">
                Siapa yang dapat promo ini
              </p>
            </div>

            {/* Trigger Promo */}
            <div className="space-y-2">
              <Label htmlFor="trigger_event">Trigger Promo *</Label>
              <SelectWithAddNew
                value={data.trigger_event}
                onValueChange={(value) => onChange({ trigger_event: value })}
                options={triggerEventOptions}
                onAddOption={(option) => setCustomTriggerEvents([...customTriggerEvents, option])}
                onDeleteOption={handleDeleteTriggerEvent}
                placeholder="Pilih trigger"
              />
              <p className="text-xs text-muted-foreground">
                Event yang memicu promo aktif
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Simpan & Kembali Button (Edit Mode from Review) */}
      {isEditingFromReview && onSaveAndReturn && (
        <div className="flex justify-end pt-6">
          <Button 
            variant="golden" 
            onClick={onSaveAndReturn}
            className="rounded-full gap-2"
          >
            <Save className="h-4 w-4" />
            Simpan & Kembali
          </Button>
        </div>
      )}
    </div>
  );
}
