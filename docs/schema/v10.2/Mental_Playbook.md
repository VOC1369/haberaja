# LIVEWOLF — MENTAL PLAYBOOK V.10.2

**Cara Fux Berpikir, Memutuskan, dan Menjaga Sistem**
*Personal Doctrine untuk Internal Team & Penerus*

**Tanggal:** 15 Mei 2026
**Owner:** Habe Raja (Fux), WOLFGANK
**Schema Foundation:** PKB_Wolfbrain V.10.2 (candidate_locked)

---

## Apa Dokumen Ini?

Mental Playbook bukan SOP. Bukan rule book. Bukan dokumen teknis.

Ini adalah **cara saya bekerja** — prinsip dasar yang saya pakai untuk berpikir, memutuskan, berkomunikasi, dan menjaga sistem tetap waras saat skala bertambah. Ditulis untuk diri saya sendiri sebagai pegangan, dan untuk penerus yang suatu saat akan mengelola sistem ini ketika saya tidak ada.

> **Audience:** Internal team WOLFGANK, future tech leader Liveboard, siapa saja yang berurusan dengan sistem yang saya bangun.

---

## Hubungan dengan Dokumen Lain

Mental Playbook adalah **mindset layer**. Untuk teknis pakai dokumen teknis. Untuk strategi pakai Brand Story. Untuk doctrine sistem, pakai dokumen ini.

| Dokumen | Type | Audience |
|---------|------|----------|
| **Mental Playbook** *(doc ini)* | Personal doctrine | Internal team + future leader |
| **Brand Story** | Narrative + strategic positioning | Investor + Board + Strategic Partner |
| **F1-F4 + Governance + Supabase** | Technical architecture | Developer + Designer + QA |

Prinsip dari Mental Playbook ini **diturunkan** ke F1 Doctrine dan Governance Rules — tapi Mental Playbook lebih luas. F1/Governance fokus pada satu sistem (PKB_Wolfbrain). Mental Playbook fokus pada cara berpikir secara umum.

---

## Prinsip Dasar

Saya adalah desainer industri yang treat business sebagai design problem. Saya bawa toolkit: **dekomposisi sistem, ekstraksi primitive, spec discipline, dan creative sovereignty.** AI adalah medium baru, bukan ancaman atau hype.

Liveboard adalah hasil dari toolkit ini diaplikasikan ke iGaming. PKB_Wolfbrain V.10.2 (469 fields, 26 engines, 12 governance rules) adalah artefak konkret dari cara berpikir yang akan saya jelaskan di dokumen ini.

---

# Bagian 1 — Truth Hierarchy

Urutan kebenaran yang tidak bisa dibalik:

```
1. Bukti (evidence)         — dari teks promo, data, observasi
2. Logika sistem            — internal consistency, schema invariants
3. Konteks bisnis           — tujuan, risk, segmentasi
4. Opini / preferensi       — termasuk punya saya
```

**Aturan praktis:**

- Jangan pernah memutuskan berdasarkan opini jika bukti masih bisa diperoleh.
- Jangan pernah membiarkan konteks bisnis membatalkan logika sistem kecuali ada bukti baru.
- Opini saya adalah opini saya — tidak otomatis kebenaran. Tetap harus tunduk pada bukti dan logika.

**Contoh:** Saat AI ragu dengan mata uang promo, jangan isi "IDR" karena "biasanya Indonesia." Cari bukti dulu (teks, screenshot, knowledge base). Kalau tidak ada, tandai sebagai `not_stated` dan minta konfirmasi.

**Konsekuensi di V.10.2:**

Truth Hierarchy ini diturunkan langsung ke schema:
- `_field_status` dengan 6 nilai (`explicit` / `inferred` / `derived` / `propagated` / `not_stated` / `not_applicable`) — setiap field punya jejak dari mana datanya berasal
- `ai_confidence` per path — AI report tingkat kepercayaannya
- `unmodeled_evidence_block` (BARU V.10.2) — tempat AI catat hal yang belum punya rumah di skema, bukan hallucinate

---

# Bagian 2 — Primitives, Bukan Contoh

Setiap masalah berulang harus diekstrak menjadi **mechanic primitive**, bukan ditambal per kasus.

**Pertanyaan yang harus selalu ditanyakan:**

> "Dari 100 promo ini, apa pattern-nya? Apa yang sama? Apa yang berbeda?"

**Jangan pernah:**

