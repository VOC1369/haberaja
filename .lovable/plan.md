
# Tambah Tombol "Delete All" di General Knowledge Base

## Perubahan

### `src/components/VOCDashboard/GeneralKnowledgeSection.tsx`

1. **Tombol "Delete All"** ditambahkan di baris Title, rata kanan (sejajar dengan "General Knowledge Base" di kiri)
   - Style: `variant="outline"` dengan hover destructive (merah), konsisten dengan tombol delete yang sudah ada
   - Icon: `Trash2` + teks "Delete All"
   - Hanya muncul jika `items.length > 0`

2. **AlertDialog konfirmasi** sebelum hapus semua data
   - Title: "Hapus Semua Knowledge?"
   - Deskripsi: Peringatan bahwa data yang dihapus tidak dapat dikembalikan, termasuk jumlah entry yang akan dihapus
   - Tombol: "Batal" dan "Hapus Semua" (warna destructive)
   - Saat dikonfirmasi: panggil `saveGeneralKnowledge([])` untuk clear semua data, update state, tampilkan toast

### Layout

```text
General Knowledge Base                              [ Delete All ]
Kelola informasi umum untuk AI assistant
```

Tombol mengikuti CSS pattern yang sama: `border-border`, hover `bg-destructive/20 text-destructive border-destructive`.
