/**
 * Confidence Gate Modal
 * Blocks commit when classification confidence is LOW
 * 
 * CONTRACT OF TRUTH:
 * - Human must acknowledge low-confidence classification
 * - Override recommended before proceeding
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import type { QualityFlag } from '@/lib/extractors/category-classifier';
import { formatQualityFlag } from '@/lib/extractors/category-classifier';

interface ConfidenceGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  qualityFlags: QualityFlag[];
  categoryName: string;
}

export function ConfidenceGateModal({
  isOpen,
  onClose,
  onConfirm,
  qualityFlags,
  categoryName,
}: ConfidenceGateModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Confidence Rendah - Review Diperlukan
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              <p className="text-foreground">
                Klasifikasi "<span className="font-medium">{categoryName}</span>" memiliki confidence <span className="text-destructive font-medium">LOW</span>.
              </p>
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Masalah terdeteksi:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {qualityFlags.filter(f => f !== 'valid').map((flag, i) => (
                    <li key={i}>{formatQualityFlag(flag)}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-sm text-amber-500">
                  Apakah Anda yakin ingin melanjutkan commit dengan klasifikasi ini?
                  Disarankan untuk melakukan <span className="font-medium">Override</span> terlebih dahulu.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>
            Kembali & Review
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Tetap Commit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
