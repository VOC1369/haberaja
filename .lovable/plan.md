

# Ticket-Aware Escalation: Ticket Mode + Ambil Alih Chat Button

## Overview

Implementasi dual-mode escalation dari livechat ke admin dashboard:
1. **Ticket Mode**: AI menawarkan bantuan CS human -> player konfirmasi -> tiket otomatis dibuat -> admin review (Approve/Decline) -> hasil dikembalikan ke AI
2. **Takeover Mode**: Tombol "Ambil Alih Chat" di dialog Detail Ticket agar CS bisa langsung take over conversation

---

## Scope Implementasi

### Part A: Tombol "Ambil Alih Chat" di Dialog Detail Ticket

Menambahkan tombol ke-4 di baris action button dialog Detail Ticket.

Layout baru (kiri ke kanan):
```text
[ Approve ] [ Decline ] [ Ambil Alih Chat ] [ Tutup ]
```

- Tombol "Ambil Alih Chat" muncul hanya untuk ticket berstatus `pending`
- Saat diklik: ubah status ticket menjadi state baru (misalnya flag `is_taken_over`), tampilkan toast, dan tutup dialog
- Untuk sekarang, ini adalah placeholder action yang menandai ticket sudah di-take over

### Part B: Ticket Creation dari Livechat

**B1. Prompt Instruction (apbe-prompt-template.ts)**
- Tambah section "ESCALATION TO CS" di prompt template
- Instruksi: untuk case yang butuh human (reset password gagal, dispute, masalah teknis berulang), AI wajib tawarkan: "Kakak mau dibantu langsung oleh CS kami?"
- Jika player konfirmasi (ya/mau/oke), AI harus output signal marker: `[TICKET:category:ringkasan]`
  - Contoh: `[TICKET:general:Player lupa password, sudah coba reset tapi gagal]`
- AI tentukan kategori otomatis dari konteks chat (general/deposit/withdraw/reward)

**B2. Livechat Engine Detection (livechat-engine.ts)**
- Detect marker `[TICKET:...]` di response stream
- Parse category dan summary dari marker
- Strip marker dari displayed message (player tidak lihat marker)
- Trigger ticket creation

**B3. Ticket Storage Bridge**
- Buat function `createTicketFromChat()` di file baru `src/lib/ticket-storage.ts`
- Generate ticket number format sesuai kategori (D/W/R/G + timestamp)
- Simpan ke localStorage dengan key `voc_chat_tickets`
- TicketList membaca dari localStorage ini juga (merge dengan mock tickets)

**B4. Ticket Status Feedback ke AI**
- Saat player kirim pesan berikutnya di livechat, engine cek apakah ada ticket yang statusnya sudah berubah (approved/declined)
- Jika ada, inject context ke system prompt: "Ticket [nomor] sudah [disetujui/ditolak] oleh admin"
- AI bisa inform player tentang hasilnya secara natural

---

## Technical Details

### File Changes

| File | Perubahan |
|------|-----------|
| `src/components/VOCDashboard/TicketList.tsx` | Tambah tombol "Ambil Alih Chat" di action buttons, import icon Headphones |
| `src/lib/apbe-prompt-template.ts` | Tambah section ESCALATION TO CS di prompt template |
| `src/lib/livechat-engine.ts` | Detect `[TICKET:...]` marker, strip dari display, trigger creation, inject ticket status feedback |
| `src/lib/ticket-storage.ts` (baru) | `createTicketFromChat()`, `getChatTickets()`, `getTicketUpdates()` |
| `src/types/ticket.ts` | Tambah field `source?: 'manual' \| 'livechat'` dan `chat_summary?: string` ke interface Ticket |
| `src/components/VOCDashboard/LivechatTestConsole.tsx` | Handle ticket creation callback, tampilkan notifikasi saat ticket dibuat |

### Ticket Marker Format

```text
[TICKET:general:Player lupa password, sudah coba reset 2x tapi gagal]
[TICKET:deposit:Player klaim sudah transfer tapi saldo belum masuk]
[TICKET:reward:Player minta klaim bonus rollingan tapi tidak bisa]
```

### Escalation Trigger Scenarios

| Scenario | Kategori | Contoh |
|----------|----------|--------|
| Lupa password gagal reset | general | Player sudah coba reset tapi email tidak masuk |
| Deposit tidak masuk | deposit | Sudah transfer tapi saldo belum bertambah |
| Withdraw bermasalah | withdraw | Withdraw pending terlalu lama |
| Klaim bonus gagal | reward | Tidak bisa klaim bonus padahal sudah memenuhi syarat |
| Masalah teknis berulang | general | Aplikasi crash, error berulang |

### Flow Conversation Example

```text
Player: "Saya sudah coba reset password 2x tapi email tidak masuk"
AI: "Wah maaf ya Kak, kalau sudah coba 2x dan tetap belum masuk, 
     sepertinya perlu dicek lebih lanjut. Kakak mau dibantu langsung 
     oleh CS kami?"
Player: "Iya mau"
AI: "Baik Kak, Maya sudah buatkan tiket bantuan untuk Kakak. 
     CS kami akan segera follow up ya! [TICKET:general:Lupa password, 
     reset 2x gagal - email tidak masuk]"
→ Marker di-strip, player lihat: "Baik Kak, Maya sudah buatkan tiket..."
→ Ticket otomatis muncul di admin dashboard
```

