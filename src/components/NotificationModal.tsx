/**
 * NotificationModal — Global Modal Notification
 *
 * Menggantikan toast/snackbar dengan modal dialog yang harus diklik untuk ditutup.
 * Dipasang di root app (main.tsx / App.tsx) sebagai provider.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { notificationBus, type NotificationPayload, type NotificationType } from '@/lib/notify';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ============================================
// Icon & color per type
// ============================================

const CONFIG: Record<NotificationType, {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  titleClass: string;
  borderClass: string;
  bgClass: string;
  buttonClass: string;
}> = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-400',
    titleClass: 'text-emerald-200',
    borderClass: 'border-emerald-500/40',
    bgClass: 'bg-emerald-950/80',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-red-400',
    titleClass: 'text-red-200',
    borderClass: 'border-red-500/40',
    bgClass: 'bg-red-950/80',
    buttonClass: 'bg-red-600 hover:bg-red-500 text-white',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-400',
    titleClass: 'text-amber-200',
    borderClass: 'border-amber-500/40',
    bgClass: 'bg-amber-950/80',
    buttonClass: 'bg-amber-600 hover:bg-amber-500 text-white',
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-400',
    titleClass: 'text-blue-200',
    borderClass: 'border-blue-500/40',
    bgClass: 'bg-blue-950/80',
    buttonClass: 'bg-blue-600 hover:bg-blue-500 text-white',
  },
};

const TYPE_LABEL: Record<NotificationType, string> = {
  success: 'Berhasil',
  error: 'Terjadi Kesalahan',
  warning: 'Peringatan',
  info: 'Informasi',
};

// ============================================
// Queue item type
// ============================================

interface QueueItem extends NotificationPayload {
  id: number;
}

let idCounter = 0;

// ============================================
// NotificationModal Component
// ============================================

export function NotificationModal() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [current, setCurrent] = useState<QueueItem | null>(null);
  const [visible, setVisible] = useState(false);

  // Subscribe to bus
  useEffect(() => {
    const unsub = notificationBus.subscribe((payload) => {
      const item: QueueItem = { ...payload, id: ++idCounter };
      setQueue(prev => [...prev, item]);
    });
    return () => { unsub(); };
  }, []);

  // Show next from queue when idle
  useEffect(() => {
    if (!visible && queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      setCurrent(next);
      setVisible(true);
    }
  }, [queue, visible]);

  const handleClose = useCallback(() => {
    setVisible(false);
    // small delay before showing next
    setTimeout(() => setCurrent(null), 200);
  }, []);

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

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleClose}
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
          ${cfg.bgClass} ${cfg.borderClass}
          backdrop-blur-xl
        `}>
          {/* Close X button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon + type label */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`rounded-full p-2 ${cfg.bgClass} border ${cfg.borderClass}`}>
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
            <p className="text-xs text-muted-foreground/60 mb-3">
              +{queue.length} notifikasi menunggu
            </p>
          )}

          {/* OK button */}
          <div className="mt-5 flex justify-end">
            <button
              autoFocus
              onClick={handleClose}
              className={`
                px-6 py-2 rounded-xl text-sm font-semibold
                transition-all duration-150 active:scale-95
                ${cfg.buttonClass}
              `}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
