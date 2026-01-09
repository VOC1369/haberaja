/**
 * Arbitration Rules
 * Version: v1.0.0+2025-01-09
 * 
 * REASONING-FIRST ARCHITECTURE:
 * This module resolves conflicts between:
 * - Q1-Q4 Classification (Category A/B/C)
 * - Step-0 Intent Reasoning (Mechanic)
 * 
 * KEY PRINCIPLE:
 * - Step-0 (mechanic) WINS for operational fields: mode, calculation_basis, reward_is_percentage
 * - Q1-Q4 (category) WINS for classification: intent_category, target_segment, UI routing
 * 
 * EXCEPTION:
 * - If Q1-Q4 strongly indicates "NOT a promo/policy", Step-0 only provides evidence
 */

import type { PromoIntent } from './promo-intent-reasoner';
import type { MechanicRouterResult, PromoMode } from './mechanic-router';
import type { ClassificationResult, ProgramCategory } from './category-classifier';

// ============================================
// TYPES
// ============================================

export interface ArbitrationInput {
  // Q1-Q4 Classification result
  classification: ClassificationResult;
  
  // Step-0 Intent Reasoning result
  intent: PromoIntent;
  
  // Mechanic Router result
  mechanic: MechanicRouterResult;
}

export interface ConflictRecord {
  field: string;
  q1q4_value: unknown;
  step0_value: unknown;
  winner: 'q1q4' | 'step0';
  reason: string;
}

export interface ArbitrationResult {
  // OPERATIONAL FIELDS (Step-0 wins)
  mode: PromoMode;
  calculation_basis: string | null;
  reward_is_percentage: boolean;
  mechanic_type: string;
  
  // CLASSIFICATION FIELDS (Q1-Q4 wins)
  program_category: ProgramCategory;
  intent_category: string;
  target_segment: string;
  ui_routing: 'reward' | 'event' | 'policy';
  
  // Conflict log for audit
  conflicts: ConflictRecord[];
  
  // Flag if human review needed
  needs_human_review: boolean;
  review_reason?: string;
  
  // Metadata
  arbitration_version: string;
}

// ============================================
// ARBITRATION LOGIC
// ============================================

const ARBITRATION_VERSION = 'v1.0.0+2025-01-09';

/**
 * Map program category to UI routing
 */
function categoryToUIRouting(category: ProgramCategory): 'reward' | 'event' | 'policy' {
  switch (category) {
    case 'A': return 'reward';
    case 'B': return 'event';
    case 'C': return 'policy';
    default: return 'reward';
  }
}

/**
 * Map intent primary_action to suggested category
 */
function actionToSuggestedCategory(action: PromoIntent['primary_action']): ProgramCategory {
  // Event-like actions
  const eventActions = ['mission', 'level_up', 'redeem', 'download_apk'];
  if (eventActions.includes(action)) {
    return 'B';
  }
  
  // Reward-like actions
  const rewardActions = ['deposit', 'loss', 'turnover', 'referral', 'login', 'birthday', 'register', 'verify'];
  if (rewardActions.includes(action)) {
    return 'A';
  }
  
  return 'A'; // Default to reward
}

/**
 * Check if Q1-Q4 classification strongly indicates non-promo
 */
function isStrongNonPromo(classification: ClassificationResult): boolean {
  // If category is C (Policy) with high confidence, might be non-promo
  if (classification.category === 'C' && classification.confidence === 'high') {
    return true;
  }
  
  // If quality flags indicate issues (no valid flag means potential problem)
  const hasNoValidFlag = classification.quality_flags?.length > 0 && 
    !classification.quality_flags.includes('valid');
  if (hasNoValidFlag && classification.quality_flags.includes('no_evidence')) {
    return true;
  }
  
  return false;
}

/**
 * Main arbitration function.
 * Resolves conflicts between Q1-Q4 and Step-0.
 */
