/**
 * NOTIFY — Global Modal Notification System
 *
 * Drop-in replacement for sonner's `toast` object.
 * Semua panggilan toast.success/error/warning/info akan menampilkan modal dialog.
 *
 * Usage sama persis dengan sonner:
 *   toast.success("Berhasil!")
 *   toast.error("Gagal!", { description: "Detail error" })
 *
 * Untuk menampilkan modal, komponen NotificationModal harus ada di dalam
 * NotificationProvider di root app.
 */

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  description?: string;
  duration?: number;
}

type Listener = (payload: NotificationPayload) => void;

// Simple event bus — no React dependency at module level
const listeners: Set<Listener> = new Set();

export const notificationBus = {
  subscribe: (fn: Listener) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  emit: (payload: NotificationPayload) => {
    listeners.forEach(fn => fn(payload));
  },
};

// ============================================
// Drop-in toast API (compatible with sonner)
// ============================================

function emit(type: NotificationType, message: string, options?: { description?: string; duration?: number; [key: string]: unknown }) {
  notificationBus.emit({
    type,
    title: message,
    description: options?.description,
    duration: options?.duration,
  });
}

export const toast = {
  success: (message: string, options?: { description?: string; duration?: number }) =>
    emit('success', message, options),

  error: (message: string, options?: { description?: string; duration?: number }) =>
    emit('error', message, options),

  warning: (message: string, options?: { description?: string; duration?: number }) =>
    emit('warning', message, options),

  info: (message: string, options?: { description?: string; duration?: number }) =>
    emit('info', message, options),

  // Alias — some code calls toast() directly
  message: (message: string, options?: { description?: string; duration?: number }) =>
    emit('info', message, options),
};

// Make toast callable as a function too (some sonner usages: toast("msg"))
export default Object.assign(
  (message: string, options?: { description?: string; duration?: number }) =>
    emit('info', message, options),
  toast,
);
