/**
 * NotificationModal — Global Modal Notification
 *
 * STRICT alignment ke design system v1.1 (locked):
 * - rounded-xl (modal), rounded-full (button CTA)
 * - p-6 padding (24px standard, no banned values)
 * - bg-card, border-border (NO opacity variations)
 * - Title text-foreground, status color hanya pada icon
 * - Icon pakai .icon-circle utility (gold tint default) atau status-color circle
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { notificationBus, type NotificationPayload, type NotificationType } from '@/lib/notify';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ============================================
// Per-type config — design tokens only, NO opacity variants
// ============================================

const CONFIG: Record<NotificationType, {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;     // text color for the icon SVG itself
  iconBg: string;        // bg of the icon circle (uses solid token, no /opacity)
  buttonClass: string;   // CTA button (always rounded-full)
}> = {
  success: {
    icon: CheckCircle2,
    iconColor: 'text-success-foreground',
    iconBg: 'bg-success',
    buttonClass: 'bg-success text-success-foreground hover:opacity-90',
  },
  error: {
    icon: XCircle,
    iconColor: 'text-destructive-foreground',
    iconBg: 'bg-destructive',
    buttonClass: 'bg-destructive text-destructive-foreground hover:opacity-90',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-warning-foreground',
    iconBg: 'bg-warning',
    buttonClass: 'bg-warning text-warning-foreground hover:opacity-90',
  },
  info: {
    icon: Info,
    iconColor: 'text-button-hover-foreground',
    iconBg: 'bg-button-hover',
    buttonClass: 'bg-button-hover text-button-hover-foreground hover:opacity-90',
  },
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

  // Auto-dismiss when duration is set (progress UI)
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

  const cfg = CONFIG[current.type];
  const Icon = cfg.icon;
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

      {/* Modal — rounded-xl, bg-card, border-border, p-6 (design system locked) */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="notif-title"
        className={`
          fixed z-[9999] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          w-full max-w-md mx-auto
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

          {/* Icon + Title row */}
          <div className="flex items-start gap-4 pr-6">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
              <Icon className={`h-5 w-5 ${cfg.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p id="notif-title" className="text-base font-semibold leading-snug text-foreground">
                {current.title}
              </p>
              {current.description && (
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {current.description}
                </p>
              )}
            </div>
          </div>

          {/* Queue indicator */}
          {queue.length > 0 && (
            <p className="text-xs text-muted-foreground mt-4">
              +{queue.length} notifikasi menunggu
            </p>
          )}

          {/* OK button — rounded-full, hide on auto-dismiss */}
          {!isAutoDismiss && (
            <div className="mt-6 flex justify-end">
              <button
                autoFocus
                onClick={handleClose}
                className={`
                  px-6 py-2 rounded-full text-sm font-semibold
                  transition-all duration-150 active:scale-95
                  ${cfg.buttonClass}
                `}
              >
                OK
              </button>
            </div>
          )}

          {/* Auto-dismiss progress bar */}
          {isAutoDismiss && (
            <div className="mt-4 h-0.5 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full ${cfg.iconBg} rounded-full`}
                style={{
                  animation: `shrink ${current.duration}ms linear forwards`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </>
  );
}