- Membuat aturan khusus untuk satu promo
- Menambal JSON tanpa memperluas skema
- Menyimpan contoh sebagai solusi

**Praktik:**

- Gunakan typed engines sebagai source of truth. Jangan biarkan `mechanics_engine` atau `projection_engine` override engines PRIMARY.
- Setiap engine (`reward_engine`, `claim_engine`, `trigger_engine`, dll) harus punya definisi yang jelas dan reusable.
- Lihat **WB_F2_Field_Definitions_V10_2.md** untuk arti setiap field.

**Konsekuensi di V.10.2:**

V.10.2 punya **26 engine** yang masing-masing memodelkan satu domain logika. Empat engine baru di V.10.2 (`ticket_engine`, `referral_engine`, `result_event_engine`, `fulfillment_engine`) lahir karena pattern berulang yang sebelumnya ditambal di engine lain — sekarang punya rumah sendiri.

**Anti-pattern yang dihindari:** Menambah `mechanics_engine.items[]` untuk setiap kasus baru tanpa promosi ke typed engine. Ini menumpuk kompleksitas tanpa menambah kejelasan. Per Governance G9, `mechanics_engine` adalah AUXILIARY — debug only, bukan source of truth.

**Aturan promosi ke schema (per Governance G4):**

Sebelum tambah field baru ke skema, cek:
1. Apakah pattern ini muncul di **3+ records** dari **2+ brands**?
2. Apakah pattern ini punya semantic yang **unik** (tidak overlap dengan field existing)?
3. Apakah pattern ini akan **dipakai Danila** untuk menjawab member?

Kalau ketiganya YA → promosikan ke schema (via amendment workflow). Kalau ada satu yang TIDAK → tetap di `unmodeled_evidence_block` sebagai catatan kerja, tunggu evidence lebih banyak.

---

# Bagian 3 — Anti-Chaos

Sistem harus makin kuat saat diskalakan, bukan makin rapuh.

## Tiga Lapisan Kontrol

```
1. Pencegahan  — Skema dan enum memaksa data masuk ke bentuk yang valid
2. Deteksi     — Validator menahan publikasi, BUKAN mengubah data
3. Koreksi     — Hanya manusia yang boleh mengubah data (explicit override flow)
```

### 1. Pencegahan

Skema PKB_Wolfbrain V.10.2 dengan 469 fields dan F3 Enum Registry membatasi nilai yang bisa masuk. Tidak ada field yang boleh menerima nilai liar. Tidak ada enum yang bisa di-override di Form Wizard tanpa update skema.

**12 Governance Rules locked (G1-G12)** sebagai constitution sistem:
- G1: AI dilarang patch skema tanpa approval saya
- G2: Versioning disiplin (5 amendment types)
- G3: `min_withdraw` di 3 path SSOT (claim_gate global, per-variant, projection derived)
- G4: `unmodeled_evidence_block` promotion workflow
- G5: Reward block anti-overlap
- G6: Coverage claim discipline
- G7: `record_type` required
- G8: Doctrine-code sync 15-step
- G9: Authority layers (PRIMARY > OPERATIONAL > AUXILIARY > DERIVED)
- G10: `event_block` anti-dumping
- G11: Extractor no-regex
- G12: Status lifecycle

### 2. Deteksi

Validator memberi peringatan, **tidak mengubah data**. Gunakan `ambiguity_flags`, `contradiction_flags`, `review_required`.

Per Governance G5, kalau lebih dari 1 reward block enabled — BLOCK COMMIT. Per G3, kalau `min_withdraw` ditulis ke path forbidden (`reward_engine.requirement_block.min_withdraw`) — BLOCK COMMIT. Validator tidak hapus, tidak ubah — cuma tahan dan kasih reason.

### 3. Koreksi

Hanya manusia yang boleh mengubah data, dan hanya melalui **explicit override flow**, bukan sistem otomatis.

Setiap override tercatat di `_human_override_log[]`. Setiap AI reasoning yang resolve ambiguity tercatat di `_ai_resolver_log[]`. Tidak ada perubahan diam-diam.

## Aturan Kunci

**Jangan pernah menambal sistem dengan kata kunci (keyword override).**

Itu adalah jalan menuju legacy hell. Kalau AI salah baca, perbaiki prompt atau perbaiki skema — jangan tambal di post-processing. Per Governance G11, extractor **DILARANG** pakai regex — semua extraction harus berbasis reasoning + vocabulary (F3 enum).

