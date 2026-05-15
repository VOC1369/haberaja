import { describe, it, expect } from 'vitest';
import { generatePromoSummary, type PromoSummaryContext } from '../promo-summary-generator';

type MechanicNode = { mechanic_type: string; data: Record<string, unknown>; [key: string]: unknown };

describe('generatePromoSummary', () => {
  it('returns empty string for empty mechanics', () => {
    expect(generatePromoSummary([])).toBe('');
  });

  it('Deposit Bonus — full slots', () => {
    const mechanics = [
      { mechanic_type: 'trigger', data: { event: 'deposit', min_value: 100000 } },
      { mechanic_type: 'reward', data: { reward_form: 'bonus_balance' } },
      { mechanic_type: 'calculation', data: { percentage: 100, cap_amount: 2000000, basis: 'deposit' } },
      { mechanic_type: 'control', data: { control_type: 'turnover_requirement', multiplier: 8, basis: 'deposit_plus_bonus' } },
      { mechanic_type: 'control', data: { control_type: 'game_restriction', game_types: ['slot'] } },
    ];
    expect(generatePromoSummary(mechanics)).toBe(
      'Bonus deposit 100% hingga Rp2.000.000, turnover 8x deposit_plus_bonus, khusus slot.'
    );
  });

  it('Cashback — with distribution', () => {
    const mechanics = [
      { mechanic_type: 'reward', data: { reward_form: 'cashback' } },
      { mechanic_type: 'calculation', data: { percentage: 10, cap_amount: 500000, basis: 'loss' } },
      { mechanic_type: 'distribution', data: { schedule: 'mingguan' } },
    ];
    expect(generatePromoSummary(mechanics)).toBe(
      'Cashback 10% hingga Rp500.000 dari kekalahan, dibagikan mingguan.'
    );
  });

  it('Rollingan — no cap', () => {
    const mechanics = [
      { mechanic_type: 'reward', data: { reward_form: 'rebate' } },
      { mechanic_type: 'calculation', data: { percentage: 0.5, basis: 'turnover' } },
      { mechanic_type: 'control', data: { control_type: 'game_restriction', game_types: ['slot'] } },
      { mechanic_type: 'distribution', data: { schedule: 'mingguan' } },
    ];
    expect(generatePromoSummary(mechanics)).toBe(
      'Rollingan 0,5% dari turnover, khusus slot, dibagikan mingguan.'
    );
  });

  it('skips basis_or_trigger when deposit already in reward_label', () => {
    const mechanics = [
      { mechanic_type: 'reward', data: { reward_form: 'bonus_balance' } },
      { mechanic_type: 'calculation', data: { percentage: 50, basis: 'deposit' } },
    ];
    // "Bonus deposit 50%." — no redundant "dari deposit"
    expect(generatePromoSummary(mechanics)).toBe('Bonus deposit 50%.');
  });

  it('fixed amount reward without percentage', () => {
    const mechanics = [
      { mechanic_type: 'reward', data: { reward_form: 'bonus_balance', amount: 50000 } },
    ];
    expect(generatePromoSummary(mechanics)).toBe('Bonus Rp50.000.');
  });

  it('freespin reward', () => {
    const mechanics = [
      { mechanic_type: 'reward', data: { reward_form: 'freespin', amount: 20 } },
      { mechanic_type: 'trigger', data: { event: 'deposit' } },
    ];
    expect(generatePromoSummary(mechanics)).toBe('Freespin 20, untuk deposit.');
  });

  it('includes expiry when slots are few', () => {
    const mechanics = [
      { mechanic_type: 'reward', data: { reward_form: 'bonus_balance' } },
      { mechanic_type: 'calculation', data: { percentage: 100, basis: 'deposit' } },
      { mechanic_type: 'control', data: { control_type: 'expiry', expiry_days: 7 } },
    ];
    expect(generatePromoSummary(mechanics)).toBe('Bonus deposit 100%, hangus dalam 7 hari.');
  });

  it('skips expiry when too many slots', () => {
    const mechanics = [
      { mechanic_type: 'reward', data: { reward_form: 'bonus_balance' } },
      { mechanic_type: 'calculation', data: { percentage: 100, cap_amount: 2000000, basis: 'deposit' } },
      { mechanic_type: 'control', data: { control_type: 'turnover_requirement', multiplier: 8, basis: 'deposit+bonus' } },
      { mechanic_type: 'control', data: { control_type: 'game_restriction', game_types: ['slot'] } },
      { mechanic_type: 'distribution', data: { schedule: 'harian' } },
      { mechanic_type: 'control', data: { control_type: 'expiry', expiry_days: 7 } },
    ];
    const result = generatePromoSummary(mechanics);
    expect(result).not.toContain('hangus');
  });

  it('no reward mechanic → empty', () => {
    const mechanics = [
      { mechanic_type: 'trigger', data: { event: 'deposit' } },
      { mechanic_type: 'control', data: { control_type: 'turnover_requirement', multiplier: 5 } },
    ];
    expect(generatePromoSummary(mechanics)).toBe('');
  });
});

// ── REFERRAL TIER TESTS ──────────────────────────────
describe('Referral Tier', () => {
  it('generates summary for 3-tier referral with downline', () => {
    const mechanics: MechanicNode[] = [
      {
        mechanic_id: 'm_claim_1',
        mechanic_type: 'claim',
        evidence: 'Pencairan pertama butuh verifikasi',
        confidence: 0.8,
        ambiguity: false,
        ambiguity_reason: null,
        activation_rule: null,
        data: { claim_method: 'automatic', proof_required: true }
      }
    ];
    const context: PromoSummaryContext = {
      tier_archetype: 'referral',
      promo_type: 'Referral Bonus',
      subcategories: [
        { calculation_value: 5, sub_name: 'Komisi 5%', min_dimension_value: 5 },
        { calculation_value: 10, sub_name: 'Komisi 10%', min_dimension_value: 10 },
        { calculation_value: 15, sub_name: 'Komisi 15%', min_dimension_value: 15 }
      ]
    };
    const result = generatePromoSummary(mechanics, context);
    expect(result).toBe(
      'Komisi referral 5% – 15% dari winlose bersih downline, minimal 5 downline aktif, verifikasi diperlukan pada pencairan pertama.'
    );
  });

  it('generates summary for single-tier referral', () => {
    const mechanics: MechanicNode[] = [];
    const context: PromoSummaryContext = {
      tier_archetype: 'referral',
      subcategories: [
        { calculation_value: 10, sub_name: 'Komisi 10%', min_dimension_value: 10 }
      ]
    };
    const result = generatePromoSummary(mechanics, context);
    expect(result).toBe(
      'Komisi referral 10% dari winlose bersih downline, minimal 10 downline aktif.'
    );
  });

  it('returns empty string if no subcategories rates available', () => {
    const mechanics: MechanicNode[] = [];
    const context: PromoSummaryContext = {
      tier_archetype: 'referral',
      subcategories: []
    };
    const result = generatePromoSummary(mechanics, context);
    expect(result).toBe('');
  });

  it('non-referral promo unaffected by context', () => {
    const mechanics: MechanicNode[] = [];
    const context: PromoSummaryContext = {
      tier_archetype: 'level',
      subcategories: [{ calculation_value: 5 }]
    };
    const result = generatePromoSummary(mechanics, context);
    expect(result).toBe('');
  });
});
