# Dokumentasi Tier Archetype System

## Overview

Tier Archetype adalah sistem UI-gating yang mengontrol field mana yang ditampilkan berdasarkan tipe promo tier yang dipilih. Sistem ini **TIDAK** mempengaruhi backend/PKB storage - hanya mengontrol visibilitas field di form.

---

## 4 Tier Archetype

### 1. `tier_level` - Level/Milestone Mode
**Use Case:** NALEN (Naik Level), VIP Upgrade Bonus, Milestone Achievement

| Field | Visible |
|-------|---------|
| Point Unit | ❌ |
| EXP Mode | ❌ |
| LP Formula | ❌ |
| Payout Direction | ❌ |
| Admin Fee | ❌ |
| Dasar Perhitungan | ❌ |
| Jenis Perhitungan | ❌ |
| Nilai Bonus | ❌ |
| Minimum Base | ❌ |
| Sub Kategori | ✅ |

**Karakteristik:**
- Fokus pada pencapaian level/milestone
- Reward diberikan saat player mencapai level tertentu
- Tidak memerlukan formula perhitungan kompleks
- Konfigurasi reward per level via Sub Kategori

---

### 2. `tier_point_store` - Point Store Mode
**Use Case:** LP Store, EXP Store, Loyalty Point Exchange

| Field | Visible |
|-------|---------|
| Point Unit | ✅ (LP/EXP/Hybrid) |
| EXP Mode | ✅ |
| LP Formula | ✅ |
| Payout Direction | ❌ |
| Admin Fee | ❌ |
| Dasar Perhitungan | ✅ |
| Jenis Perhitungan | ✅ |
| Nilai Bonus | ✅ |
| Minimum Base | ✅ |
| Sub Kategori | ✅ |

**Karakteristik:**
- Player mengumpulkan point (LP/EXP)
- Point dapat ditukar dengan reward
- Memerlukan formula konversi point
- Mendukung sistem level-up berbasis EXP

---

### 3. `tier_formula` - Formula/Percentage Mode
**Use Case:** Cashback %, Rebate %, Rolling Commission

| Field | Visible |
|-------|---------|
| Point Unit | ❌ |
| EXP Mode | ❌ |
| LP Formula | ❌ |
| Payout Direction | ✅ |
| Admin Fee | ✅ |
| Dasar Perhitungan | ✅ |
| Jenis Perhitungan | ✅ |
| Nilai Bonus | ✅ |
| Minimum Base | ✅ |
| Sub Kategori | ✅ |

**Karakteristik:**
- Reward dihitung berdasarkan formula (% dari TO/Deposit/Win-Loss)
- Mendukung payout direction (ke balance/bonus wallet)
- Dapat memiliki admin fee (untuk referral)
- Tier berdasarkan jumlah nominal

---

### 4. `tier_advanced` - Advanced Mode (Default)
**Use Case:** Promo kompleks dengan multiple tier types

| Field | Visible |
|-------|---------|
| Point Unit | ✅ |
| EXP Mode | ✅ |
| LP Formula | ✅ |
| Payout Direction | ✅ |
| Admin Fee | ✅ |
| Dasar Perhitungan | ✅ |
| Jenis Perhitungan | ✅ |
| Nilai Bonus | ✅ |
| Minimum Base | ✅ |
| Sub Kategori | ✅ |

**Karakteristik:**
- Semua field visible
- Untuk power users yang membutuhkan kontrol penuh
- Backward compatible dengan data lama
- Default selection untuk promo existing

---

## Field Visibility Matrix

