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

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-01 | Initial tier archetype system |
| 1.1 | 2025-01-25 | Added Point Store & Level/Milestone config sections |