Lihat **WB_F1_Doctrine_Skeleton_V10_2.md** — bagian "Aturan Sistem" dan **V10_2_Governance_Rules.md** — bagian G11.

---

# Bagian 4 — Komunikasi Spec, Bukan Opini

Komunikasi saya padat, langsung, dan minim ambiguitas. Ini bukan gaya personal — ini **spec discipline**.

## Aturan Menulis Dokumen

- Setiap pernyataan harus bisa diverifikasi (ada bukti atau logika)
- Hindari kata seperti "mungkin", "sebaiknya", "bisa jadi" — ganti dengan kondisi eksplisit
- Gunakan numbering dan struktur hierarkis. Jangan paragraf panjang tanpa pembagian.
- Setiap dokumen wajib punya **versi, timestamp, dan status lock**
- Setiap dokumen wajib punya **CHANGELOG** di akhir (per Liveboard Doc Versioning rule)

## Aturan Diskusi (Terutama dengan AI)

- Jika AI memberikan jawaban tapi tidak menunjukkan bukti atau reasoning, **minta trace-nya**
- Jika AI mulai bergeser dari konsep awal, **stop dan tanya:** "Kita masih membahas X?"
- Jangan biarkan AI berasumsi. Minta eksplisit.
- **NULL > tebakan.** Lebih baik AI bilang "tidak tahu" daripada hallucinate.

## Aturan Penamaan

- Nama file ≠ nama schema. Jangan dicampur.
- Nama file = doc counter (V.XX bertambah tiap update)
- Nama schema = engine version lock (V.10.2 untuk PKB_Wolfbrain)
- Stamp akhir: `V.XX | DD Month YYYY | HH.MM | Habe Raja`

Lihat **WB_F1_Doctrine_Skeleton_V10_2.md** — bagian "Filter Diskusi" untuk detail lengkap.

---

# Bagian 5 — Bekerja dengan AI

AI bukan dewa, bukan mainan, bukan ancaman. **AI adalah tenaga kerja kognitif dengan quirks.**

## Prinsip Kolaborasi

1. **AI membaca dan mengisi data awal** — jangan minta AI memutuskan sendiri. Beri skema, beri aturan, minta AI isi semaksimal mungkin.
2. **Sistem menjaga kualitas** — validator boleh menahan, tidak boleh mengubah.
3. **Manusia menyelesaikan ketidakpastian** — field yang tidak jelas (confidence <0.7) harus ditandai dan minta konfirmasi.
4. **Skema berkembang kalau realita melampaui kemampuan skema** — jangan tambal, perluas.

## Praktik Multi-AI Orchestration

Gunakan **multi-AI orchestration** untuk design dan reasoning, lalu eksekusi dengan Lovable atau Codex. **Jangan bergantung pada satu provider.**

**Stack AI yang dipakai:**
- **Claude (Sonnet/Opus)** — primary engine untuk extraction dan reasoning mendalam
- **Claude (Haiku)** — classifier cepat, reject gate
- **GPT** — cross-validation, alternative reasoning
- **Gemini** — extra perspective, kadang ngeliat hal yang Claude miss
- **DeepSeek** — additional cross-check, especially for technical/code review

## Audit Cycle V.10.2 (Lessons Learned)

V.10.2 schema lock memakai **3-AI verification cycle**: GPT + Gemini + DeepSeek (atau kombinasi) cross-check tiap milestone.

**Pattern yang muncul:**

- **Round 1 audit** sering nemu fabricated field names — AI satu boleh hallucinate, AI dua sebagai jaring pengaman
- **Round 2-3** nemu enum drift — F4 pakai enum value yang gak ada di F3
- **Round 4-5** nemu logical inconsistency — bukan field salah, tapi conceptual conflict antar engine

**Disiplin penting:**

- Jangan langsung lock setelah AI bilang "clean" — minimal 2 AI verify
- Jangan nambah field/enum baru cuma karena 1 AI nyaranin — verify dulu apakah field tersebut memang dibutuhkan (per G4 promotion workflow)
- Jangan reframe scope di tengah audit — kalau ada finding besar, document → fix → re-audit, jangan campur

**Hasil di V.10.2:**

5 round audit total. Tiap round nemu 3-9 patch points. Tanpa cross-AI cycle, V.10.2 akan ship dengan fabricated enums, enum drift, dan logical inconsistency yang akan blow up di production.

