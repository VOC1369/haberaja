

# Fix: Debug KB Detection — dari Keyword Matching ke LLM Reasoning

## Masalah Inti
`buildClientDebug()` saat ini menggunakan keyword matching murni:
- Split kata, filter panjang > 3, hitung overlap
- Gagal mendeteksi typo, sinonim, parafrase
- Tidak bisa memahami *intent* — hanya cocokkan string

Ini bukan cara kerja AI. Ini cara kerja bot 2015.

## Solusi: Dua Perubahan

### 1. Upgrade LLM Debug Protocol — tambah `[KB Sources Used]`

Saat ini `DEBUG_INSTRUCTION` hanya minta LLM melaporkan field JSON yang dirujuk. LLM tidak diminta secara eksplisit untuk melaporkan **dari KB mana** data diambil.

**Perubahan di `DEBUG_INSTRUCTION`**: Tambahkan section baru `[KB Sources Used]` yang memaksa LLM melaporkan:
- General KB FAQ mana yang digunakan (sebutkan question-nya)
- Behavioral KB rule mana yang diterapkan (sebutkan rule_name)
- Promo field mana yang dirujuk
- Atau "Tidak ada KB match" jika murni dari pengetahuan persona

**Upgrade `parseDebugSection()`**: Parse section `[KB Sources Used]` menjadi array `KBSourceMatch[]` yang sudah ada di interface.

### 2. Ganti Client Fallback — dari Keyword ke Reasoning Call

Hapus seluruh logic keyword matching di `buildClientDebug()`. Ganti dengan **mini LLM reasoning call** (non-streaming, model ringan) yang bertanya:

> "Berdasarkan system prompt yang berisi KB berikut [daftar KB aktif], dan respons assistant berikut [response], KB mana yang digunakan? Format: JSON array."

Ini memastikan bahkan fallback tetap menggunakan **reasoning**, bukan keyword.

## Detail Teknis

### File: `src/lib/livechat-engine.ts`

**A. `DEBUG_INSTRUCTION` (line ~135-170)**
Tambahkan section baru setelah `[Final Validation]`:

```
[KB Sources Used]
<untuk SETIAP KB source yang kamu gunakan, tulis satu baris:>
<format: SOURCE_TYPE | label | detail>
<SOURCE_TYPE: promo, general, behavioral>
<contoh: general | FAQ: "Kapan LP kadaluwarsa?" | answer digunakan sebagai basis>
<contoh: promo | Promo: Welcome Bonus | field: min_deposit, reward_amount>
<contoh: behavioral | Rule: abusive_language | rule diterapkan>
<jika tidak ada: none | Tidak ada KB match | jawaban dari persona>
```

**B. `parseDebugSection()` (line ~365-382)**
Tambahkan parsing `[KB Sources Used]`:
- Split tiap baris by ` | `
- Map ke `KBSourceMatch { source, label, detail }`

**C. `buildClientDebug()` (line ~531-669) — REWRITE**
Hapus seluruh keyword matching logic. Ganti dengan:
1. Buat prompt singkat yang berisi daftar KB aktif (nama FAQ / nama rule / nama promo)
2. Kirim non-streaming call ke OpenAI (model: gpt-4o-mini untuk speed/cost)
3. Minta output JSON: `[{ source, label, detail }]`
4. Parse dan return sebagai `DebugBreakdown`
5. Tambahkan try/catch — jika call gagal, return basic "reasoning call failed" debug

**D. Ubah `buildClientDebug` jadi `async`**
Karena sekarang melakukan API call, fungsi harus async. Update caller di `streamChat()` (line ~493) untuk `await`.

### Estimasi Impact
- `DEBUG_INSTRUCTION`: +15 baris instruksi
- `parseDebugSection()`: +15 baris parsing
- `buildClientDebug()`: rewrite ~140 baris keyword logic menjadi ~60 baris reasoning call
- `streamChat()`: 1 baris ubah ke await
- Total: ~90 baris baru, ~140 baris dihapus

