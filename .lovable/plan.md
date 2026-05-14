# Hard Cutover — PseudoKnowledgeSection V.10.1-Only Display

Sebelum eksekusi, saya butuh konfirmasi karena cutover ini menyentuh ~50 lokasi di `PseudoKnowledgeSection.tsx` (2614 baris) dan akan mengosongkan beberapa section UI secara visible.

## Scope yang akan dipotong (display only)

**A. Hapus mappedPreview total**
- `useMemo mappedPreview` (L183–218)
- `mappedPreviewError` state + alert block (L170, L2440–2450)
- Import `mapExtractedToPromoFormData` (L53)
- 6 display reads: min withdraw row (L1007–1008), voucher validity block (L1281–1287), 2 stale comments

**B. Hapus extractedPromo dari display authority** (~20 display reads)
- Subcategory iteration: `[...extractedPromo.subcategories]` di L1499, 1506, 1582, 1604, 1651–1675 → ganti ke `sel.subcategoryCount(pkRecord)` + per-index selectors
- `getGameTypesSummary(extractedPromo.subcategories)` L1544 → empty state (no V.10.1 path)
- `detectRewardArchetype(extractedPromo)` L1675 → empty state atau drop
- Loyalty exchange table L1821–1859 → cek `loyalty_engine.exchange_block.exchange_groups`, kalau kosong → empty state
- Footer bar render gate L2137, L2371 → ganti ke `pkRecord != null`
- Empty-state gate L1948, L1951 → ganti ke `pkRecord`

**C. State `extractedPromo` TETAP DIPERTAHANKAN** untuk:
- Save draft sync (L303–315)
- Restart gate (L336)
- Edit-command engine (L639–659) — ini mutasi non-display
- onOverride compat sync (L2243–2245)
- Extraction result write (L608)
- Classification override secondary sync

Alasan: spec hanya minta "display authority" V.10.1. State lifecycle (draft sync, edit commands, restart) belum ada equivalent di pkRecord pipeline. Kalau user mau cabut ini juga, scope membesar ke draft/edit-command rewrite.

## Empty states yang akan muncul setelah cutover

| Section | Status | Alasan |
|---|---|---|
| Tabel detail referral (winlose/cashback/fee/komisi) | KOSONG | V.09-only fields, no V.10.1 path |
| Loyalty exchange table | KOSONG kalau `exchange_groups` empty | V.10.1 typed `unknown[]`, schema belum jelas |
| Min withdraw row | HIDDEN | No V.10.1 path |
| Spin duration/mode/unit | DROPPED | V.09 visual residue |
| game_types summary cell di subcategory list | "Belum tersedia" | V.10.1 pakai game_domain (per-variant), beda granularity |
| Reward archetype hint | DROPPED | Detector V.09-shape only |

## Gap Report yang akan dihasilkan

Tabel `| UI section | Missing data | Needed V.10.1 path | Business importance | Recommendation |` ditulis sebagai komentar di file + di chat reply. Recommendation: ADD_FIELD / ADD_EXTRACTOR_FILL / ADD_UI_COMPONENT / DROP_V09_RESIDUE.

## Yang TIDAK disentuh

- Schema (`pk-v10.ts`)
- Extractor (`pk-extractor`, `voc-wolf-extractor`)
- Supabase publish path
- Copy JSON / Save Draft / Publish helpers
- AdminVerify, ReviewGate, FormWizardV10
- Selectors file (kecuali confirm read-only existing selectors)

## Validation setelah cutover

1. `tsc` typecheck
2. Full test suite (`bunx vitest run`)
3. Copy Final JSON regression test (3/3 must pass)
4. Manual count: `extractedPromo` display reads = 0 (state reads OK), `mappedPreview` reads = 0

## Pertanyaan konfirmasi sebelum eksekusi

1. **State `extractedPromo` boleh tetap untuk draft/edit-command?** (Y/N) — kalau N, scope membesar signifikan dan butuh phase terpisah.
2. **Loyalty exchange — kalau `exchange_groups` ada tapi `unknown[]`** — render rows pakai `JSON.stringify(item)` placeholder atau langsung empty state? Saya pilih empty state (lebih jujur).
3. **Subcategory header tetap render** dari `sel.subcategoryCount` walau detail kolom kosong, atau seluruh tabel di-empty-state-kan kalau satu kolom hilang? Saya pilih: header tetap render, kolom yang gap tampilkan "—" + footnote.

Konfirmasi 3 pertanyaan di atas dan saya eksekusi.
