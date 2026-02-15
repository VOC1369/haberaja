
# Upload JSON Promo

Menambahkan tombol "Upload JSON" di halaman Promo Knowledge Base, di sebelah tombol "Upload CSV" dan "Add New Promo".

## Cara Kerja

1. User klik tombol **Upload JSON**
2. Muncul dialog/modal dengan textarea besar
3. User paste JSON promo (format `PromoFormData` atau `CanonicalPromoKB`)
4. Klik "Import" -- sistem memvalidasi JSON, lalu langsung simpan ke KB
5. Toast success, list promo di-refresh

## Validasi JSON

- Parse JSON -- jika gagal, tampilkan error "JSON tidak valid"
- Cek minimal field `promo_name` ada -- jika kosong, error "promo_name wajib diisi"
- Auto-generate `id`, `created_at`, `updated_at` jika belum ada
- Auto-set `status: 'draft'` jika belum ada
- Support paste single object `{...}` atau array `[{...}, {...}]` (bulk import)

## Perubahan UI

Tombol baru ditambahkan di baris action buttons (antara "Upload CSV" dan "Add New Promo"):

```
[Regenerate All S&K] [Upload CSV] [Upload JSON] [+ Add New Promo]
```

## Detail Teknis

### File yang diubah:

**`src/components/VOCDashboard/PromoKnowledgeSection.tsx`**
- Tambah state: `showJsonDialog`, `jsonInput`, `isImportingJson`
- Tambah tombol "Upload JSON" dengan icon `FileJson` (dari lucide-react) di baris action buttons
- Tambah Dialog component untuk input JSON:
  - Textarea besar (min-h-[300px]) untuk paste JSON
  - Tombol "Import" dan "Batal"
- Tambah fungsi `handleJsonImport()`:
  1. `JSON.parse(jsonInput)` -- catch error
  2. Normalize ke array (jika single object, wrap dalam array)
  3. Loop: untuk setiap promo object:
     - Validasi `promo_name` exists
     - Call `promoKB.add(promo)` untuk simpan
  4. Toast success dengan jumlah promo yang berhasil diimport
  5. Refresh list via `loadPromos()`
  6. Close dialog dan reset textarea

### Tidak ada file baru yang perlu dibuat
- Menggunakan komponen UI yang sudah ada (Dialog, Textarea, Button)
- Menggunakan `promoKB.add()` yang sudah ada untuk menyimpan
- Menggunakan `normalizePromoData()` untuk normalisasi field sebelum simpan
