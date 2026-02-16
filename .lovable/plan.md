
# Tombol "Prompt Result" di Behavioral Knowledge Base

## Tujuan
Menambahkan tombol **"Prompt Result"** di sebelah judul "Behavioral Knowledge Base" yang ketika diklik akan menampilkan **prompt final** yang dihasilkan dari semua aturan B-KB aktif. Ini memungkinkan kamu melihat dan mengoreksi instruksi yang dikirim ke AI.

## Perubahan

### 1. Tambah tombol "Prompt Result" di header (BehavioralKnowledgeSection.tsx)
- Tombol ditempatkan **sejajar** dengan judul "Behavioral Knowledge Base" (flex row)
- Icon: `FileText` dari lucide-react
- Klik tombol membuka **Dialog/Modal** yang menampilkan prompt hasil kompilasi

### 2. Dialog Prompt Result
- Modal full-width menampilkan output dari fungsi `buildBehavioralKBContext()`
- Prompt ditampilkan dalam blok `<pre>` dengan font mono agar mudah dibaca
- Tombol **"Copy"** untuk menyalin prompt ke clipboard
- Jika tidak ada rule aktif, tampilkan pesan "Tidak ada rule aktif"

### 3. Export fungsi `buildBehavioralKBContext`
- Fungsi ini saat ini `private` di `livechat-engine.ts` — perlu di-export agar bisa dipanggil dari komponen UI

---

## Detail Teknis

**File yang diubah:**
1. `src/lib/livechat-engine.ts` — Export `buildBehavioralKBContext()` (tambah keyword `export`)
2. `src/components/VOCDashboard/BehavioralKnowledgeSection.tsx`:
   - Import `Dialog` components dan `buildBehavioralKBContext`
   - Tambah state `showPrompt` (boolean)
   - Tambah tombol "Prompt Result" sejajar dengan title
   - Tambah Dialog yang render output prompt dalam `<pre>` block
   - Tombol copy ke clipboard

**Layout header baru:**
```text
+----------------------------------------------+
| Behavioral Knowledge Base  [Prompt Result]   |
| B-KB V5.0 — Kelola aturan perilaku AI...     |
+----------------------------------------------+
```
