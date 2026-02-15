
# Tambah General KB Toggle + Semua Promo di Livechat Test Console

## Apa yang berubah

Di header Livechat Test Console, ditambahkan 2 kontrol baru:

1. **General KB toggle (ON/OFF)** — Switch untuk menyertakan data General Knowledge Base ke system prompt. Default OFF.
2. **Opsi "Semua Promo" di dropdown Promo** — Selain pilih satu promo, user bisa pilih "Semua Promo" untuk inject semua promo KB sekaligus ke system prompt.

## Perubahan UI (LivechatTestConsole.tsx)

### Header Controls (baris baru)
- Tambah state `generalKBEnabled` (boolean, default false)
- Tambah Switch "General KB" di sebelah Switch "Debug"
- Di dropdown Promo, tambah opsi `all` = "-- Semua Promo --" di antara "Tanpa Promo" dan daftar individual
- Update logic `selectedPromo`:
  - `none` = null (tidak ada promo)
  - `all` = semua promo array
  - ID tertentu = single promo

### Empty state text
- Update placeholder text untuk mencerminkan opsi baru ("Toggle General KB, pilih promo...")

## Perubahan Engine (livechat-engine.ts)

### buildSystemPrompt signature
- Tambah parameter `options: { generalKBEnabled?: boolean; allPromos?: PromoItem[] }`
- Jika `generalKBEnabled = true`, load General KB dari storage dan inject sebagai section baru di system prompt:
  ```
  # GENERAL KNOWLEDGE BASE
  Berikut referensi FAQ umum yang bisa kamu gunakan untuk menjawab:
  [JSON array of {question, answer, category}]
  ```
- Jika `allPromos` diberikan (mode "Semua Promo"), loop semua promo dan build KB context gabungan (ringkasan per promo, bukan full dump per promo agar tidak terlalu panjang)

### buildAllPromosContext (fungsi baru)
- Mengambil array PromoItem[], build ringkasan tiap promo:
  ```
  # KNOWLEDGE BASE — Semua Promo (X promo)
  ## 1. [promo_name]
  ```json
  { ...fields }
  ```
  ## 2. [promo_name]
  ...
  ```
- KB Health di-skip untuk mode semua promo (terlalu banyak)

## Perubahan di executeSend (LivechatTestConsole.tsx)

- Saat memanggil `buildSystemPrompt`, pass parameter baru:
  - `generalKBEnabled`
  - Jika `selectedPromoId === "all"`, pass `allPromos: promos`
  - Jika single promo, behavior sama seperti sekarang

## Technical Details

| Item | Detail |
|------|--------|
| Files diubah | 2 (`LivechatTestConsole.tsx`, `livechat-engine.ts`) |
| New dependency | Tidak ada |
| General KB loader | `getGeneralKnowledge()` dari `src/types/knowledge.ts` |
| Promo "all" mode | Concat semua promo context ke system prompt |
| General KB format di prompt | JSON array `[{question, answer, category}]` |
