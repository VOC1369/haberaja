/**
 * promo-summary-generator.ts — Deterministic Summary Renderer v1.0
 *
 * Pure function. Mechanics-only. No form data. No LLM.
 * Slot-based adaptive template with fixed render order.
 */

interface MechanicNode {
  mechanic_type: string;
  data: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PromoSummaryContext {
  tier_archetype?: string;           // 'referral' | 'level' | 'point_store' | null
  promo_type?: string;               // 'Referral Bonus' | 'Rollingan' | dll
  subcategories?: Array<{
    calculation_value?: number;      // persentase komisi per tier
    sub_name?: string;               // nama tier
    min_dimension_value?: number;    // min downline untuk referral
  }>;
}

// ============================================
// HELPERS
// ============================================

function fmtRp(n: number): string {
  return `Rp${n.toLocaleString('id-ID')}`;
}

function fmtPct(n: number): string {
  // 0.5 → "0,5"  |  100 → "100"
  return String(n).replace('.', ',');
}

function findByType(mechanics: MechanicNode[], type: string): MechanicNode | undefined {
  return mechanics.find(m => m.mechanic_type === type);
}

function findAllByType(mechanics: MechanicNode[], type: string): MechanicNode[] {
  return mechanics.filter(m => m.mechanic_type === type);
}

function findControl(mechanics: MechanicNode[], controlType: string): MechanicNode | undefined {
  return mechanics.find(
    m => m.mechanic_type === 'control' && m.data.control_type === controlType
  );
}

// ============================================
// SLOT BUILDERS
// ============================================

/**
 * Slot 1 — reward_label
 * Combines reward_form + calculation basis for business-accurate label.
 */
function buildRewardLabel(rewardForm: string | undefined, calcBasis?: string): string | null {
  // Normalisasi alias reward_form
  const rf = (() => {
    const r = (rewardForm || '').toLowerCase().trim();
    // Alias normalization — semua variant credit/balance → canonical
    if (['balance_credit', 'credit_game', 'credit_balance'].includes(r)) return 'bonus_credit';
    if (['balance', 'saldo', 'bonus_balance'].includes(r)) return 'bonus_balance';
    if (['commission', 'commission_balance'].includes(r)) return 'commission';
    return r;
  })();

  const basis = (calcBasis || '').toLowerCase().trim();

  // Mapping rf + basis → human label
  if (['bonus_balance', 'bonus_credit'].includes(rf)) {
    if (basis === 'loss' || basis === 'winlose') return 'Cashback';
    if (basis === 'deposit') return 'Bonus deposit';
    if (basis === 'turnover') return 'Rollingan';
    return 'Bonus';
  }
  if (['rebate', 'cashback'].includes(rf)) {
    if (basis === 'turnover') return 'Rollingan';
    return 'Cashback';
  }
  if (rf === 'commission') return 'Komisi';
  if (rf === 'freespin') return 'Freespin';
  if (rf === 'physical_reward') return 'Hadiah';
  if (rf === 'percentage_of_loss') return 'Cashback';
  if (rf === 'credit_game') return basis === 'loss' ? 'Cashback' : 'Bonus';
  if (rf === 'uang_tunai') return 'Bonus Tunai';
  if (rf === 'hadiah_fisik') return 'Hadiah';

  // Fallback: capitalize tapi bersihkan underscore
  if (!rf) return null;
  return rf.replace(/_/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Slot 2 — value_summary
 */
function buildValueSummary(
  percentage: number | undefined | null,
  capAmount: number | undefined | null,
  fixedAmount: number | undefined | null,
  isCurrencyReward: boolean = true
): string | null {
  if (percentage != null && capAmount != null) {
    return `${fmtPct(percentage)}% hingga ${fmtRp(capAmount)}`;
  }
  if (percentage != null) {
    return `${fmtPct(percentage)}%`;
  }
  if (fixedAmount != null) {
    // Non-currency amounts (freespin count, item count) — no Rp prefix
    if (isCurrencyReward) return fmtRp(fixedAmount);
    return String(fixedAmount);
  }
  return null;
}

/**
 * Slot 3 — basis_or_trigger
 * Pick the most informative one. Skip if already represented in reward_label.
 */
function buildBasisOrTrigger(
  calcBasis: string | undefined,
  triggerEvent: string | undefined,
  rewardLabel: string | null
): string | null {
  if (calcBasis) {
    // If basis is "deposit" and reward_label already says "Bonus deposit" → skip
    if (calcBasis === 'deposit' && rewardLabel?.includes('deposit')) return null;
    if (calcBasis === 'loss') return 'dari kekalahan';
    if (calcBasis === 'turnover') return 'dari turnover';
    return `dari ${calcBasis}`;
  }
  if (triggerEvent) {
    return `untuk ${triggerEvent}`;
  }
  return null;
}

/**
 * Slot 4 — turnover_summary
 */
function buildTurnoverSummary(control: MechanicNode | undefined): string | null {
  if (!control) return null;
  const multiplier = control.data.multiplier as number | undefined;
  const basis = control.data.basis as string | undefined;
  if (multiplier == null) return null;

  if (basis) return `turnover ${multiplier}x ${basis}`;
  return `turnover ${multiplier}x`;
}

/**
 * Slot 5 — restriction_summary
 */
function buildRestrictionSummary(mechanics: MechanicNode[]): string | null {
  // Collect restrictions from ALL relevant mechanic nodes
  let gameTypes: string[] = [];
  let providers: string[] = [];
  let gameNames: string[] = [];

  for (const m of mechanics) {
    if (m.mechanic_type === 'control' && m.data.control_type === 'game_restriction') {
      if (Array.isArray(m.data.game_types)) gameTypes.push(...(m.data.game_types as string[]));
      if (Array.isArray(m.data.providers)) providers.push(...(m.data.providers as string[]));
      if (Array.isArray(m.data.game_names)) gameNames.push(...(m.data.game_names as string[]));
    }
    // Also check reward/eligibility nodes for game restrictions
    if ((m.mechanic_type === 'reward' || m.mechanic_type === 'eligibility') && m.data.game_restriction) {
      const gr = m.data.game_restriction as Record<string, unknown>;
      if (Array.isArray(gr.game_types)) gameTypes.push(...(gr.game_types as string[]));
      if (Array.isArray(gr.providers)) providers.push(...(gr.providers as string[]));
      if (Array.isArray(gr.game_names)) gameNames.push(...(gr.game_names as string[]));
    }
  }

  // Deduplicate
  gameTypes = [...new Set(gameTypes)];
  providers = [...new Set(providers)];
  gameNames = [...new Set(gameNames)];

  if (gameTypes.length) return `khusus ${gameTypes.join('/')}`;
  if (providers.length) return `khusus provider ${providers.join('/')}`;
  if (gameNames.length) return `khusus game ${gameNames.join('/')}`;
  return null;
}

/**
 * Slot 6 — distribution_summary
 */
function buildDistributionSummary(dist: MechanicNode | undefined): string | null {
  if (!dist) return null;
  const schedule = dist.data.schedule as string | undefined;
  if (schedule) return `dibagikan ${schedule}`;
  return null;
}

/**
 * Slot 7 — expiry_summary (low priority)
 */
function buildExpirySummary(control: MechanicNode | undefined, slotCount: number): string | null {
  if (!control || slotCount >= 5) return null;
  const days = control.data.expiry_days as number | undefined;
  if (days != null) return `hangus dalam ${days} hari`;
  return null;
}

// ============================================
// MAIN FUNCTION
// ============================================

export function generatePromoSummary(
  mechanics: MechanicNode[],
  context?: PromoSummaryContext
): string {
  // ── REFERRAL TIER BRANCH ──────────────────────────────
  // Dipanggil jika tier_archetype = 'referral' DAN ada subcategories
  if (context?.tier_archetype === 'referral' && context?.subcategories?.length) {
    const subs = context.subcategories;

    // Ambil semua nilai komisi dan sort ascending
    const rates = subs
      .map(s => s.calculation_value)
      .filter((v): v is number => typeof v === 'number' && v > 0)
      .sort((a, b) => a - b);

    // Format range: "5% – 15%" atau "5%" jika hanya satu tier
    const rateLabel = rates.length > 1
      ? `${rates[0]}% – ${rates[rates.length - 1]}%`
      : rates.length === 1
        ? `${rates[0]}%`
        : null;

    if (!rateLabel) return '';

    // Ambil min downline dari tier pertama (tier terendah)
    const minDownline = subs
      .map(s => s.min_dimension_value)
      .filter((v): v is number => typeof v === 'number' && v > 0)
      .sort((a, b) => a - b)[0];

    // Ambil eligibility untuk claim info
    const claim = mechanics.find(m => m.mechanic_type === 'claim');
    const proofRequired = claim?.data?.proof_required;

    // Build summary parts
    const parts: string[] = [];
    parts.push(`Komisi referral ${rateLabel} dari winlose bersih downline`);
    if (minDownline) parts.push(`minimal ${minDownline} downline aktif`);
    if (proofRequired) parts.push(`verifikasi diperlukan pada pencairan pertama`);

    return parts.join(', ') + '.';
  }
  // ── END REFERRAL BRANCH ───────────────────────────────

  if (!Array.isArray(mechanics) || mechanics.length === 0) return '';

  // Extract source nodes
  const reward = findByType(mechanics, 'reward');
  const calc = findByType(mechanics, 'calculation');
  const trigger = findByType(mechanics, 'trigger');
  const dist = findByType(mechanics, 'distribution');
  const toControl = findControl(mechanics, 'turnover_requirement');
  
  const expiryControl = findControl(mechanics, 'expiry');

  // Source values
  const rewardForm = reward?.data.reward_form as string | undefined;
  const calcBasis = (
    calc?.data?.calculation_basis ??
    calc?.data?.calculation_base ??
    calc?.data?.basis ??
    undefined
  ) as string | undefined;
  const percentage = calc?.data.percentage as number | undefined;
  const capAmount = calc?.data.cap_amount as number | undefined;
  const fixedAmount = (
    reward?.data.reward_amount_fixed ??
    reward?.data.reward_amount ??
    reward?.data.amount ??
    calc?.data.amount
  ) as number | undefined;
  const triggerEvent = trigger?.data.event as string | undefined;

  // Build slots
  let rewardLabel = buildRewardLabel(rewardForm, calcBasis);

  // Detect APK dari trigger mechanic jika label masih generic
  if ((!rewardLabel || rewardLabel === 'Bonus') &&
      !rewardLabel?.includes('APK')) {
    const triggerMech = mechanics.find(
      m => m.mechanic_type === 'trigger'
    );
    const triggerEvent = (
      (triggerMech?.data?.trigger_event as string | undefined) ||
      (triggerMech?.data?.event as string | undefined) ||
      ''
    ).toLowerCase();
    if (
      triggerEvent.includes('apk') ||
      triggerEvent.includes('download') ||
      triggerEvent === 'apk_download'
    ) {
      rewardLabel = 'Bonus APK';
    }
  }

  // Fallback: gunakan promo_type dari context sebagai hint
  if ((!rewardLabel || rewardLabel === 'Bonus') && context?.promo_type) {
    const pt = (context.promo_type || '').toLowerCase();
    if (pt.includes('cashback') || pt.includes('loss')) {
      rewardLabel = 'Cashback';
    } else if (pt.includes('rollingan') || pt.includes('turnover')) {
      rewardLabel = 'Rollingan';
    } else if (pt.includes('deposit bonus') || pt.includes('welcome')) {
      rewardLabel = 'Bonus deposit';
    } else if (pt.includes('referral')) {
      rewardLabel = 'Komisi referral';
    } else if (pt.includes('apk') || pt.includes('download') || pt.includes('unduh')) {
      rewardLabel = 'Bonus APK';
    } else if (pt.includes('freechip')) {
      rewardLabel = 'Freechip';
    }
  }
  const isCurrency = !rewardForm || !['freespin', 'physical_reward'].includes(rewardForm.toLowerCase());
  const valueSummary = buildValueSummary(percentage, capAmount, fixedAmount, isCurrency);
  const basisOrTrigger = buildBasisOrTrigger(calcBasis, triggerEvent, rewardLabel);
  const turnoverSummary = buildTurnoverSummary(toControl);
  const restrictionSummary = buildRestrictionSummary(mechanics);
  const distributionSummary = buildDistributionSummary(dist);

  // Mandatory: reward_label + value_summary
  if (!rewardLabel) return '';

  // Build core (slot1 + slot2 + slot3 merged naturally)
  let core = valueSummary ? `${rewardLabel} ${valueSummary}` : rewardLabel;
  if (basisOrTrigger) {
    // "dari X" attaches naturally without comma; "untuk X" uses comma
    const sep = basisOrTrigger.startsWith('dari ') ? ' ' : ', ';
    core += `${sep}${basisOrTrigger}`;
  }

  // Conditional slots
  const conditionalParts = [
    turnoverSummary,
    restrictionSummary,
    distributionSummary,
  ].filter(Boolean) as string[];

  // Expiry — only if total active slots < 5
  const totalSlots = 1 + (valueSummary ? 1 : 0) + (basisOrTrigger ? 1 : 0) + conditionalParts.length;
  const expirySummary = buildExpirySummary(expiryControl, totalSlots);
  if (expirySummary) conditionalParts.push(expirySummary);

  // Render
  const allParts = [core, ...conditionalParts];
  const result = allParts.join(', ') + '.';

  // === VALIDATION WARNINGS ===
  if (reward && !rewardLabel) {
    console.warn('[promo-summary] reward mechanic exists but summary is empty');
  }
  if (toControl && !turnoverSummary) {
    console.warn('[promo-summary] turnover control exists but not in summary');
  }
  if (findControl(mechanics, 'game_restriction') && !restrictionSummary) {
    console.warn('[promo-summary] game restriction exists but not in summary');
  }

  return result;
}
