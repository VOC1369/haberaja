

# Fix: Auto-focus Input Field After Sending Message

## Problem
Setelah user mengetik pesan dan tekan Enter, kursor tidak kembali ke input field. User harus klik manual ke input field setiap kali mau kirim pesan baru.

## Root Cause
Di `handleSend()`, setelah `setInput("")` dipanggil, tidak ada perintah untuk mengembalikan focus ke input element.

## Solution
Tambahkan `useRef` untuk input field, lalu panggil `.focus()` setelah kirim pesan.

## Technical Detail

**File: `src/components/VOCDashboard/LivechatTestConsole.tsx`**

1. Tambah `inputRef` (useRef untuk input element)
2. Di `handleSend()`, setelah `setInput("")`, panggil `inputRef.current?.focus()`
3. Pasang `ref={inputRef}` di komponen `<Input>`

Perubahan hanya 3 baris — sangat minor.

