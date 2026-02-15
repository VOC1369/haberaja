
# Fix 4 Enrichment Helpers — Precision Patches

4 perbaikan kecil di 1 file: `src/lib/openai-extractor.ts`. Tidak ada refactor, tidak ada layer baru.

## Fix 1: Normalize `claim_channels` — buang raw sentence

**Problem**: `extractClaimChannels()` menambahkan `extracted.claim_method` as-is (raw string seperti "Telegram, Livechat, & WhatsApp SPONTAN77") ke array, lalu `new Set()` tidak bisa deduplicate karena beda format.

**Fix** (line 3423): Jangan push `claim_method` mentah. Jalankan regex scan yang sama pada `claim_method` string, sehingga hanya normalized tokens yang masuk.

```typescript
// BEFORE:
if (extracted.claim_method) channels.push(extracted.claim_method);

// AFTER:
if (extracted.claim_method) {
  const cm = extracted.claim_method;
  if (/telegram/i.test(cm)) channels.push('telegram');
  if (/livechat|live\s*chat/i.test(cm)) channels.push('livechat');
  if (/whatsapp|wa\b/i.test(cm)) channels.push('whatsapp');
  if (/\bline\b/i.test(cm)) channels.push('line');
  if (/\bcs\b|customer\s*service/i.test(cm)) channels.push('customer_service');
}
```

Result: `["telegram","livechat","whatsapp"]` -- bersih, tanpa duplikat.

---

## Fix 2: `daily_reset_time` — tambah regex untuk "direset pukul"

**Problem**: Regex saat ini hanya match `reset pukul/jam`, tapi terms bilang "direset pada pukul 23:59 WIB" yang mengandung kata "pada" di tengah.

**Fix** (line 3497): Perluas regex pattern agar menangkap lebih banyak variasi bahasa Indonesia.

```typescript
// BEFORE:
const resetMatch = termsText.match(/(?:reset|dimulai|mulai)\s*(?:pukul|jam)?\s*(\d{1,2}[:.]\d{2})/i);

// AFTER:
const resetMatch = termsText.match(
  /(?:di)?reset\s*(?:pada\s*)?(?:pukul|jam)\s*(\d{1,2}[:.]\d{2})/i
) || termsText.match(
  /(?:dimulai|mulai)\s*(?:pukul|jam)?\s*(\d{1,2}[:.]\d{2})/i
);
```

Kemudian tambahkan suffix WIB jika terdeteksi:

```typescript
const dailyResetTime = resetMatch 
  ? resetMatch[1].replace('.', ':') + (/wib/i.test(termsText) ? ' WIB' : '')
  : null;
```

Result: `"daily_reset_time": "23:59 WIB"`

---

## Fix 3: `claim_window` — tambah pattern "di akhir hari"

**Problem**: Regex hanya match time-based patterns (`berlaku hingga 23:00`), tapi terms bilang "diklaim di akhir hari" yang merupakan semantic phrase, bukan timestamp.

**Fix** (line 3500-3504): Tambah semantic fallback setelah time-based match.

```typescript
// BEFORE:
const windowMatch = termsText.match(/(?:berlaku|valid|klaim)\s*(?:hingga|sampai|s\.?d\.?)\s*(\d{1,2}[:.]\d{2})/i);
const claimWindow = windowMatch 
  ? { end: windowMatch[1].replace('.', ':') } 
  : null;

// AFTER:
const windowTimeMatch = termsText.match(/(?:berlaku|valid|klaim)\s*(?:hingga|sampai|s\.?d\.?)\s*(\d{1,2}[:.]\d{2})/i);
const claimWindow = windowTimeMatch 
  ? { end: windowTimeMatch[1].replace('.', ':') } 
  : /(?:diklaim|klaim)\s*(?:di\s*)?(?:akhir|penghujung)\s*hari/i.test(termsText)
    ? { end: 'end_of_day' }
    : /(?:hari\s*yang\s*sama|same\s*day)/i.test(termsText)
      ? { end: 'same_day' }
      : null;
```

Result: `"claim_window": { "end": "end_of_day" }`

---

## Fix 4: `collection_requirement` — extract dari terms

**Problem**: Payload hanya punya `"collection_mechanic": "spin"` tapi terms menjelaskan mechanic hybrid: kumpulkan 3 gambar yang sama dalam 1 bulan.

**Fix** (setelah line 3509, sebelum payload build): Tambah extraction logic untuk collection lifecycle.

```typescript
// --- Collection requirement (hybrid spin + collect) ---
let collectionRequirement: Record<string, unknown> | null = null;
const collectMatch = termsText.match(
  /(?:kumpulkan|mengumpulkan|collect)\s*(\d+)\s*(?:gambar|image|item)/i
);
if (collectMatch) {
  const count = parseInt(collectMatch[1], 10);
  const periodMatch = termsText.match(
    /(?:batas\s*waktu|dalam|within)\s*[:.]?\s*(\d+)\s*(bulan|hari|minggu|month|day|week)/i
  );
  collectionRequirement = {
    same_image_count: count,
    collection_period: periodMatch 
      ? `${periodMatch[1]}_${periodMatch[2].replace('bulan','month').replace('hari','day').replace('minggu','week')}` 
      : null,
    reward_condition: `${count}_identical_images`,
  };
}
```

Lalu tambahkan ke payload object:

```typescript
const payload: Record<string, unknown> = {
  spin_limit: spinLimit,
  deposit_requirement: depositRequirement,
  daily_reset_time: dailyResetTime,
  claim_window: claimWindow,
  collection_mechanic: collectionMechanic,
  collection_requirement: collectionRequirement,  // NEW
};
```

Result:
```json
"collection_requirement": {
  "same_image_count": 3,
  "collection_period": "1_month",
  "reward_condition": "3_identical_images"
}
```

---

## Summary

| # | Fix | File | Lines |
|---|-----|------|-------|
| 1 | Normalize claim_channels | openai-extractor.ts | ~3423 |
| 2 | daily_reset_time regex | openai-extractor.ts | ~3497-3498 |
| 3 | claim_window semantic | openai-extractor.ts | ~3500-3504 |
| 4 | collection_requirement | openai-extractor.ts | ~3506-3517 |

Satu file. Empat patch. Zero refactor.