export function arbitrate(input: ArbitrationInput): ArbitrationResult {
  const { classification, intent, mechanic } = input;
  const conflicts: ConflictRecord[] = [];
  
  // Check if strong non-promo case
  const isNonPromo = isStrongNonPromo(classification);
  
  // === STEP-0 WINS for operational fields ===
  // (Unless strong non-promo indication)
  const mode = isNonPromo ? 'unknown' as PromoMode : mechanic.locked_fields.mode;
  const calculation_basis = isNonPromo ? null : mechanic.locked_fields.calculation_basis;
  const reward_is_percentage = isNonPromo ? false : mechanic.locked_fields.reward_is_percentage;
  const mechanic_type = mechanic.mechanic_type;
  
  // === Q1-Q4 WINS for classification fields ===
  const program_category = classification.category;
  const ui_routing = categoryToUIRouting(program_category);
  
  // Detect conflicts between Q1-Q4 category and Step-0 suggested category
  const step0_suggested_category = actionToSuggestedCategory(intent.primary_action);
  if (step0_suggested_category !== program_category) {
    conflicts.push({
      field: 'program_category',
      q1q4_value: program_category,
      step0_value: step0_suggested_category,
      winner: 'q1q4',
      reason: 'Q1-Q4 classification wins for category determination',
    });
  }
  
  // Detect mode conflicts
  // Q1-Q4 doesn't directly set mode, but category implies expected modes
  const expectedModes: Record<ProgramCategory, PromoMode[]> = {
    'A': ['formula', 'fixed', 'tier'],
    'B': ['event', 'tier', 'fixed'],
    'C': ['fixed', 'unknown'],
  };
  
  if (!expectedModes[program_category].includes(mode)) {
    conflicts.push({
      field: 'mode',
      q1q4_value: `expected: ${expectedModes[program_category].join('|')}`,
      step0_value: mode,
      winner: 'step0',
      reason: 'Step-0 wins for mode determination (operational)',
    });
  }
  
  // Determine if human review needed
  let needs_human_review = false;
  let review_reason: string | undefined;
  
  // Low confidence from either side triggers review
  if (intent.confidence < 0.6) {
    needs_human_review = true;
    review_reason = `Intent confidence too low: ${intent.confidence.toFixed(2)}`;
  }
  
  if (classification.confidence === 'low') {
    needs_human_review = true;
    review_reason = review_reason 
      ? `${review_reason}; Classification confidence low`
      : 'Classification confidence low';
  }
  
  // Multiple conflicts trigger review
  if (conflicts.length >= 2) {
    needs_human_review = true;
    review_reason = review_reason
      ? `${review_reason}; Multiple conflicts (${conflicts.length})`
      : `Multiple conflicts detected (${conflicts.length})`;
  }
  
  // Invariant violations trigger review
  if (mechanic.invariant_violations.length > 0) {
    needs_human_review = true;
    review_reason = review_reason
      ? `${review_reason}; Invariant violations`
      : `Invariant violations: ${mechanic.invariant_violations.join(', ')}`;
  }
  
  return {
    // Operational (Step-0 wins)
    mode,
    calculation_basis,
    reward_is_percentage,
    mechanic_type,
    
    // Classification (Q1-Q4 wins)
    program_category,
    intent_category: classification.category === 'A' ? 'Retention' : 
                     classification.category === 'B' ? 'Engagement' : 'Compliance',
    target_segment: 'Semua', // Default, can be overridden by extraction
    ui_routing,
    
    // Audit trail
    conflicts,
    needs_human_review,
    review_reason,
    
    arbitration_version: ARBITRATION_VERSION,
  };
}

// ============================================
// UTILITY: Format conflicts for display
// ============================================

export function formatConflicts(conflicts: ConflictRecord[]): string {
  if (conflicts.length === 0) return 'No conflicts';
  
  return conflicts.map(c => 
    `${c.field}: Q1-Q4="${c.q1q4_value}" vs Step-0="${c.step0_value}" → Winner: ${c.winner}`
  ).join('\n');
}

// ============================================
// EXPORTS
// ============================================

export {
  ARBITRATION_VERSION,
  categoryToUIRouting,
  actionToSuggestedCategory,
  isStrongNonPromo,
};
