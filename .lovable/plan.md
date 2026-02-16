

# Add Context Awareness Section to APBE Runtime Prompt Template

## Summary

Menambahkan section **"# CONTEXT AWARENESS"** ke dalam `RUNTIME_PROMPT_TEMPLATE` di `src/lib/apbe-prompt-template.ts`. Section ini berisi instruksi agar AI bertanya dulu sebelum menjawab ketika context user belum lengkap.

## What Changes

**File: `src/lib/apbe-prompt-template.ts`**

Tambahkan block instruksi "Context Awareness" ke dalam `RUNTIME_PROMPT_TEMPLATE` string, ditempatkan **setelah section `# TIMEZONE`** dan **sebelum `# FINAL INSTRUCTIONS`**.

Content yang ditambahkan adalah pure instruction text (tidak ada placeholder baru), berisi:
- Prinsip utama: tanya dulu sebelum jawab
- Daftar informasi yang perlu diketahui (tipe game, status member, platform)
- Tabel kapan harus tanya vs langsung jawab
- Contoh cara bertanya yang natural (bukan kaku seperti form)
- Contoh conversation flow multi-turn
- Reminder untuk tidak tanya ulang info yang sudah diberikan

## Technical Details

- Tidak ada perubahan logic/code, hanya penambahan teks di dalam template string
- Tidak ada placeholder baru (`{{...}}`) yang perlu di-resolve
- Tidak ada dependency baru
- Tidak ada perubahan pada `compileRuntimePrompt()` function

## Testing

Setelah ditambahkan, bisa diverifikasi via:
1. Buka APBE config di dashboard
2. Klik "Runtime Prompt" preview
3. Pastikan section "CONTEXT AWARENESS" muncul di output
4. Production testing: coba berbagai scenario (rekomendasi promo, cara deposit, download APK) untuk validasi behavior

