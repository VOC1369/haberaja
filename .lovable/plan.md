
# Tambah Tombol "Delete All" di Behavioral Knowledge Base

## Perubahan

### `src/components/VOCDashboard/BehavioralKnowledgeSection.tsx`

1. **State baru**: Tambah `isDeleteAllOpen` state untuk kontrol AlertDialog.

2. **Tombol "Delete All"** di baris Title (line 117-137), rata kanan bersama tombol "Prompt Result" yang sudah ada:
   - Hanya muncul jika `items.length > 0`
   - Style konsisten: `variant="outline"`, `text-destructive`, hover `bg-destructive/20`
   - Icon `Trash2` + teks "Delete All"

3. **AlertDialog konfirmasi**:
   - Title: "Hapus Semua Aturan Behavioral?"
   - Deskripsi: Peringatan data tidak bisa dikembalikan + jumlah entry (`items.length`)
   - Saat dikonfirmasi: panggil `saveBehavioralRules([])` untuk clear semua data, update state, tampilkan toast sukses

4. **Import tambahan**: `saveBehavioralRules` dari `BehavioralWizard/types`

### Layout Title Setelah Perubahan

```text
Behavioral Knowledge Base          [ Delete All ] [ Prompt Result ]
B-KB V5.0 — Kelola aturan...
```

Kedua tombol sejajar rata kanan menggunakan `flex gap-2`.
