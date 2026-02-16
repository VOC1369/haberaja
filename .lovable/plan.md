
# Persist Chat Messages di LivechatTestConsole

## Masalah
Chat messages hilang saat refresh karena hanya disimpan di React state (`useState`). User butuh messages tetap ada supaya bisa test full flow: chat -> ticket dibuat -> admin approve/decline -> balik ke chat lihat hasilnya.

## Solusi
Simpan chat messages ke `localStorage` dan load saat komponen mount. Messages hanya hilang saat user klik tombol Delete (Trash icon).

## Perubahan Teknis

### `src/components/VOCDashboard/LivechatTestConsole.tsx`
1. **Init state dari localStorage**: Ubah `useState<ChatMessage[]>([])` menjadi lazy initializer yang membaca dari `localStorage` key `voc_livechat_messages`.
2. **Sync ke localStorage**: Tambah `useEffect` yang menyimpan messages ke localStorage setiap kali `messages` berubah.
3. **Clear tetap bersihkan**: `handleClear` juga hapus key dari localStorage.
4. **Persist settings**: Opsional - simpan juga `debugMode`, `selectedPromoId`, `generalKBEnabled`, `behavioralKBEnabled` supaya tidak perlu set ulang setelah refresh.

### Storage Key
- `voc_livechat_messages` untuk chat history
- `voc_livechat_settings` untuk toggle/dropdown states (opsional)

### Safety
- Batasi max messages yang disimpan (misal 100) untuk menghindari localStorage penuh.
- Gunakan try/catch saat parse JSON dari localStorage.
