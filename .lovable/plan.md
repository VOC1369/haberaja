
# Restyle Livechat Test Console agar Mirip Live Chat

## Referensi

Live Chat (ChatSection) menggunakan:
- `Card` wrapper dengan border
- Fixed dimensions (`w-[1069px] h-[849px]`)
- Chat bubbles: `rounded-lg px-4 py-2` dengan timestamp di bawah pesan (bukan inline)
- Agent bubble: `bg-button-hover text-button-hover-foreground` (golden solid)
- User bubble: `bg-muted`
- Header: border-b, avatar style, controls di kanan
- Input area: border-t, flex gap-2

## Perubahan di `LivechatTestConsole.tsx`

### 1. Wrap dalam Card
Ganti outer div dengan `Card` wrapper seperti ChatSection, dengan fixed height dan overflow hidden.

### 2. Header styling
- Tetap pertahankan: Bug icon, title, Promo selector, Debug toggle, Clear button
- Sesuaikan padding dan border style agar konsisten (`p-4 border-b border-border`)

### 3. Chat bubbles
Sesuaikan styling bubble agar match dengan ChatSection:
- **User bubble**: `bg-muted rounded-lg px-4 py-2` (kiri)
- **Assistant bubble**: `bg-button-hover text-button-hover-foreground rounded-lg px-4 py-2` (kanan, golden solid)
- Tambah **timestamp** di bawah setiap bubble (format jam:menit)
- Hapus border pada assistant bubble, ganti dengan solid golden background

### 4. Input area
- Sesuaikan styling: `p-4 border-t border-border`
- Button send: style `border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground` seperti ChatSection

### 5. Empty state
- Tetap pertahankan empty state text, hanya adjust padding agar proporsional

### 6. Loading indicator
- Tetap pertahankan, sesuaikan warna ke golden solid

## Yang TIDAK berubah
- Semua logic (handleSend, handleKeyDown, handleClear, streaming, debug)
- Promo selector functionality
- Debug toggle dan DebugPanel
- Auto-scroll behavior
- max-w-900px constraint

## File yang diubah
1. **`src/components/VOCDashboard/LivechatTestConsole.tsx`** -- styling only, import Card
