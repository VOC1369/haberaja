# Memory: features/extraction/promo-super-contract-v1-final
Updated: 2025-01-14

## PROMO SUPER CONTRACT v1.0 (FINAL LOCK)

Replaced the Q1-Q4 classification system with a logic-first 3-GATE approach that determines promo status based on **sebab-akibat sistem** (cause-effect system), NOT keywords or writing style.

### Definisi Canonical (TIDAK BOLEH DIBANTAH)

```
Promo = program yang menghasilkan PERUBAHAN STATE yang menguntungkan user,
        ketika KONDISI tertentu terpenuhi (aksi / momen / state),
        dan hubungan tersebut DIKUNCI oleh syarat & ketentuan.

❌ BUKAN ditentukan oleh kata
❌ BUKAN ditentukan oleh gaya bahasa
❌ BUKAN ditentukan oleh format
✅ Ditentukan oleh sebab–akibat sistem
```

### 3 PINTU (3 GATES)

| Gate | Name | Description | Examples |
|------|------|-------------|----------|
| **PINTU 1** | TRIGGER | Kondisi pemicu | action (deposit/withdraw/download), moment (birthday), state (VIP level) |
| **PINTU 2** | BENEFIT | Perubahan state yang menguntungkan | money, credit, percentage, item, chance, access, cost_reduction |
| **PINTU 3** | CONSTRAINTS | Pengunci/syarat yang mengikat | min value, TO, periode, channel klaim, scope |

### Keputusan

```javascript
if (trigger && benefit && constraints) {
  return promoCategory === 'EVENT' ? 'B' : 'A';
}
return 'C'; // System Rule (BUKAN PROMO)
```

### Stress Test Results (ALL PASS)

| Promo | Trigger | Benefit | Constraints | Result |
|-------|---------|---------|-------------|--------|
| Birthday Bonus | moment ✅ | credit ✅ | TO ✅ | PROMO (A) |
| APK Download Freechip | action ✅ | credit ✅ | redeem ✅ | PROMO (A) |
| Deposit Pulsa Tanpa Potongan | action ✅ | cost_reduction ✅ | TO ✅ | PROMO (A) |
| Lucky Spin | action ✅ | chance ✅ | limit ✅ | PROMO (A/B) |
| Event TO Hadiah Mobil | state ✅ | item ✅ | periode ✅ | PROMO (B) |
| Withdraw Bonus 5% | action ✅ | percentage ✅ | min WD ✅ | PROMO (A) |
| WD diproses 1x24 jam | action ✅ | ❌ | ❌ | NOT PROMO (C) |
| Cara hubungi CS | ❌ | ❌ | ❌ | NOT PROMO (C) |

### Larangan Mutlak

- ❌ Jangan pakai keyword sebagai keputusan
- ❌ Jangan pakai gaya bahasa sebagai sinyal utama
- ❌ Jangan patch per promo
- ❌ Jangan asumsi data yang tidak tertulis

### Files Changed

1. `src/lib/extractors/category-classifier.ts` - Core 3-Gate logic
2. `src/components/VOCDashboard/ClassificationOverride.tsx` - UI for 3-Gate display
3. `src/lib/__tests__/promo-super-contract.test.ts` - Unit tests (20 test cases)

### Why This Is Final

1. **Logic-First** - Keputusan berdasarkan sebab-akibat, bukan kata/bahasa
2. **Anti-Halu** - Tidak asumsi, harus ada evidence di 3 pintu
3. **Future-Proof** - Hadiah baru, mekanik baru, tetap masuk ke 3 pintu
4. **No Per-Promo Patch** - Satu logic global untuk semua promo
5. **Backward Compatible** - Legacy Q1-Q4 still exported for UI compatibility