```
┌─────────────────────┬───────────┬────────────────┬──────────────┬──────────────┐
│ Field               │ tier_level│ tier_point_store│ tier_formula │ tier_advanced│
├─────────────────────┼───────────┼────────────────┼──────────────┼──────────────┤
│ Point Unit          │     ❌    │       ✅       │      ❌      │      ✅      │
│ EXP Mode            │     ❌    │       ✅       │      ❌      │      ✅      │
│ LP Formula          │     ❌    │       ✅       │      ❌      │      ✅      │
│ Payout Direction    │     ❌    │       ❌       │      ✅      │      ✅      │
│ Admin Fee           │     ❌    │       ❌       │      ✅      │      ✅      │
│ Dasar Perhitungan   │     ❌    │       ✅       │      ✅      │      ✅      │
│ Jenis Perhitungan   │     ❌    │       ✅       │      ✅      │      ✅      │
│ Nilai Bonus         │     ❌    │       ✅       │      ✅      │      ✅      │
│ Minimum Base        │     ❌    │       ✅       │      ✅      │      ✅      │
│ Sub Kategori        │     ✅    │       ✅       │      ✅      │      ✅      │
└─────────────────────┴───────────┴────────────────┴──────────────┴──────────────┘
```

---

## UI Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      REWARD MODE SELECTOR                        │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐                        │
│  │  Fixed  │   │   Tier  │   │ Dinamis │                        │
│  └─────────┘   └────┬────┘   └─────────┘                        │
│                     │                                            │
│                     ▼                                            │
│         ┌───────────────────────┐                               │
│         │  TIER ARCHETYPE       │                               │
│         │  SELECTOR             │                               │
│         └───────────┬───────────┘                               │
│                     │                                            │
│    ┌────────────────┼────────────────┬──────────────┐           │
│    ▼                ▼                ▼              ▼           │
│ ┌──────────┐  ┌────────────┐  ┌───────────┐  ┌──────────┐      │
│ │tier_level│  │tier_point_ │  │tier_      │  │tier_     │      │
│ │          │  │store       │  │formula    │  │advanced  │      │
│ └────┬─────┘  └─────┬──────┘  └─────┬─────┘  └────┬─────┘      │
│      │              │               │             │             │
│      ▼              ▼               ▼             ▼             │
│ ┌──────────┐  ┌────────────┐  ┌───────────┐  ┌──────────┐      │
│ │Level/    │  │Point Store │  │Payout +   │  │ALL       │      │
│ │Milestone │  │Config:     │  │Admin Fee +│  │FIELDS    │      │
│ │Info Box  │  │- Point Unit│  │Dasar +    │  │VISIBLE   │      │
│ │          │  │- EXP Mode  │  │Jenis +    │  │          │      │
│ │          │  │- LP Formula│  │Nilai +    │  │          │      │
│ │          │  │+ Dasar etc │  │Min Base   │  │          │      │
│ └──────────┘  └────────────┘  └───────────┘  └──────────┘      │
│                     │                                            │
│                     ▼                                            │
│         ┌───────────────────────┐                               │
│         │  SUB KATEGORI TOGGLE  │                               │
│         │  (Combo Promo)        │                               │
│         └───────────┬───────────┘                               │
│                     │                                            │
│                     ▼                                            │
│         ┌───────────────────────┐                               │
│         │  SUB CATEGORY CARDS   │                               │
│         │  (if enabled)         │                               │
│         └───────────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### PromoFormData (Tier-related fields)

```typescript
interface PromoFormData {
  // Reward Mode (top-level selector)
  reward_mode: 'fixed' | 'tier' | 'formula';
  
  // Tier Archetype (UI-gating only, optional for backward compat)
  tier_archetype?: 'tier_level' | 'tier_point_store' | 'tier_formula' | 'tier_advanced';
  
  // Point Store fields
  promo_unit: 'lp' | 'exp' | 'hybrid';
  exp_mode: 'level_up' | 'exp_store' | 'both';
  lp_formula: string;
  
  // Formula fields
  payout_direction: string;
  admin_fee_enabled: boolean;
  admin_fee_percentage: number;
  calculation_base: string;
  calculation_method: string;
  calculation_value: number;
  minimum_base: number;
  
  // Sub Categories
  has_subcategories: boolean;
  subcategories: PromoSubCategory[];
}
```

---

## Gating Logic (Code Reference)

