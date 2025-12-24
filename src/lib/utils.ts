import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format promo type to Title Case (without underscores)
 * e.g., "event_level_up" → "Event Level Up"
 * e.g., "welcome_bonus" → "Welcome Bonus"
 * Already formatted values pass through unchanged
 */
export function formatPromoType(type: string | null | undefined): string {
  if (!type) return '-';
  
  // If already contains space or slash, likely already formatted
  if (type.includes(' ') || type.includes('/')) {
    return type;
  }
  
  // Convert snake_case to Title Case
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format date to DD/MM/YY
 * e.g., "2025-12-23" → "23/12/25"
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  } catch {
    return "-";
  }
}

/**
 * Format datetime to DD/MM/YY, HH:mm
 * e.g., "2025-12-23T22:04:00" → "23/12/25, 22.04"
 */
export function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    const time = date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${day}/${month}/${year}, ${time}`;
  } catch {
    return "-";
  }
}
