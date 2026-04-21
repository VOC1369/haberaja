/**
 * NotificationModal — Global Modal Notification
 *
 * STRICT alignment ke Design System v1.1:
 * - rounded-xl modal, rounded-full button (sec. 5, 15, 18)
 * - p-6 padding (sec. 17)
 * - bg-card + border-border, NO opacity variations on cards/borders (sec. 1)
 * - Title text-foreground (sec. 7 level 2) — NO colored titles
 * - Icon circle: .icon-circle utility (gold bg-button-hover/20) — KONSISTEN
 *   dengan empty-state pattern (sec. 9). Status di-encode via icon SHAPE.
 * - Progress bar: bg-button-hover (golden, brand-consistent)
 * - CTA button: golden variant (bg-button-hover) sec. 5
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { notificationBus, type NotificationPayload, type NotificationType } from '@/lib/notify';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ============================================
// Per-type config — STRICT design system tokens
// Icon shape encodes status; color treatment is uniform (golden)
// ============================================

const ICON_BY_TYPE: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

interface QueueItem extends NotificationPayload {
  id: number;
}

let idCounter = 0;

export function NotificationModal() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [current, setCurrent] = useState<QueueItem | null>(null);
  const [visible, setVisible] = useState(false);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = notificationBus.subscribe((payload) => {
      const item: QueueItem = { ...payload, id: ++idCounter };
      setQueue(prev => [...prev, item]);
    });
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    if (!visible && queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      setCurrent(next);
      setVisible(true);
    }
  }, [queue, visible]);

  const handleClose = useCallback(() => {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    setVisible(false);
    setTimeout(() => setCurrent(null), 200);
  }, []);

  // Auto-dismiss when duration is set
  useEffect(() => {
    if (!visible || !current) return;
    if (current.duration && current.duration > 0) {
      autoDismissRef.current = setTimeout(handleClose, current.duration);
    }
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, [visible, current, handleClose]);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, handleClose]);

  if (!current) return null;

  const Icon = ICON_BY_TYPE[current.type];
  const isAutoDismiss = !!(current.duration && current.duration > 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={!isAutoDismiss ? handleClose : undefined}
      />

      {/* Modal — design system locked */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="notif-title"
        className={`
          fixed z-[9999] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          w-full max-w-md mx-auto px-4
          transition-all duration-200
          ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
        `}
      >
        <div className="relative rounded-xl border border-border bg-card shadow-xl p-6">
          {/* Close X button — hide on auto-dismiss */}
          {!isAutoDismiss && (
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Icon + Title row — uses .icon-circle utility (sec. 4 / sec. 9) */}
          <div className="flex items-start gap-4 pr-6">
            <div className="icon-circle">
              <Icon className="icon-circle-icon" />
            </div>
            <div className="flex-1 min-w-0 pt-1.5">
              <p id="notif-title" className="text-base font-semibold leading-snug text-foreground">
                {current.title}
              </p>
              {current.description && (
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {current.description}
                </p>
              )}
            </div>
          </div>

          {/* Queue indicator */}
          {queue.length > 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              +{queue.length} notifikasi menunggu
            </p>
          )}

          {/* OK button — golden, rounded-full (sec. 5) */}
          {!isAutoDismiss && (
            <div className="mt-6 flex justify-end">
              <button
                autoFocus
                onClick={handleClose}
                className="px-6 h-10 rounded-full text-sm font-semibold bg-button-hover text-button-hover-foreground hover:bg-button-hover/90 transition-colors active:scale-95"
              >
                OK
              </button>
            </div>
          )}

          {/* Auto-dismiss progress bar — golden, brand-consistent */}
          {isAutoDismiss && (
            <div className="mt-6 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-button-hover rounded-full"
                style={{
                  animation: `notif-shrink ${current.duration}ms linear forwards`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes notif-shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </>
  );
}
