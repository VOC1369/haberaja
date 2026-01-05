import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format number ke Indonesian format dengan titik ribuan
 * e.g., 10000000 → "10.000.000"
 */
export function formatNumberWithSeparator(num: number): string {
  if (isNaN(num) || num === 0) return '';
  return num.toLocaleString('id-ID');
}

/**
 * Parse string dengan format Indonesian ke number
 * e.g., "10.000.000" → 10000000
 */
export function parseFormattedNumber(str: string): number {
  if (!str) return 0;
  // Hapus titik ribuan, ganti koma desimal dengan titik
  const normalized = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
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
 * Get consistent display text for promo sub-type badge
 * Priority: 1) Keyword override from promo_name, 2) Type mapping, 3) Fallback formatPromoType
 */
export function getPromoSubTypeDisplay(
  promoName: string | null | undefined,
  promoType: string | null | undefined
): string {
  const name = (promoName || '').toLowerCase();
  const type = (promoType || '').toLowerCase();
  
  // Priority 1: Keyword-based override dari promo_name
  if (/lucky\s*spin/i.test(name) || /spin\s*gratis/i.test(name) || /spin\s*harian/i.test(name)) {
    return 'Lucky Spin';
  }
  if (/lucky\s*draw/i.test(name) || /undian/i.test(name)) {
    return 'Undian';
  }
  if (/voucher/i.test(name) || /kupon/i.test(name)) {
    return 'Voucher';
  }
  if (/tiket/i.test(name) || /ticket/i.test(name)) {
    return 'Tiket';
  }
  if (/tournament/i.test(name) || /turnamen/i.test(name)) {
    return 'Tournament';
  }
  if (/leaderboard/i.test(name) || /ranking/i.test(name)) {
    return 'Leaderboard';
  }
  if (/freechip/i.test(name) || /freebet/i.test(name) || /chip\s*gratis/i.test(name)) {
    return 'Freechip';
  }
  if (/pragmatic/i.test(name) || /drops.*wins/i.test(name) || /pg\s*soft/i.test(name)) {
    return 'Provider Event';
  }
  if (/maxwin/i.test(name) || /max\s*win/i.test(name) || /multiplier/i.test(name)) {
    return 'Event Multiplier';
  }
  if (/mystery/i.test(name) || /kejutan/i.test(name) || /misteri/i.test(name)) {
    return 'Mystery Bonus';
  }
  if (/streak/i.test(name) || /combo/i.test(name) || /check.?in/i.test(name) || /absen/i.test(name)) {
    return 'Streak Bonus';
  }
  
  // Priority 2: Type-based mapping
  const typeDisplayMap: Record<string, string> = {
    'mini_game': 'Mini Game',
    'spin_wheel': 'Lucky Spin',
    'lucky_draw': 'Undian',
    'welcome_bonus': 'Welcome Bonus',
    'deposit_bonus': 'Deposit Bonus',
    'cashback': 'Cashback',
    'rollingan': 'Rollingan',
    'referral': 'Referral',
    'event_level_up': 'Level Up',
    'freechip': 'Freechip',
    'freebet': 'Freebet',
    'loyalty_point': 'Loyalty Point',
    'tournament': 'Tournament',
    'leaderboard': 'Leaderboard',
    'merchandise': 'Merchandise',
    'campaign': 'Campaign',
    'race': 'Race',
    'level_up': 'Level Up',
    'provider_tournament': 'Provider Event',
    'event_multiplier': 'Event Multiplier',
    'mystery_bonus': 'Mystery Bonus',
    'streak_bonus': 'Streak Bonus',
  };
  
  if (typeDisplayMap[type]) {
    return typeDisplayMap[type];
  }
  
  // Fallback: formatPromoType (snake_case → Title Case)
  return formatPromoType(promoType);
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
