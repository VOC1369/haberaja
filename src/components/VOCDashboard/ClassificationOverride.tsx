/**
 * Classification Override Component
 * Shows classification result and allows human override
 * 
 * CONTRACT OF TRUTH:
 * - AI = First-pass reasoning
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
import { AlertTriangle, Edit2, CheckCircle, ChevronDown, Info } from 'lucide-react';
import type { 
  ProgramCategory, 
  ClassificationConfidence, 
  QualityFlag,
  QAnswer 
} from '@/lib/extractors/category-classifier';
import { formatQualityFlag } from '@/lib/extractors/category-classifier';

interface ClassificationOverrideProps {
  currentCategory: ProgramCategory;
  categoryName: string;
  confidence: ClassificationConfidence;
  qualityFlags: QualityFlag[];
  reasoning?: {
    q1: QAnswer;
    q2: QAnswer;
    q3: QAnswer;
    q4: QAnswer;
  };
  onOverride: (newCategory: ProgramCategory, reason: string) => void;
}

export function ClassificationOverride({
  currentCategory,
  categoryName,
  confidence,
  qualityFlags,
  reasoning,
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

  const getQLabel = (qNum: number) => {
    switch (qNum) {
      case 1: return 'Q1 (Penalty/Restriction)';
      case 2: return 'Q2 (Ongoing/Accumulation)';
      case 3: return 'Q3 (Instant Reward)';
      case 4: return 'Q4 (Event/Competition)';
      default: return `Q${qNum}`;
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Classification Result */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Terdeteksi sebagai:</span>
          <Badge variant="outline" className={getCategoryBadgeStyle(currentCategory)}>
            {currentCategory} - {categoryName}
          </Badge>
          <Badge variant="outline" className={`${getConfidenceStyle(confidence)} flex items-center gap-1`}>
            {getConfidenceIcon(confidence)}
            {confidence}
          </Badge>
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

            {/* Show reasoning */}
            {reasoning && (
              <Collapsible open={showReasoning} onOpenChange={setShowReasoning}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between mb-2">
                    <span className="text-sm">Lihat Reasoning AI</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showReasoning ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 p-3 bg-muted rounded-lg text-xs max-h-48 overflow-y-auto">
                    {[reasoning.q1, reasoning.q2, reasoning.q3, reasoning.q4].map((q, idx) => (
                      <div key={idx} className="pb-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{getQLabel(idx + 1)}:</span>
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