Lihat **WB_F1_Doctrine_Skeleton_V10_2.md** — bagian "Cara Kerja yang Benar" dan "Kalau Promo Gagal Dibaca AI".

---

# Bagian 6 — Pengambilan Keputusan dengan Ambiguitas

Ketika informasi tidak lengkap, ikuti urutan:

```
1. Cari bukti tambahan          — sumber lain? screenshot? URL? knowledge base?
2. Jika tidak ada → not_stated   — jangan diisi tebakan
3. Buat pertanyaan spesifik      — "tolong konfirmasi: apakah X?"
4. Status tetap draft            — sampai ada konfirmasi
```

## Aturan Praktis

- **Jangan biarkan sistem memutuskan sendiri.** Kalau tidak ada bukti, status tetap draft sampai ada konfirmasi.
- **NULL bukan error.** Itu data yang memang tidak disebutkan.
- **Field yang boleh null:** `valid_until`, `min_deposit`, `max_reward`, `tier_archetype` (jika mode bukan tier), dan banyak lainnya. Lihat F3 untuk daftar lengkap nullable fields.

## Decision Pattern V.10.2

Setiap keputusan major di V.10.2 di-log sebagai **Decision Document**. Contoh:

- **Decision 001 (15 Mei) — Winstreak handling:** pakai `reward_table_block` dengan `table_type=streak_ladder` + `basis=winstreak_count`. Bukan bikin `streak_engine` baru. Reason: pattern fit existing reward_table_block, bikin engine baru = scope creep.
- **Decision 002 — Tournament Ranking Pattern:** pakai `ranking_prize_table` + `rank_position` basis. Scoring method ke `terms_conditions[]`. Reason: rank-based tournament sudah punya rumah di reward_table_block, gak butuh field baru.
- **Decision 003 — recipient_data_required:** 6 enum values (`full_name`, `address`, `phone`, `email`, `ktp_id`, `bank_account`). `kk_id` dan `npwp` di-HOLD sampai ada evidence promo nyata yang butuh. Reason: jangan bikin enum cuma karena field string ada — enum hanya untuk value yang harus dikontrol.

**Doktrin di balik decision pattern:**

- Setiap decision punya **reason** yang articulated
- Setiap decision punya **alternative** yang dipertimbangkan
- Setiap decision punya **rejection criteria** untuk alternatif

Bukan "saya pilih A". Tapi "saya pilih A karena B, alternatif C ditolak karena D."

---

# Bagian 7 — Prioritas dan Fokus (Untuk Myself dan Penerus)

Saya tidak bisa mengerjakan semuanya selamanya. Ini prioritas yang harus dipegang:

## P1 — Tidak Bisa Didelegasikan

- **Keputusan perubahan skema** (enum baru, engine baru, governance rule baru)
- **Validasi akhir untuk promo high-risk** (kategori C atau `risk_level: critical`)
- **Hubungan dengan brand existing** (karena trust dibangun personal)
- **Strategic direction Liveboard** (positioning, roadmap, partnership)

## P2 — Bisa Didelegasikan ke Orang yang Tepat

- Review field ambiguous (dengan auto-suggest)
- Maintenance kode (Lovable + refactor)
- Monitoring sistem (alert, error rate)
- Onboarding brand baru (setelah trust established)

## P3 — Bisa Diotomatisasi atau Di-outsource

- Ekstraksi promo rutin (AI sudah cover)
- Pembuatan laporan (`projection_engine`)
- Email/notification routine
- Documentation generation dari schema

## Pertanyaan untuk Menentukan Prioritas

> "Jika saya tidak bisa mengerjakan ini selama 1 minggu, apakah sistem akan rusak atau brand akan complaint?"

Jika ya → P1. Jika tidak → delegasikan.

**Pertanyaan kedua:**

> "Apakah ini butuh konteks WOLFGANK / iGaming Indonesia / 20 tahun pengalaman saya?"

Jika ya → P1 atau P2. Jika tidak → P3.

---

# Bagian 8 — Kalibrasi Skeptisisme

Skeptisisme adalah alat, bukan identitas. Jangan sampai berubah menjadi sinisme.

## Tiga Mode yang Harus Diaktifkan pada Fase yang Tepat

| Mode | Waktu Aktif | Tugas |
|------|-------------|-------|
| **Creator** | Ide awal, brainstorming | Biarkan ide mentah hidup, jangan kritik dulu |
| **Strategist** | Setelah ide matang | Pilih arah, positioning, struktur |
| **Interrogator** | Sebelum lock | Uji asumsi, cari celah, perkuat argumen |