```typescript
// src/components/VOCDashboard/PromoFormWizard/Step3Reward.tsx

// Tier Archetype field visibility helpers (UI-gating only)
const tierArchetype = data.tier_archetype || 'tier_advanced';
const showLevelFields = tierArchetype === 'tier_level' || tierArchetype === 'tier_advanced';
const showPointStoreFields = tierArchetype === 'tier_point_store' || tierArchetype === 'tier_advanced';
const showFormulaFields = tierArchetype === 'tier_formula' || tierArchetype === 'tier_advanced';

// Point Store Config - visible only for tier_point_store
{data.tier_archetype === 'tier_point_store' && (
  <PointStoreConfiguration />
)}

// Level/Milestone Config - visible only for tier_level
{data.tier_archetype === 'tier_level' && (
  <LevelMilestoneConfiguration />
)}

// Payout Direction + Admin Fee - visible for tier_formula and tier_advanced
{showFormulaFields && (
  <PayoutDirectionFields />
)}

// Dasar Perhitungan etc - visible for tier_point_store, tier_formula, tier_advanced
{(showPointStoreFields || showFormulaFields) && (
  <CalculationFields />
)}
```

---

## Example Promo Configurations

### 1. NALEN (Naik Level) - `tier_level`
```json
{
  "promo_name": "NALEN Bronze → Silver",
  "reward_mode": "tier",
  "tier_archetype": "tier_level",
  "has_subcategories": true,
  "subcategories": [
    { "name": "Bronze → Silver", "reward_amount": 50000 },
    { "name": "Silver → Gold", "reward_amount": 100000 },
    { "name": "Gold → Platinum", "reward_amount": 200000 }
  ]
}
```

### 2. LP Store - `tier_point_store`
```json
{
  "promo_name": "LP Store Mingguan",
  "reward_mode": "tier",
  "tier_archetype": "tier_point_store",
  "promo_unit": "lp",
  "exp_mode": "exp_store",
  "lp_formula": "1 LP = Rp 1.000 deposit",
  "calculation_base": "deposit",
  "calculation_method": "percentage",
  "calculation_value": 0.1
}
```

### 3. Weekly Cashback - `tier_formula`
```json
{
  "promo_name": "Cashback Mingguan 0.8%",
  "reward_mode": "tier",
  "tier_archetype": "tier_formula",
  "payout_direction": "bonus_wallet",
  "calculation_base": "turnover",
  "calculation_method": "percentage",
  "calculation_value": 0.8,
  "minimum_base": 1000000
}
```

---

## Important Notes

1. **tier_archetype is UI-only** - It does NOT affect PKB storage or backend behavior
2. **Default is tier_advanced** - For backward compatibility with existing promos
3. **Sub Kategori always available** - All archetypes can use sub-categories
4. **Formula fields shared** - `tier_point_store` and `tier_formula` share some calculation fields

---

## tier_network Semantic Contract (Referral Bonus)

### Overview
`tier_archetype: 'tier_network'` is exclusively for **Referral Bonus** promos where the tier metric is based on **network size** (number of active downlines), NOT financial amounts.

### Data Contract

| Aspect | Field | Source |
|--------|-------|--------|
| Tier Metric | `min_downline` | `referral_tiers[n].min_downline` |
| Tier Reward | `commission_percentage` | `referral_tiers[n].commission_percentage` |
| Calculation Basis | `loss` / `turnover` / `deposit` | `referral_calculation_basis` (PROGRAM-LEVEL) |
| Admin Fee | `20%` (typical) | `referral_admin_fee_percentage` (PROGRAM-LEVEL) |

### INERT Fields (Must NOT be used)
These generic fields MUST be set to inert values for `tier_network`:

```json
{
  "reward_type": null,
  "reward_amount": null,
  "max_claim": null,
  "calculation_base": "",
  "calculation_method": "",
  "calculation_value": null,
  "admin_fee_enabled": false,
  "admin_fee_percentage": null,
  "formula_metadata": null,
  "min_deposit": null,
  "turnover_rule": ""
}
```

### Valid Referral-Specific Fields
Only these fields are the source of truth for tier_network:

