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
function buildRewardLabel(rewardForm: string | undefined, calcBasis: string | undefined): string | null {
  if (!rewardForm) return null;

  const rf = rewardForm.toLowerCase();

  if (rf === 'bonus_balance' || rf === 'bonus_credit') {
    if (calcBasis === 'deposit') return 'Bonus deposit';
    if (calcBasis === 'loss') return 'Cashback';
    return 'Bonus';
  }
  if (rf === 'rebate' || rf === 'cashback' || rf === 'commission') {
    if (calcBasis === 'turnover') return 'Rollingan';
    if (calcBasis === 'loss') return 'Cashback';
    return 'Cashback';
  }
  if (rf === 'freespin') return 'Freespin';
  if (rf === 'physical_reward') return 'Hadiah';

  // Unmapped — capitalize
  return rf.charAt(0).toUpperCase() + rf.slice(1);
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
function buildRestrictionSummary(control: MechanicNode | undefined): string | null {
  if (!control) return null;
  const d = control.data;

  const gameTypes = d.game_types as string[] | undefined;
  const providers = d.providers as string[] | undefined;
  const gameNames = d.game_names as string[] | undefined;

  if (gameTypes?.length) return `khusus ${gameTypes.join('/')}`;
  if (providers?.length) return `khusus provider ${providers.join('/')}`;
  if (gameNames?.length) return `khusus game ${gameNames.join('/')}`;
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

export function generatePromoSummary(mechanics: MechanicNode[]): string {
  if (!Array.isArray(mechanics) || mechanics.length === 0) return '';

  // Extract source nodes
  const reward = findByType(mechanics, 'reward');
  const calc = findByType(mechanics, 'calculation');
  const trigger = findByType(mechanics, 'trigger');
  const dist = findByType(mechanics, 'distribution');
  const toControl = findControl(mechanics, 'turnover_requirement');
  const gameControl = findControl(mechanics, 'game_restriction');
  const expiryControl = findControl(mechanics, 'expiry');

  // Source values
  const rewardForm = reward?.data.reward_form as string | undefined;
  const calcBasis = calc?.data.basis as string | undefined;
  const percentage = calc?.data.percentage as number | undefined;
  const capAmount = calc?.data.cap_amount as number | undefined;
  const fixedAmount = (reward?.data.amount ?? calc?.data.amount) as number | undefined;
  const triggerEvent = trigger?.data.event as string | undefined;

  // Build slots
  const rewardLabel = buildRewardLabel(rewardForm, calcBasis);
  const isCurrency = !rewardForm || !['freespin', 'physical_reward'].includes(rewardForm.toLowerCase());
  const valueSummary = buildValueSummary(percentage, capAmount, fixedAmount, isCurrency);
  const basisOrTrigger = buildBasisOrTrigger(calcBasis, triggerEvent, rewardLabel);
  const turnoverSummary = buildTurnoverSummary(toControl);
  const restrictionSummary = buildRestrictionSummary(gameControl);
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
  if (gameControl && !restrictionSummary) {
    console.warn('[promo-summary] game restriction exists but not in summary');
  }

  return result;
}
