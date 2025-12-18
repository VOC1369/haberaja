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