```json
{
  "referral_tiers": [
    {
      "tier_label": "Komisi 5%",
      "min_downline": 5,
      "commission_percentage": 5,
      "winlose": 10000000,
      "cashback_deduction": 700000,
      "fee_deduction": 300000,
      "net_winlose": 8500000,
      "commission_result": 425000
    }
  ],
  "referral_calculation_basis": "loss",
  "referral_admin_fee_enabled": true,
  "referral_admin_fee_percentage": 20
}
```

⚠️ **KONTRAK SEMANTIK KUNCI**:
Field `winlose`, `cashback_deduction`, `fee_deduction`, `net_winlose`, `commission_result` adalah **ATURAN FINAL PROMO**, bukan sample/contoh!
Jika tabel promo TIDAK mengandung kata "misalkan" atau "contoh", semua angka adalah HUKUM yang mengikat.

### custom_terms Contract
For Referral promos, `custom_terms` MUST contain ONLY:
- ✅ Legal/T&C statements
- ✅ Narrative descriptions
- ✅ Prohibitions (larangan)
- ✅ Rights & obligations

It MUST NOT contain:
- ❌ Tier percentages or min_downline values (already in `referral_tiers[]`)
- ❌ Formulas or calculation examples
- ❌ Admin fee percentages (already in `referral_admin_fee_percentage`)
- ❌ Simulation tables or sample calculations

### Resolver Guard
The `isTierNetworkPromo()` helper function in `promo-field-resolver.ts` guards all resolvers to return INERT values for tier_network, preventing accidental reads from generic fields.

---

## Field Definitions (LOCKED)

### Referral Tier Fields

| Field | Type | Definition |
|-------|------|------------|
| `winlose` | **RULE** | Nilai Winlose mentah (basis perhitungan komisi) |
| `cashback_deduction` | **RULE** | Potongan cashback yang mengurangi base winlose sebelum perhitungan komisi |
| `fee_deduction` | **RULE** | Potongan admin fee yang mengurangi base winlose sebelum perhitungan komisi |
| `commission_percentage` | **RULE** | Persentase komisi untuk tier ini (e.g., 5 = 5%) |
| `min_downline` | **RULE** | Syarat minimal jumlah downline aktif untuk tier ini |
| `net_winlose` | **DERIVED** | = `winlose - cashback_deduction - fee_deduction` |
| `commission_result` | **DERIVED** | = `net_winlose * commission_percentage / 100` |

### Derived Fields Policy (LOCKED)

**Decision**: Derived fields **disimpan DAN divalidasi** (auto-correct jika mismatch).

**Alasan**:
1. Menyimpan derived values memudahkan display di UI tanpa recalc
2. Validator memastikan konsistensi dengan RULE fields
3. Auto-correct mencegah data corruption dari extraction errors

**Validator Contract**:
```typescript
// RUMUS WAJIB (tidak bisa ditawar)
net_winlose = winlose - cashback_deduction - fee_deduction
commission_result = net_winlose * commission_percentage / 100

// Jika mismatch:
// 1. Log warning untuk audit
// 2. Auto-correct ke nilai yang benar
// 3. Simpan nilai yang sudah dikoreksi
```

### Deduction Semantics (LOCKED)

**Definition**: `cashback_deduction` dan `fee_deduction` adalah **POTONGAN DARI BASE WINLOSE** sebelum persentase komisi dihitung.

**Formula Flow**:
```
Winlose (dari downline)
  └── minus: cashback_deduction (potongan untuk program cashback)
  └── minus: fee_deduction (potongan admin fee operator)
  = Net Winlose
  └── kali: commission_percentage%
  = Commission Result (yang diterima referrer)
```

**UI Label Contract**:
- "Cashback (potongan dari WL)" 
- "Admin Fee (potongan dari WL)"
- "Winlose Bersih (setelah potongan)"

---

## _rule_source Enum (LOCKED)

Valid values:
- `table` - Data dari tabel promo yang terstruktur
- `manual` - Input manual oleh user
- `inferred` - Disimpulkan dari konteks/pattern