## Peringatan

**Jangan aktifkan Interrogator terlalu awal.** Kritik dini bisa membunuh ide yang belum sempat berkembang.

**Jangan stuck di Creator terlalu lama.** Ide yang gak pernah diuji = fantasy.

**Jangan stuck di Interrogator terlalu lama.** Kritik tanpa konstruksi = sinisme.

## Praktik di V.10.2

Pattern yang muncul di proses V.10.2 lock:

- **Creator mode** (Apr 22-30): brainstorming Pseudo Engine, 22 engines pertama
- **Strategist mode** (Apr 30 - Mei 10): pilih arah V.10 → V.10.2, decide 4 engine baru, 12 governance rules
- **Interrogator mode** (Mei 10-15): 5 round audit cycle, cross-AI verification, fix fabrications + enum drift

**Mode switching adalah disiplin.** Bukan mood. Bukan random. Pilih mode berdasarkan fase, bukan berdasarkan perasaan.

---

# Bagian 9 — Ketika Saya Tidak Ada (Contingency)

Jika suatu saat saya tidak bisa mengelola sistem (sakit, cuti, atau apapun), ini yang harus dilakukan:

## Aturan Dasar

1. **Jangan mengubah skema tanpa persetujuan saya** (kecuali darurat keamanan). PKB_Wolfbrain V.10.2 candidate_locked. Per Governance G1, AI dilarang patch schema tanpa approval saya.

2. **Ikuti prosedur yang sudah ada** — AI extract, validator, human review, publish. Jangan buat bypass.

3. **Untuk keputusan ambigu yang butuh saya**, tulis sebagai "deferred decision" dengan reasoning lengkap. Jangan dipaksakan.

4. **Audit cycle WAJIB jalan** sebelum production deploy. Jangan skip 3-AI verification per Governance G8 step 12-13.

5. **Hubungi:** [BELUM DIISI — to-do critical]

## To-Do: Contingency Plan Lengkap

Ini bagian yang **masih belum lengkap**. Saya perlu:

- [ ] Tunjuk minimal 1 orang yang bisa ambil alih sementara
- [ ] Dokumentasikan kontak darurat (Tech Lead, Operations Lead, Investor liaison)
- [ ] Buat "Emergency Decision Authority Matrix" — siapa boleh memutuskan apa kalau saya tidak ada
- [ ] Siapkan "Schema Freeze Protocol" — apa yang boleh dan tidak boleh dilakukan ke skema selama saya tidak ada
- [ ] Dokumentasikan password manager + access ke critical accounts

**Status:** P1 priority, harus selesai sebelum Q3 2026.

---

# Bagian 10 — Dokumen yang Wajib Diperbaharui

Dokumen berikut adalah **living documents** — harus diupdate saat ada perubahan signifikan.

## V.10.2 Documentation Set (PKB_Wolfbrain)

| Dokumen | Frekuensi Review | Penanggung Jawab |
|---------|------------------|------------------|
| `WB_F1_Doctrine_Skeleton_V10_2.md` | Setiap ada perubahan arsitektur | Saya (Habe) |
| `WB_F2_Field_Definitions_V10_2.md` | Setiap ada field baru | Saya + tech lead |
| `WB_F3_Enum_Registry_V10_2.md` | Setiap ada enum baru | Saya (enum hanya saya yang tambah, per G1) |
| `WB_F4_Form_Mapping_V10_2.md` | Setiap ada perubahan UI form | Tech lead + reviewed by saya |
| `V10_2_Governance_Rules.md` | Setiap ada governance change | Saya only |
| `PKB_Wolfbrain_V10_2_skeleton.json` | FROZEN — gak boleh disentuh | Skema source of truth |

## Companion Documents

| Dokumen | Frekuensi Review | Penanggung Jawab |
|---------|------------------|------------------|
| `Liveboard_Supabase_Data_Architecture_V_10_2.md` | Setiap ada schema/table change | Saya + backend lead |
| `Liveboard_Brand_Story_V_02.md` | Setiap ada major reframe | Saya |
| `Livewolf_Mental_Playbook_V_10_2.md` *(doc ini)* | Setiap 6 bulan, atau saat ada learning baru | Saya |

## Aturan Update

Per Liveboard Doc Versioning rule:

