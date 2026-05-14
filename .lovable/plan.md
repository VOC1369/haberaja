

# Fix: Complete Round-Trip Integrity (5 Remaining Gaps)

## Masalah
Setelah import canonical JSON v2.1 lalu edit dan export, masih ada 5 field yang hilang/berubah. Fix #1 dan #2 sudah diapprove sebelumnya, fix #3-#5 adalah temuan baru.

## 5 Fixes dalam 1 File

### File: `src/components/VOCDashboard/PromoFormWizard/types.ts`

### Fix 1 — `calculation_basis` hilang (APPROVED, belum implemented)

Di `buildCanonicalPayload()`, setelah line `canonical.calculation_basis = data.calculation_base || '';`:

```
if (!canonical.calculation_basis && data.tier_archetype === 'tier_point_store') {
  canonical.calculation_basis = 'loyalty_point';
}
```

### Fix 2 — `conversion_formula` hilang (APPROVED, belum implemented)

Di `buildCanonicalPayload()`, setelah `canonical.conversion_formula = data.conversion_formula || '';`:

```
if (!canonical.conversion_formula && data.tier_archetype === 'tier_point_store') {
  const basis = data.lp_earn_basis || 'turnover';
  const amount = data.lp_earn_amount || 1000;
  const points = data.lp_earn_point_amount || 1;
  canonical.conversion_formula = `IDR ${amount.toLocaleString('id-ID')} ${basis} = ${points} LP. LP ditukar sesuai tabel tier.`;
}
```

### Fix 3 — `max_claim_unlimited` berubah dari false ke true (BARU)

Root cause: Di `normalizePromoData()` line ~2001, `max_bonus_unlimited = true` otomatis set `dinamis_max_claim_unlimited = true`. Lalu di export line ~1362, `canonical.max_claim_unlimited = data.dinamis_max_claim_unlimited || ...` jadi `true`.

Tapi `max_bonus_unlimited` dan `max_claim_unlimited` adalah 2 field berbeda di canonical:
- `max_bonus_unlimited` = tidak ada batas reward per claim
- `max_claim_unlimited` = tidak ada batas jumlah klaim

Fix: Di `buildCanonicalPayload()`, prioritaskan `data.max_claim_unlimited` langsung jika ada:

```
canonical.max_claim_unlimited = data.max_claim_unlimited ?? data.dinamis_max_claim_unlimited ?? data.fixed_max_claim_unlimited ?? false;
```

Dan di `normalizePromoData()` Section 0, hydrate `max_claim_unlimited` ke form field terpisah (jangan merge dengan `dinamis_max_claim_unlimited`).

### Fix 4 — `game_scope = "all"` hilang jadi `""` (BARU)

Root cause: Canonical `game_scope` dimapping ke form `game_restriction` saat export (line 1394: `canonical.game_scope = data.game_restriction || ''`). Tapi di import/hydration (Section 0), tidak ada mapping `game_scope -> game_restriction`.

Fix: Di `normalizePromoData()` Section 0, tambahkan:

```
// 0k. game_scope → game_restriction hydration
if ((raw.game_scope as string) && !normalized.game_restriction) {
  const scopeMap: Record<string, string> = { 'all': 'semua', 'specific': 'tertentu' };
  normalized.game_restriction = scopeMap[(raw.game_scope as string).toLowerCase()] || (raw.game_scope as string);
}
```

### Fix 5 — Rich tier fields hilang (`tier_group`, `max_claim_per_month`, `note`) (BARU)

Root cause: Tier konversi di Section 0f hanya ambil 4 field dasar. Rich fields dari Claude (tier_group, max_claim_per_month, note) dibuang.

Fix: Di Section 0f tier conversion, preserve extra fields ke `extra` object di UniversalTier:

Dan di `buildCanonicalPayload()` tier export section, pastikan `extra` field dari tiers di-preserve.

Juga di Section 0f, saat convert canonical tiers ke form tiers, simpan rich fields:

```
// In tier conversion, preserve additional fields
const extraFields: Record<string, unknown> = {};
for (const [k, v] of Object.entries(t)) {
  if (!['tier_id', 'tier_name', 'tier_order', 'lp_required', 'requirement_value', 
        'reward_amount', 'reward_value', 'reward_type', 'turnover_multiplier', 'extra'].includes(k)) {
    extraFields[k] = v;
  }
}
// Merge with existing extra
return {
  ...basicTierFields,
  extra: { ...(t.extra as Record<string, unknown> || {}), ...extraFields }
};
```

## Dampak
- 1 file diubah: `types.ts`
- ~30 baris tambahan (5 fixes kecil)
- Backward compatible
- Setelah fix, canonical JSON yang diimport akan round-trip dengan benar (kecuali normalisasi casing yang by design)
