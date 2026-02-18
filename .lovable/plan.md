
# Fix: Closing Template yang Repetitif & Kaku

## Masalah
Setiap respons AI diakhiri dengan pola yang hampir identik:
- "Kalau ada yang mau ditanya lebih lanjut, Riri siap bantu! 😊✨"
- "Kalau Kak belum pernah... Riri siap membantu! 😊✨"
- "Kalau Kak butuh bantuan..., Riri siap bantu! 😊✨"

Ini terjadi karena system prompt tidak punya instruksi anti-repetisi khusus untuk closing, dan AI default-nya selalu menempel closing template di setiap turn.

## Solusi
Tambahkan blok instruksi **CLOSING DISCIPLINE** di `buildSystemPrompt()` yang mengajarkan AI kapan dan bagaimana menutup respons.

## Perubahan

### `src/lib/livechat-engine.ts` — di dalam `buildSystemPrompt()`

Tambahkan blok instruksi baru setelah Language Firewall (setelah line ~249), sebelum General KB injection:

```
# CLOSING DISCIPLINE — ANTI-TEMPLATE

ATURAN CLOSING:
1. JANGAN selalu tutup dengan kalimat penutup. Jika jawaban sudah lengkap dan jelas, STOP di situ. Tidak perlu closing.
2. Jika memang ingin menutup, JANGAN gunakan pola yang sama berulang. Variasikan:
   - Kadang tanpa closing sama sekali (langsung selesai)
   - Kadang closing pendek: "Ada lagi?" / "Lanjut?"
   - Kadang closing kontekstual yang relevan dengan topik
   - Kadang gunakan closing dari Interaction Library (Closings templates di atas)
3. DILARANG menggunakan pola "Kalau [Kak/kamu] butuh bantuan [lagi/lebih lanjut], [nama agent] siap [bantu/membantu]!" di setiap turn. Pola ini HANYA boleh muncul MAKSIMAL 1x per 5 turn.
4. Emoji closing (😊✨) TIDAK wajib di setiap pesan. Gunakan secukupnya.
5. Closing HARUS terasa natural — seperti chat teman, bukan template customer service.

CONTOH CLOSING YANG BAGUS:
- (tanpa closing — jawaban langsung selesai)
- "Ada lagi yang mau ditanya? 😊"
- "Semoga membantu ya!"
- "Itu dia infonya — kalau masih bingung langsung tanya aja"
- "Coba cek dulu ya, nanti kabarin lagi kalau ada kendala"

CONTOH CLOSING YANG DILARANG (terlalu template):
- "Kalau Kak butuh bantuan atau informasi lebih lanjut, Riri siap membantu! 😊✨"
- "Jika ada pertanyaan lain, jangan ragu untuk bertanya ya!"
- Pola apapun yang identik/mirip di 2+ turn berturut-turut
```

### Ringkasan
- 1 file diubah: `src/lib/livechat-engine.ts`
- Hanya menambahkan blok instruksi baru di system prompt
- Tidak ada perubahan UI atau logic lainnya
