/**
 * Reward Normalization Utility v1.0
 * 
 * REASONING-BASED reward type inference (NO keyword guessing from name!)
 * 
 * Priority Order:
 * 1. Explicit reward_type field (dari ekstraksi AI)
 * 2. Physical reward indicators (physical_reward_name exists)
 * 3. Cash reward indicators (cash_reward_amount > 0)
 * 4. Promo archetype inference (cashback/bonus = credit_game by default)
 * 5. jenis_hadiah / dinamis_reward_type legacy fields
 * 
 * NEVER guess from sub.name keywords!
 */

export type RewardType = 'hadiah_fisik' | 'credit_game' | 'uang_tunai';

// Promo types yang default reward-nya adalah credit game
const CREDIT_GAME_PROMO_TYPES = [
  'cashback',
  'rollingan', 
  'deposit_bonus',
  'welcome_bonus',
  'referral',
  'freebet',
  'freechip',
  'bonus_deposit',
  'bonus_new_member',
  'turnover_bonus',
  'rebate',
  'scatter_bonus',
  'level_up',
  'event_bonus',
  'daily_bonus',
  'weekly_bonus',
];

// Promo types yang default reward-nya adalah uang tunai
const CASH_PROMO_TYPES = [
  'cash_prize',
  'tournament_cash',
];

/**
 * Infer reward type berdasarkan structured data (REASONING, bukan keyword)
 * 
 * @param sub - Subcategory data
 * @param promo - Parent promo data (optional, untuk archetype inference)
 */
export function inferRewardType(
  sub: Record<string, any>,
  promo?: Record<string, any>
): RewardType | null {
  // PRIORITY 1: Explicit reward_type field dari AI extraction
  if (sub.reward_type) {
    const rt = String(sub.reward_type).toLowerCase();
    if (rt.includes('fisik') || rt === 'hadiah_fisik') return 'hadiah_fisik';
    if (rt.includes('credit') || rt === 'credit_game') return 'credit_game';
    if (rt.includes('tunai') || rt === 'uang_tunai') return 'uang_tunai';
  }

  // PRIORITY 2: Physical reward name exists = hadiah fisik
  if (sub.physical_reward_name && String(sub.physical_reward_name).trim().length > 0) {
    return 'hadiah_fisik';
  }

  // PRIORITY 3: jenis_hadiah legacy field (structured, bukan keyword)
  if (sub.jenis_hadiah) {
    const jh = String(sub.jenis_hadiah).toLowerCase();
    if (jh.includes('fisik') || jh === 'hadiah_fisik') return 'hadiah_fisik';
    if (jh.includes('credit') || jh === 'credit_game' || jh === 'freechip' || jh === 'freebet') return 'credit_game';
    if (jh.includes('tunai') || jh === 'uang_tunai') return 'uang_tunai';
  }

  // PRIORITY 4: dinamis_reward_type legacy field
  if (sub.dinamis_reward_type) {
    const drt = String(sub.dinamis_reward_type).toLowerCase();
    if (drt.includes('fisik')) return 'hadiah_fisik';
    if (drt.includes('credit') || drt === 'freechip' || drt === 'freebet') return 'credit_game';
    if (drt.includes('tunai') || drt === 'cash') return 'uang_tunai';
  }

  // PRIORITY 5: Promo type archetype inference
  if (promo?.promo_type) {
    const pt = String(promo.promo_type).toLowerCase().replace(/[-_\s]/g, '');
    
    // Check credit game archetypes
    if (CREDIT_GAME_PROMO_TYPES.some(t => pt.includes(t.replace(/[-_\s]/g, '')))) {
      return 'credit_game';
    }
    
    // Check cash archetypes
    if (CASH_PROMO_TYPES.some(t => pt.includes(t.replace(/[-_\s]/g, '')))) {
      return 'uang_tunai';
    }
  }

  // PRIORITY 6: Cash reward amount exists (dan bukan physical) = credit_game (default untuk bonus)
  // Note: Di iGaming, cash bonus biasanya masuk sebagai credit game, bukan uang tunai langsung
  if (sub.cash_reward_amount && Number(sub.cash_reward_amount) > 0) {
    // Jika tidak ada physical reward, dan ada cash amount, kemungkinan besar credit game
    return 'credit_game';
  }

  // Tidak bisa infer - return null
  return null;
}

/**
 * Get display quantity untuk subcategory
 * 
 * Rules:
 * - Hadiah fisik: tampilkan quantity (default 1)
 * - Credit game / uang tunai: return null (tidak perlu quantity di depan nama)
 */
export function getDisplayQuantity(
  sub: Record<string, any>,
  rewardType: RewardType | null
): number | null {
  if (rewardType === 'hadiah_fisik') {
    return sub.physical_reward_quantity ?? 1;
  }
  // Credit game dan uang tunai tidak perlu quantity
  return null;
}

/**
 * Format subcategory name dengan quantity (jika applicable)
 */
export function formatSubcategoryName(
  sub: Record<string, any>,
  rewardType: RewardType | null,
  fallbackName?: string
): string {
  const baseName = sub.name || fallbackName || 'Varian';
  const qty = getDisplayQuantity(sub, rewardType);
  
  if (qty !== null && qty > 0) {
    return `${qty} ${baseName}`;
  }
  return baseName;
}

/**
 * Get badge info for reward type
 */
export function getRewardBadgeInfo(rewardType: RewardType | null): {
  label: string;
  emoji: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
} | null {
  switch (rewardType) {
    case 'hadiah_fisik':
      return {
        label: 'Hadiah Fisik',
        emoji: '🎁',
        bgClass: 'bg-amber-500/20',
        textClass: 'text-amber-400',
        borderClass: 'border-amber-500/30',
      };
    case 'credit_game':
      return {
        label: 'Credit Game',
        emoji: '🎮',
        bgClass: 'bg-green-500/20',
        textClass: 'text-green-400',
        borderClass: 'border-green-500/30',
      };
    case 'uang_tunai':
      return {
        label: 'Uang Tunai',
        emoji: '💰',
        bgClass: 'bg-yellow-500/20',
        textClass: 'text-yellow-400',
        borderClass: 'border-yellow-500/30',
      };
    default:
      return null;
  }
}