**TIDAK BOLEH** ada string bebas. Enum ini harus terbatas.

---

## Commission Backstop (NEW)

Untuk mencegah bug nondeterministic dimana semua tier menunjukkan persentase yang sama (contoh: semua 5%):

**Multi-Source Fallback Priority**:
1. `calculation_value` dari LLM (jika unik antar tier)
2. `sub_name` pattern (contoh: "Komisi 10%" → 10)
3. `terms_conditions` pattern
4. Positional inference (tier 1 = 5%, tier 2 = 10%, tier 3 = 15%)

**Detection**: Jika semua `commission_percentage` sama pada multi-tier promo, sistem akan:
1. Log warning: `[Referral Backstop] All-same bug detected`
2. Apply backstop dari sub_name atau positional pattern
3. Set audit metadata: `_commission_fix_applied: true`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-01 | Initial tier archetype system |
| 1.1 | 2025-01-25 | Added Point Store & Level/Milestone config sections |
| 1.2 | 2026-01-03 | Added tier_network (Referral) semantic contract, INERT field rules, custom_terms cleaner |
| 1.3 | 2026-01-03 | Added Field Definitions, Derived Fields Policy, Deduction Semantics, Commission Backstop |
| 1.4 | 2026-01-03 | Added Calculator Contract - DERIVED fields now calculated ONLY by referral-tier-calculator.ts |

---

## Calculator Contract (LOCKED)

### Separation of Concerns

| Layer   | Responsibility           | Who              |
|---------|--------------------------|------------------|
| RULE    | Raw data from table      | Extractor        |
| FORMULA | Math rules (metadata)    | Extractor        |
| DERIVED | Calculated results       | Calculator ONLY  |

### Rule of Authority

1. **Extractor** ONLY saves RULE fields + FORMULA metadata
2. **Derived fields** MUST be `null` during extraction
3. **Calculator** (`referral-tier-calculator.ts`) is the ONLY entity allowed to calculate derived
4. **LLM** is NEVER trusted for business arithmetic

### Formula Contract (Referral tier_network)

```
net_winlose = winlose - cashback_deduction_amount - admin_fee_deduction_amount
commission_result = net_winlose * commission_percentage / 100
```

**Calculated by:** `src/lib/referral-tier-calculator.ts`  
**NOT by:** Extractor, LLM, or UI

### Calculation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXTRACTION PHASE                         │
├─────────────────────────────────────────────────────────────────┤
│  Extractor reads promo table/text                               │
│  ↓                                                              │
│  Saves RULE fields: winlose, cashback_deduction_amount,         │
│                     admin_fee_deduction_amount, commission_%    │
│  ↓                                                              │
│  Sets DERIVED fields: net_winlose = null, commission_result = null │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        SAVE PHASE (buildPKBPayload)             │
├─────────────────────────────────────────────────────────────────┤
│  Calls calculateAllReferralTiers() from referral-tier-calculator│
│  ↓                                                              │
│  Calculator computes:                                           │
│    net_winlose = winlose - cashback - admin_fee                 │
│    commission_result = net_winlose * commission% / 100          │
│  ↓                                                              │
│  DERIVED fields now populated with deterministic values         │
│  ↓                                                              │
│  Adds audit trail: _calculated_by = 'calculator'                │
└─────────────────────────────────────────────────────────────────┘
```

### Field Naming (v1.4)

| Old Name | New Name | Purpose |
|----------|----------|---------|
| `cashback_deduction` | `cashback_deduction_amount` | Cashback deduction from WL |
| `fee_deduction` | `admin_fee_deduction_amount` | Admin fee deduction from WL |

Both old and new names are supported for backward compatibility.

### Validation Contract

Before calculation, the validator (`referral-tier-validator.ts`) checks:
1. ✅ RULE fields exist and are valid
2. ✅ DERIVED fields are `null` (not pre-calculated by extractor)
3. ⚠️ Logs warnings if derived fields were already populated (contract violation)
