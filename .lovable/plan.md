
# Tambah Upload JSON di General Knowledge Base (Dual Mode: Manual + JSON)

## Apa yang berubah

Form manual ("Add New General Entry") tetap ada seperti sekarang. Ditambahkan tombol **Upload JSON** di sebelah tombol "Add New General Entry" yang membuka dialog paste JSON untuk bulk import — mengikuti pattern yang sama persis dengan Promo Knowledge Base.

Tombol "Upload CSV" yang saat ini belum fungsional akan diganti menjadi **Upload JSON** yang benar-benar berfungsi.

## Perubahan

### 1. Ganti tombol "Upload CSV" menjadi "Upload JSON"
**File:** `src/components/VOCDashboard/GeneralKnowledgeSection.tsx`
- Tombol "Upload CSV" diganti jadi **Upload JSON** dengan icon `FileJson`
- Klik membuka dialog paste JSON (bukan upload file)

### 2. Tambah Upload JSON Dialog
**File:** `src/components/VOCDashboard/GeneralKnowledgeSection.tsx`
- Dialog baru dengan Textarea monospace untuk paste JSON
- Placeholder contoh format JSON:
  ```json
  [
    {
      "question": "Bagaimana cara deposit?",
      "answer": "Deposit bisa via bank transfer...",
      "category": "FAQ",
      "knowledgeType": "Static"
    }
  ]
  ```
- Mendukung single object dan array
- Validasi: `question` dan `answer` wajib ada
- `category` default ke "Other" jika kosong
- `knowledgeType` default ke "Static" jika kosong
- Auto-generate `id`, `createdAt`, `updatedAt`

### 3. Tambah Export JSON
**File:** `src/components/VOCDashboard/GeneralKnowledgeSection.tsx`
- Tombol **Export JSON** di deretan action buttons
- Download semua data General KB sebagai file `.json`

### 4. Hapus Upload CSV Dialog
- Dialog CSV yang belum fungsional dihapus karena sudah digantikan Upload JSON

## Flow User

**Manual (1 entry):**
Klik "Add New General Entry" -> isi form -> Simpan (tidak berubah)

**Bulk JSON (banyak entry sekaligus):**
Klik "Upload JSON" -> paste JSON array -> klik Import -> otomatis masuk semua

## Technical Details

| Item | Detail |
|------|--------|
| Files diubah | 1 file (`GeneralKnowledgeSection.tsx`) |
| New dependency | Tidak ada |
| Pattern | Sama dengan Promo KB JSON upload |
| Validasi wajib | `question`, `answer` |
| Default category | "Other" |
| Default knowledgeType | "Static" |
