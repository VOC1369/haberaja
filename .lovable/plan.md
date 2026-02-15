

# Rename "API Data" to "API & Settings" + Tambah Debounce Setting

## Apa yang berubah

Halaman **API Data** akan di-rename menjadi **API & Settings**, dan ditambahkan setting **Debounce Timer** yang bisa diatur (misalnya 3 detik atau 10 detik). Nilai ini akan digunakan oleh Livechat Test Console untuk menggabungkan pesan berturut-turut sebelum dikirim ke AI.

## Perubahan

### 1. Update type VOCConfig
**File:** `src/types/voc-config.ts`
- Tambah field `debounceSeconds: number` di interface `APIData` (default: 3)

### 2. Rename + Tambah Debounce Setting di form
**File:** `src/components/VOCDashboard/APIDataSection.tsx`
- Rename judul dari "API Data" menjadi "API & Settings"
- Tambah Card kedua berisi:
  - **Debounce Timer** slider (1-15 detik) dengan angka yang terlihat
  - Deskripsi penjelasan: "Waktu tunggu sebelum pesan berturut-turut digabung dan dikirim ke AI"
  - Preview: "Jika user kirim 3 pesan dalam X detik, akan digabung jadi 1 request"

### 3. Update navigasi sidebar
**File:** `src/components/VOCDashboard/CategoryNav.tsx`
- Ubah label "API Data" menjadi "API & Settings"

### 4. Update Dashboard references
**File:** `src/pages/Dashboard.tsx`
- Update label mapping dari `"API Data"` menjadi `"API & Settings"`
- Update default value untuk `apiData.debounceSeconds: 3`

### 5. Implementasi debounce di Livechat Test Console
**File:** `src/components/VOCDashboard/LivechatTestConsole.tsx`
- Baca `debounceSeconds` dari localStorage (sama seperti VOC config lainnya)
- Saat user tekan Enter:
  - Pesan langsung muncul di chat sebagai bubble user
  - Timer dimulai (sesuai setting)
  - Jika user kirim pesan lagi sebelum timer habis, timer di-reset dan pesan baru ditambahkan
  - Saat timer habis, semua pesan pending digabung jadi 1 string lalu kirim 1x API call
- Tampilkan "typing indicator" kecil selama debounce window aktif (misal: "Menunggu pesan lanjutan... (3s)")

## Contoh Flow

```text
Setting: debounceSeconds = 3

User: "kak,"              -> tampil di chat, timer mulai (3s)
User: "ada promo gak?"    -> tampil di chat, timer reset (3s)
User: "yang gede"         -> tampil di chat, timer reset (3s)
... 3 detik berlalu ...
-> Gabung: "kak,\nada promo gak?\nyang gede"
-> 1x API call
```

## Technical Details

| Item | Detail |
|------|--------|
| Files diubah | 4 files |
| New dependency | Tidak ada |
| Storage | localStorage (existing pattern) |
| Default debounce | 3 detik |
| Range slider | 1-15 detik |

