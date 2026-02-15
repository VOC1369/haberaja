

# Fix 4 Remaining Gaps — Faithful to Original Terms

4 patch di `src/lib/openai-extractor.ts`. Semua berdasarkan evidence eksplisit dari terms asli.

---

## Fix 1: `turnover_basis` — Tambah Pattern "Bonus -> TO"

**Evidence dari terms:**
> "Contoh: Bonus dari Lucky Spin Rp50.000 -> Turn Over yang dibutuhkan untuk withdraw = Rp50.000 x 2 = Rp100.000"

Ini jelas: TO dihitung dari BONUS, bukan deposit.

**Lokasi**: `detectTurnoverBasis()` (~line 3394)

Tambah pattern baru sebelum fallback ambiguity:

```typescript
// Pattern: "Bonus RpX → TO = RpX × N" (basis = bonus amount, not deposit)
if (/bonus\s*(?:dari\s*)?(?:lucky\s*spin\s*)?rp[\d.,]+\s*[→\->]+\s*(?:turn\s*over|to)\s*(?:yang\s*)?/i.test(termsText) ||
    /(?:turn\s*over|to)\s*=\s*(?:bonus|rp[\d.,]+)\s*[×x]\s*\d/i.test(termsText)) {
  return { basis: 'bonus', has_turnover: true, ambiguity: false };
}
```

Ini akan menghasilkan:
- `turnover_basis: "bonus"` (bukan null)
- `turnover_ambiguity: false` (bukan true)

---

## Fix 2: `collection_requirement` — Tambah `eligible_rewards` dan `require_same_image`

**Evidence dari terms:**
> "gambar dari Lucky Spin seperti Handphone, Laptop, & Emas"
> "mengumpulkan 3 gambar yang sama"

**Lokasi**: Collection requirement block (~line 3528-3545)

Perluas extraction untuk menangkap eligible rewards dan "yang sama" flag:

```typescript
if (collectMatch) {
  const count = parseInt(collectMatch[1], 10);
  const periodMatch = termsText.match(
    /(?:batas\s*waktu|dalam|within)\s*[:.]?\s*(\d+)\s*(bulan|hari|minggu|month|day|week)/i
  );
  
  // Extract eligible reward items (e.g., "Handphone, Laptop, & Emas")
  const rewardItemsMatch = termsText.match(
    /(?:gambar\s*(?:dari\s*)?(?:lucky\s*spin\s*)?seperti)\s*([^.;]+)/i
  );
  const eligibleRewards = rewardItemsMatch 
    ? rewardItemsMatch[1]
        .split(/[,&]/)
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
    : [];
  
  // Detect "yang sama" = require same image
  const requireSame = /gambar\s*(?:yang\s*)?sama/i.test(termsText);
  
  collectionRequirement = {
    same_image_count: count,
    collection_period: periodMatch 
      ? `${periodMatch[1]}_${periodMatch[2]...}` 
      : null,
    require_same_image: requireSame,
    eligible_rewards: eligibleRewards.length > 0 ? eligibleRewards : undefined,
    reward_condition: `${count}_identical_images`,
  };
}
```

Result:
```json
"collection_requirement": {
  "same_image_count": 3,
  "collection_period": "1_month",
  "require_same_image": true,
  "eligible_rewards": ["handphone", "laptop", "emas"],
  "reward_condition": "3_identical_images"
}
```

---

## Fix 3: `daily_reset_time` — Tambah Fallback Pattern

Regex saat ini sudah menangkap "direset pada pukul 23:59", tapi mungkin gagal jika format terms sedikit beda (misalnya "direset pukul 23:59" tanpa "pada", atau "di reset" dengan spasi).

**Lokasi**: ~line 3504-3511

Tambah fallback pattern yang lebih permisif:

```typescript
const resetMatch = termsText.match(
  /(?:di)?reset\s*(?:pada\s*)?(?:pukul|jam)\s*(\d{1,2}[:.]\d{2})/i
) || termsText.match(
  /(?:dimulai|mulai)\s*(?:pukul|jam)?\s*(\d{1,2}[:.]\d{2})/i
) || termsText.match(
  /(?:pukul|jam)\s*(\d{1,2}[:.]\d{2})\s*(?:wib|wit|wita)/i
);
```

Fallback ketiga menangkap pattern "pukul 23:59 WIB" di mana pun posisinya dalam kalimat.

---

## Summary

| # | Fix | Field | Dari | Ke |
|---|-----|-------|------|----|
| 1 | Turnover basis detection | `turnover_basis` | `null` | `"bonus"` |
| 1b | Auto-resolve | `turnover_ambiguity` | `true` | `false` |
| 2 | Collection enrichment | `collection_requirement` | `null` | `{...full object}` |
| 3 | Reset time fallback | `daily_reset_time` | `null` | `"23:59 WIB"` |

Satu file. Tiga block edit. Zero refactor.

