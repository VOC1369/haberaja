

# Fix: Debug Trace Selalu Muncul (Client-Side Fallback)

## Masalah

Pesan "Debug data tidak tersedia untuk response ini" muncul karena LLM tidak selalu menyertakan section `---DEBUG---` di response-nya, meskipun sudah diminta. Ini terjadi karena:
- LLM kadang "lupa" di response pertama
- Response yang panjang membuat LLM memotong bagian debug
- Tidak ada jaminan 100% LLM patuh pada instruksi format

## Solusi: Dual-Layer Debug

Tambahkan **client-side fallback** yang otomatis membuat debug trace dari data yang sudah tersedia di frontend, sehingga trace SELALU muncul saat debug mode aktif.

**Layer 1** (tetap): Parse `---DEBUG---` dari LLM response (kalau ada)
**Layer 2** (baru): Jika LLM tidak menyertakan debug, buat trace lokal dari:
- KB JSON fields yang ada di promo yang dipilih
- User message terakhir
- Response assistant

## Perubahan

### 1. Tambah fungsi `buildClientDebug` di `livechat-engine.ts`

Fungsi baru yang membuat DebugBreakdown secara lokal:
- Scan user message untuk angka/keyword yang match atau mismatch dengan KB fields
- Cek field-field utama seperti `max_bonus`, `min_deposit`, `reward_amount`, `turnover_multiplier`
- Bandingkan angka yang disebut user vs nilai di KB
- Generate trace sederhana: fields referenced, match/mismatch status, confidence

### 2. Update `streamChat` callback flow

Di bagian `onDone`:
- Jika `---DEBUG---` ada di response → parse seperti biasa (Layer 1)
- Jika tidak ada → panggil `buildClientDebug(userMessage, assistantResponse, promoData)` sebagai fallback (Layer 2)
- Debug panel selalu mendapat data, tidak pernah kosong

### 3. Update `LivechatTestConsole.tsx`

- Pass `selectedPromo` ke streaming flow supaya client-side debug bisa akses KB data
- Update `streamChat` signature untuk menerima parameter promo data

### 4. Update `DebugPanel.tsx`

- Tambah indikator kecil: "[LLM trace]" vs "[Client trace]" supaya bisa dibedakan sumbernya
- Warna badge berbeda untuk membedakan

## Detail Teknis

### Files yang diubah:
- `src/lib/livechat-engine.ts` — tambah `buildClientDebug()`, update `streamChat` signature
- `src/components/VOCDashboard/LivechatTestConsole.tsx` — pass promo data ke stream
- `src/components/VOCDashboard/DebugPanel.tsx` — tambah source indicator

### Client-side debug logic:
- Extract angka dari user message menggunakan regex
- Bandingkan dengan nilai KB fields (`max_bonus`, `min_deposit`, `reward_amount`, dll)
- Cek apakah response assistant menyebut nilai yang konsisten dengan KB
- Generate confidence: "sangat tinggi" jika semua match, "rendah" jika ada mismatch

### Tidak ada breaking changes:
- Fallback hanya aktif saat debug mode ON dan LLM tidak menyediakan trace
- Kalau LLM menyediakan trace, tetap pakai yang dari LLM (lebih detail)
- Debug panel UI tetap sama, hanya ada label sumber tambahan
