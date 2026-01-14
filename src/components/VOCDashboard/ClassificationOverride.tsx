/**
 * Classification Override Component (v2.0 - 3-Gate System)
 * Shows 3-Gate classification result and allows human override
 * 
 * PROMO SUPER CONTRACT:
 * - PINTU 1: TRIGGER (action/moment/state)
 * - PINTU 2: BENEFIT (money/credit/item/chance/access/cost_reduction)
 * - PINTU 3: CONSTRAINTS (aturan yang mengikat)
 * 
 * CONTRACT OF TRUTH:
 * - AI = First-pass reasoning (3 pintu)
 * - UI = Authority (this component)
 * - Human = Gatekeeper (override button)
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, Edit2, CheckCircle, ChevronDown, Info, XCircle, Zap, Gift, Lock } from 'lucide-react';
import type { 
  ProgramCategory, 
  ClassificationConfidence, 
  QualityFlag,
  TriggerType,
  BenefitCategory,
  ThreeGateResult,
} from '@/lib/extractors/category-classifier';
import { 
  formatQualityFlag, 
  getGateLabel, 
  getTriggerTypeLabel, 
  getBenefitCategoryLabel 
} from '@/lib/extractors/category-classifier';

interface ClassificationOverrideProps {
  currentCategory: ProgramCategory;
  categoryName: string;
  confidence: ClassificationConfidence;
  qualityFlags: QualityFlag[];
  rewardMode?: 'fixed' | 'formula' | 'tier' | 'multi';
  promoSubType?: string;
  // New 3-Gate props
  trigger?: ThreeGateResult['trigger'];
  benefit?: ThreeGateResult['benefit'];
  constraints?: ThreeGateResult['constraints'];
  reasoning?: string;
  // Legacy Q1-Q4 (backward compatibility)
  legacyReasoning?: {
    q1: { answer: 'ya' | 'tidak'; reasoning: string; evidence: string | null };
    q2: { answer: 'ya' | 'tidak'; reasoning: string; evidence: string | null };
    q3: { answer: 'ya' | 'tidak'; reasoning: string; evidence: string | null };
    q4: { answer: 'ya' | 'tidak'; reasoning: string; evidence: string | null };
  };
  onOverride: (newCategory: ProgramCategory, reason: string) => void;
}

export function ClassificationOverride({
  currentCategory,
  categoryName,
  confidence,
  qualityFlags,
  rewardMode,
  promoSubType,
  trigger,
  benefit,
  constraints,
  reasoning,
  legacyReasoning,
  onOverride,
}: ClassificationOverrideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(currentCategory);
  const [overrideReason, setOverrideReason] = useState('');
  const [showReasoning, setShowReasoning] = useState(false);

  const handleOverride = () => {
    if (selectedCategory !== currentCategory && overrideReason.trim()) {
      onOverride(selectedCategory, overrideReason);
      setIsOpen(false);
      setOverrideReason('');
    }
  };

  const getCategoryBadgeStyle = (cat: ProgramCategory) => {
    switch (cat) {
      case 'A': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'B': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'C': return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
    }
  };

  const getConfidenceStyle = (conf: ClassificationConfidence) => {
    switch (conf) {
      case 'high': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'low': return 'bg-destructive/20 text-destructive border-destructive/40';
    }
  };

  const getConfidenceIcon = (conf: ClassificationConfidence) => {
    switch (conf) {
      case 'high': return <CheckCircle className="h-3 w-3" />;
      case 'medium': return <Info className="h-3 w-3" />;
      case 'low': return <AlertTriangle className="h-3 w-3" />;
    }
  };

  // Check if we have 3-gate data
  const has3GateData = trigger && benefit && constraints;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Classification Result */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Terdeteksi sebagai:</span>
          <Badge variant="outline" className={getCategoryBadgeStyle(currentCategory)}>
            {categoryName}
          </Badge>
          {rewardMode && (
            <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/40">
              {rewardMode === 'formula' ? 'Dinamis' : 
               rewardMode === 'fixed' ? 'Fixed' : 
               rewardMode === 'tier' ? 'Tier' : 'Multi'}
            </Badge>
          )}
          {promoSubType && (
            <Badge variant="outline" className="bg-button-hover/20 text-button-hover border-button-hover/40">
              {promoSubType}
            </Badge>
          )}
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Edit2 className="h-3 w-3" />
              Override
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Override Klasifikasi</DialogTitle>
              <DialogDescription>
                Ubah kategori jika AI salah menentukan. Override akan di-log untuk audit.
              </DialogDescription>
            </DialogHeader>

            {/* Show 3-Gate reasoning (NEW) */}
            {has3GateData && (
              <Collapsible open={showReasoning} onOpenChange={setShowReasoning}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between mb-2">
                    <span className="text-sm">Lihat 3-Gate Reasoning</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showReasoning ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3 p-3 bg-muted rounded-lg text-xs max-h-64 overflow-y-auto">
                    {/* PINTU 1: TRIGGER */}
                    <div className="pb-2 border-b border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-3 w-3 text-blue-400" />
                        <span className="font-medium">PINTU 1 - Trigger</span>
                        <Badge variant={trigger.found ? 'default' : 'outline'} className="text-xs">
                          {trigger.found ? '✅ ADA' : '❌ TIDAK'}
                        </Badge>
                      </div>
                      {trigger.type && (
                        <p className="text-muted-foreground">
                          Tipe: {getTriggerTypeLabel(trigger.type)}
                        </p>
                      )}
                      {trigger.evidence && (
                        <p className="text-foreground mt-1 italic">
                          Evidence: "{trigger.evidence}"
                        </p>
                      )}
                    </div>

                    {/* PINTU 2: BENEFIT */}
                    <div className="pb-2 border-b border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <Gift className="h-3 w-3 text-green-400" />
                        <span className="font-medium">PINTU 2 - Benefit</span>
                        <Badge variant={benefit.found ? 'default' : 'outline'} className="text-xs">
                          {benefit.found ? '✅ ADA' : '❌ TIDAK'}
                        </Badge>
                      </div>
                      {benefit.category && (
                        <p className="text-muted-foreground">
                          Kategori: {getBenefitCategoryLabel(benefit.category)}
                        </p>
                      )}
                      {benefit.evidence && (
                        <p className="text-foreground mt-1 italic">
                          Evidence: "{benefit.evidence}"
                        </p>
                      )}
                    </div>

                    {/* PINTU 3: CONSTRAINTS */}
                    <div className="pb-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Lock className="h-3 w-3 text-amber-400" />
                        <span className="font-medium">PINTU 3 - Constraints</span>
                        <Badge variant={constraints.found ? 'default' : 'outline'} className="text-xs">
                          {constraints.found ? '✅ ADA' : '❌ TIDAK'}
                        </Badge>
                      </div>
                      {constraints.evidence && (
                        <p className="text-foreground mt-1 italic">
                          Evidence: "{constraints.evidence}"
                        </p>
                      )}
                    </div>

                    {/* Reasoning Summary */}
                    {reasoning && (
                      <div className="pt-2">
                        <p className="font-medium text-foreground">Kesimpulan:</p>
                        <p className="text-muted-foreground">{reasoning}</p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Legacy Q1-Q4 reasoning (backward compatibility) */}
            {!has3GateData && legacyReasoning && (
              <Collapsible open={showReasoning} onOpenChange={setShowReasoning}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between mb-2">
                    <span className="text-sm">Lihat Reasoning AI (Legacy)</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showReasoning ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 p-3 bg-muted rounded-lg text-xs max-h-48 overflow-y-auto">
                    {[legacyReasoning.q1, legacyReasoning.q2, legacyReasoning.q3, legacyReasoning.q4].map((q, idx) => (
                      <div key={idx} className="pb-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">Q{idx + 1}:</span>
                          <Badge variant={q.answer === 'ya' ? 'default' : 'outline'} className="text-xs">
                            {q.answer.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">{q.reasoning}</p>
                        {q.evidence && (
                          <p className="text-foreground mt-1 italic">
                            Evidence: "{q.evidence}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Kategori Baru</Label>
                <Select 
                  value={selectedCategory} 
                  onValueChange={(v) => setSelectedCategory(v as ProgramCategory)}
                >
                  <SelectTrigger className="bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A - Reward Program</SelectItem>
                    <SelectItem value="B">B - Event Program</SelectItem>
                    {/* C is System Rule - only available if currently C, not selectable as override target */}
                  </SelectContent>
                </Select>
                {currentCategory === 'C' && (
                  <p className="text-xs text-amber-500 mt-2">
                    ⚠️ System Rule terdeteksi. Jika ini sebenarnya promo, override ke A atau B.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Alasan Override *</Label>
                <Textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Jelaskan kenapa kategori AI salah..."
                  rows={3}
                  className="bg-muted"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Batal
              </Button>
              <Button 
                onClick={handleOverride}
                disabled={selectedCategory === currentCategory || !overrideReason.trim()}
              >
                Konfirmasi Override
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 3-Gate Summary (NEW) */}
      {has3GateData && (
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-blue-400" />
            <span className={trigger.found ? 'text-emerald-400' : 'text-muted-foreground'}>
              Trigger {trigger.found ? '✓' : '✗'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Gift className="h-3 w-3 text-green-400" />
            <span className={benefit.found ? 'text-emerald-400' : 'text-muted-foreground'}>
              Benefit {benefit.found ? '✓' : '✗'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Lock className="h-3 w-3 text-amber-400" />
            <span className={constraints.found ? 'text-emerald-400' : 'text-muted-foreground'}>
              Constraints {constraints.found ? '✓' : '✗'}
            </span>
          </div>
        </div>
      )}

      {/* Quality Flags Warning */}
      {qualityFlags.length > 0 && !qualityFlags.includes('valid') && (
        <div className="flex items-start gap-2 text-xs text-amber-500">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>Quality flags: {qualityFlags.map(f => formatQualityFlag(f)).join(', ')}</span>
        </div>
      )}
    </div>
  );
}
