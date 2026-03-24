/**
 * NotificationModal — Global Modal Notification
 * Uses design system tokens ONLY. No hardcoded colors.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { notificationBus, type NotificationPayload, type NotificationType } from '@/lib/notify';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ============================================
// Per-type semantic config — design tokens only
// ============================================

const CONFIG: Record<NotificationType, {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  titleClass: string;
  borderVar: string;
  bgVar: string;
  buttonVar: string;
}> = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-[hsl(var(--success))]',
    titleClass: 'text-[hsl(var(--success))]',
    borderVar: 'border-[hsl(var(--success)_/_0.35)]',
    bgVar: 'bg-[hsl(var(--card))]',
    buttonVar: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:opacity-90',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-[hsl(var(--destructive))]',
    titleClass: 'text-[hsl(var(--destructive))]',
    borderVar: 'border-[hsl(var(--destructive)_/_0.35)]',
    bgVar: 'bg-[hsl(var(--card))]',
    buttonVar: 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:opacity-90',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-[hsl(var(--warning))]',
    titleClass: 'text-[hsl(var(--warning))]',
    borderVar: 'border-[hsl(var(--warning)_/_0.35)]',
    bgVar: 'bg-[hsl(var(--card))]',
    buttonVar: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] hover:opacity-90',
  },
  info: {
    icon: Info,
    iconClass: 'text-[hsl(var(--muted-foreground))]',
    titleClass: 'text-foreground',
    borderVar: 'border-border',
    bgVar: 'bg-[hsl(var(--card))]',
    buttonVar: 'bg-[hsl(var(--button-hover))] text-[hsl(var(--button-hover-foreground))] hover:opacity-90',
  },
};

const TYPE_LABEL: Record<NotificationType, string> = {
  success: 'Berhasil',
  error: 'Terjadi Kesalahan',
  warning: 'Peringatan',
  info: 'Informasi',
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

  // Auto-dismiss if duration is set (info progress notifications)
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
  const label = TYPE_LABEL[current.type];
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

      {/* Modal */}
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
        <div className={`
          relative rounded-2xl border shadow-2xl px-7 py-6
          ${cfg.bgVar} ${cfg.borderVar}
          backdrop-blur-xl
        `}>
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

          {/* Icon + type label */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`rounded-full p-2 bg-muted border ${cfg.borderVar}`}>
              <Icon className={`w-6 h-6 ${cfg.iconClass}`} />
            </div>
            <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.iconClass} opacity-80`}>
              {label}
            </span>
          </div>

          {/* Title */}
          <p id="notif-title" className={`text-base font-semibold leading-snug mb-1 ${cfg.titleClass}`}>
            {current.title}
          </p>

          {/* Description */}
          {current.description && (
            <p className="text-sm text-muted-foreground mt-1 mb-4 leading-relaxed">
              {current.description}
            </p>
          )}

          {/* Queue indicator */}
          {queue.length > 0 && (
            <p className="text-xs text-muted-foreground mb-3">
              +{queue.length} notifikasi menunggu
            </p>
          )}

          {/* OK button — hide on auto-dismiss */}
          {!isAutoDismiss && (
            <div className="mt-5 flex justify-end">
              <button
                autoFocus
                onClick={handleClose}
                className={`
                  px-6 py-2 rounded-xl text-sm font-semibold
                  transition-all duration-150 active:scale-95
                  ${cfg.buttonVar}
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
                className={`h-full ${cfg.iconClass} bg-current rounded-full`}
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