1. Nama file ≠ nama schema
2. Stamp wajib di akhir: `V.XX | DD Month YYYY | HH.MM | Habe Raja`
3. CHANGELOG wajib di halaman terakhir sebelum stamp
4. Cumulative changelog: `## V.XX-1 → V.XX`

---

# Penutup

Dokumen ini adalah **cara saya bekerja**, bukan daftar aturan yang kaku.

Tujuan utamanya: **agar sistem yang saya bangun bisa terus jalan dengan kualitas tinggi, bahkan ketika saya sedang tidak fokus, sedang cuti, atau suatu saat sudah tidak ada lagi.**

Sistem yang baik tidak bergantung pada satu orang. Tetapi mindset yang baik bisa diturunkan — dan itulah yang dokumen ini coba lakukan.

Kalau lo membaca ini dan lo penerus saya: ambil yang relevan, tinggalkan yang sudah outdated. Yang penting adalah **prinsip dasarnya**, bukan implementasi spesifiknya. PKB_Wolfbrain V.10.2 akan jadi V.11, V.12, V.20 suatu saat. Tetapi disiplin "bukti dulu, opini terakhir" akan tetap valid selamanya.

Bawa toolkit yang sama:

> **Dekomposisi sistem. Ekstraksi primitive. Spec discipline. Creative sovereignty.**

Itu cukup.

---

# Changelog

## V.10.1 → V.10.2 (15 Mei 2026)

**Type:** Minor sync + Lessons Update (Q3-A strategy)
**Status:** Document locked
**Strategy:** Keep timeless principles, sync V.10→V.10.2 references, add lessons dari V.10.2 audit cycle

**Yang berubah:**

### A. Schema Version References
- "V.10 locked" → "V.10.2 candidate_locked"
- "PKB_Wolfbrain schema" → "PKB_Wolfbrain V.10.2 (469 fields, 26 engines, 12 governance rules)"
- File references updated: `WB_F1_Doctrine_Skeleton.md` → `WB_F1_Doctrine_Skeleton_V10_2.md`

### B. New Content (Lessons from V.10.2)
- **Bagian 5 "Audit Cycle V.10.2 (Lessons Learned)"** — 3-AI verification pattern, 5 round audit history
- **Bagian 6 "Decision Pattern V.10.2"** — Decision 001 (Winstreak), 002 (Tournament Ranking), 003 (recipient_data_required) sebagai contoh decision discipline
- **Bagian 8 "Praktik di V.10.2"** — Mode switching history (Creator/Strategist/Interrogator) selama V.10.2 lock
- **Bagian 10 expanded** — Full V.10.2 documentation set listed dengan responsibility

### C. Multi-AI Stack Updated
- Bagian 5: explicitly mention Claude + GPT + Gemini + DeepSeek (sebelumnya cuma Claude + GPT + DeepSeek di V.10.1)
- Gemini added as additional cross-AI verification

### D. Governance References Added
- Throughout dokumen sekarang reference Governance G1-G12 sebagai constitution
- Truth Hierarchy → diturunkan ke `_field_status`, `ai_confidence`, `unmodeled_evidence_block`
- Anti-Chaos → diturunkan ke 12 Governance Rules
- Promotion workflow (G4) — kapan field baru boleh masuk ke schema

### E. Companion Docs Cross-Reference
- Hubungan dengan Brand Story V.02 dan PKB_Wolfbrain V.10.2 documentation set di intro
- Bagian 10 dokumen wajib update — full list V.10.2 docs

### F. Format Updates
- HTML → Markdown (consistent dengan companion docs V.10.2)
- Tone unchanged — personal doctrine voice
- Structure unchanged — 10 bagian + penutup

### G. Yang KEPT (timeless principles)
- 4-level Truth Hierarchy
- Primitives vs Examples doctrine
- 3-tier control system (prevention/detection/correction)
- Spec discipline communication rules
- 3 mode kalibrasi skeptisisme (Creator/Strategist/Interrogator)
- P1/P2/P3 priority system
- "NULL > tebakan" rule
- "Manusia bisa nakal, AI tidak punya agenda" implicit

**Approved by:** Habe Raja (Fux), WOLFGANK
**Date:** 15 Mei 2026
**Status:** Document locked

---

*Livewolf | Mental Playbook V.10.2 | V.10 (Apr 2026) → V.10.1 (8 Mei 2026) → V.10.2 (15 Mei 2026) | Habe Raja*
