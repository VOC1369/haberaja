# F2 — Definisi Field V.10.2

**Schema:** PKB_Wolfbrain V.10.2
**Status:** candidate_locked
**Tanggal:** 15 Mei 2026
**Owner:** Habe Raja (Fux), WOLFGANK

---

## Apa Dokumen Ini?

Dokumen ini menjelaskan **setiap field di JSON Wolfbrain** — untuk apa, isinya apa, dan kapan dipakai.

Anggep aja ini **kamus**. Kalau kamu lihat field aneh di JSON, cari di sini.

> **Audience:** Coder, designer, operator, siapa aja yang kerja sama data promo Wolfbrain.

---

## Goal V.10.2 (Wajib Tau Sebelum Lanjut)

Supabase nyimpen satu **canonical JSON** per promo. JSON ini adalah **otak Danila** (AI customer service).

Tugas dokumen ini: bikin Danila tau **harus baca dari mana** kalau ada pertanyaan dari member. Jangan sampai Danila bingung karena data sama disimpan di 3 tempat.

**Prinsip dasar:**

> Satu pertanyaan → satu tempat baca. Gak ada authority ganda.

---

## Tingkat Wewenang Engine (Authority Layers)

Di V.10.2, engine-engine punya **peran berbeda**. Penting buat tau siapa boleh ngapain.

| Tingkat | Engine | Peran | Behavior |
|---------|--------|-------|----------|
| **PRIMARY** | identity, classification, taxonomy, period, time_window, trigger, claim, proof, payment, scope, reward, ticket, loyalty, referral, result_event, fulfillment, variant, dependency, invalidation, terms, risk | **Sumber kebenaran resmi** | Danila baca dari sini. Form Wizard tampilin dari sini. |
| **OPERATIONAL** | readiness, meta | Status & metadata | Bukan business data. Untuk operator/sistem. |
| **AUXILIARY** | reasoning, mechanics | **Catatan kerja AI** (audit/debug) | Danila gak baca. Form Wizard gak tampilin. Kalau bentrok sama PRIMARY → PRIMARY menang. |
| **DERIVED** | projection | **Hasil hitungan otomatis** | Read-only. AI extractor dilarang nulis langsung. |

**Analogi sederhana:**

- **PRIMARY** = akta resmi (yang dipakai semua orang)
- **OPERATIONAL** = stempel & tanggal (info administratif)
- **AUXILIARY** = catatan corat-coret (audit kalau ada masalah)
- **DERIVED** = ringkasan otomatis (kayak summary di kartu identitas)

---

## Field Utama (Root JSON)

| Field | Tipe | Fungsi |
|-------|------|--------|
| `domain` | teks | Selalu `"promo_knowledge"`. Penanda data promo. |
| `record_id` | teks | ID unik per promo. Auto-generate. |
| `created_at` | waktu | Kapan data dibuat. |
| `updated_at` | waktu | Kapan data terakhir diubah. |

---

# DAFTAR ENGINE (26 Engine V.10.2)

---

## 1. identity_engine — Identitas Promo

**Untuk apa?** Nyimpen info "siapa pemilik promo ini" dan "apa nama promonya."

Danila baca dari sini kalau ditanya: *"Promo apa ini?"* atau *"Ini brand siapa?"*

### client_block — Brand pemilik
| Field | Tipe | Fungsi |
|-------|------|--------|
| `client_id` | teks | ID brand. Huruf kecil. Contoh: `"lautan77"`. |
| `client_id_field_status` | teks | Dari mana ID brand ini tau? `explicit` / `inferred` / `propagated`. |
| `client_id_confidence` | teks | Seberapa yakin AI? `high` / `medium` / `low`. |
| `client_name` | teks | Nama tampilan. Contoh: `"LAUTAN77"`. |

### promo_block — Info promo
| Field | Tipe | Fungsi |
|-------|------|--------|
| `promo_name` | teks | Nama promo sesuai aslinya. |
| `promo_type` | teks | Jenis promo. Contoh: `deposit_bonus`, `cashback`, `rollingan`. Lihat F3. |
| `target_user` | teks | Targetnya siapa. `new_member` / `existing_member` / `vip` / `all_member`. |
| `promo_mode` | teks | Satu promo atau banyak varian? `single` / `multi`. |

---

## 2. classification_engine — Kategori Promo

**Untuk apa?** Ngelompokin promo ke 3 kategori: A (Reward), B (Event), C (Aturan Sistem). Plus nyimpen alasan AI kenapa pilih kategori itu.

**Kenapa penting?** Beda kategori = beda cara display, beda cara Danila jawab.

### result_block — Hasil klasifikasi
| Field | Tipe | Fungsi |
|-------|------|--------|
| `program_classification` | teks | `A` = Reward Program, `B` = Event, `C` = Aturan Sistem. |
| `secondary_classifications` | daftar | Kategori tambahan kalau promo masuk lebih dari satu. |
| `review_confidence` | teks | `high` / `medium` / `low`. |

### question_block — Jejak pertanyaan AI
AI ngecek 4 pertanyaan sebelum memutuskan kategori. Ini jejaknya — buat audit kalau ada keraguan.

| Field | Tipe | Fungsi |
|-------|------|--------|
| `q1` | objek | Pertanyaan: apakah ini program reward berkelanjutan? |
| `q2` | objek | Pertanyaan: ada periode atau kompetisi terbatas? |
| `q3` | objek | Pertanyaan: ini aturan sistem umum? |
| `q4` | objek | Konfirmasi kategori final. |
| `q*.answer` | teks | `ya` / `tidak`. |
| `q*.reasoning` | teks | Kenapa AI jawab demikian. |
| `q*.evidence` | teks | Kutipan dari teks promo yang jadi dasar jawaban. |

### meta_block — Catatan proses
| Field | Tipe | Fungsi |
|-------|------|--------|
| `quality_flags` | daftar | Tanda kualitas baca AI. `valid` / `warning` / `needs_review`. |
| `evidence_count` | angka | Berapa bukti yang AI temuin di teks. |
| `override` | ya/tidak | Apakah operator/tim ubah kategori AI. |
| `override_detail` | objek | Detail override (kalau ada). |
| `prompt_version` | teks | Versi instruksi AI yang dipakai. |
| `latency_ms` | angka | Waktu AI baca promo (milidetik). |

---

## 3. taxonomy_engine — Bentuk Struktur Promo

**Untuk apa?** Nentuin bentuk dasar promo: flat (nilai tetap), formula (dihitung), tier (bertingkat), atau matrix (tabel).

### mode_block — Bentuk
| Field | Tipe | Fungsi |
|-------|------|--------|
| `mode` | teks | `fixed` / `formula` / `tier` / `matrix`. |
| `tier_archetype` | teks | Tipe tingkatan kalau `mode = tier`. Contoh: `level`, `turnover_threshold_ladder`, `winstreak_count`. |

> **Catatan winstreak_count:** Ini metadata tier shape — bukan tempat nyimpen reward winstreak. Reward winstreak tetap di `reward_engine.reward_table_block` dengan `table_type = "streak_ladder"`. Lihat F3 dan Governance Section 5.6.

### logic_block — Cara hitung
| Field | Tipe | Fungsi |
|-------|------|--------|
| `conversion_formula` | teks | Rumus reward. Contoh: `"deposit * 0.05"`. |
| `turnover_basis` | teks | Dasar hitung turnover. `bonus_only` / `deposit_only` / `deposit_plus_bonus` / `total_bet` / `total_loss`. |

### tier_threshold_block — Tier Simple (V.10.2 BARU)

**Untuk apa?** Pola simple: 1 input → 1 output. Contoh: cashback 5% kalau loss < 1jt, 7% kalau 1-5jt, 10% kalau > 5jt.

| Field | Tipe | Fungsi |
|-------|------|--------|
| `enabled` | ya/tidak | Pakai tier threshold? |
| `basis` | teks | Apa yang diukur. `loss` / `deposit` / `turnover`. |
| `unit` | teks | Satuan basis. `idr` / `percent` / `count`. |
| `ranges` | daftar | Daftar range tier (lihat detail di bawah). |

#### ranges[] — Detail per range
Setiap item:
| Field | Tipe | Fungsi |
|-------|------|--------|
| `range_id` | teks | ID unik range. Format: `r_001`, `r_002`. |
| `label` | teks | Label display (opsional). Contoh: `"Bronze"`, `"Silver"`. |
| `threshold_min` | angka | Nilai minimal (inclusive). |
| `threshold_max` | angka | Nilai maksimal (inclusive). |
| `threshold_max_unlimited` | ya/tidak | `true` kalau threshold_max = tak terbatas. |
| `reward_percent` | angka | Reward berupa persentase. |
| `reward_amount` | angka | Reward berupa nominal tetap. |
| `reward_unit` | teks | `percent` / `idr` / `multiplier` / `points` / `items`. |
| `note` | teks | Catatan tambahan. |

---

## 4. period_engine — Kapan Promo Berlaku

**Untuk apa?** Nyimpen tanggal mulai/akhir, kapan reward dibagikan.

### validity_block — Masa berlaku
| Field | Tipe | Fungsi |
|-------|------|--------|
| `valid_from` | tanggal | Tanggal mulai. Null kalau gak disebut. |
| `valid_until` | tanggal | Tanggal akhir. Null kalau gak ada batas atau gak disebut. |
| `valid_until_unlimited` | ya/tidak | `true` HANYA kalau promo eksplisit bilang "selamanya". |
| `validity_mode` | teks | `absolute` (sampai tanggal X) atau `relative` (X hari dari klaim). |
| `validity_duration_value` | angka | Durasi (kalau `relative`). |
| `validity_duration_unit` | teks | `hours` / `days` / `weeks` / `months`. |

### distribution_block — Jadwal bagi-bagi
| Field | Tipe | Fungsi |
|-------|------|--------|
| `claim_frequency` | teks | Seberapa sering bisa klaim. `once` / `daily` / `weekly` / `monthly` / `on_trigger`. |
| `calculation_period` | teks | Periode hitung reward. Contoh: `"weekly_tuesday_to_monday"`. |
| `distribution_day` | teks | Hari bagi-bagi. Contoh: `"tuesday"`. |

### schedule_variant_block — Variasi Jadwal (V.10.2 BARU)

**Untuk apa?** Reward beda berdasarkan hari. Contoh: cashback weekday 5%, weekend 7%. Atau birthday bonus yang aktif cuma di hari ulang tahun.

| Field | Tipe | Fungsi |
|-------|------|--------|
| `enabled` | ya/tidak | Ada variasi jadwal? |
| `variants` | daftar | Daftar varian per kondisi hari. |

---

## 5. time_window_engine — Jam-jam Spesifik

**Untuk apa?** Zona waktu, jam buka klaim, jam reset.

### timezone_block — Zona waktu
| Field | Tipe | Fungsi |
|-------|------|--------|
| `timezone` | teks | `Asia/Jakarta` / `Asia/Makassar` / `Asia/Jayapura`. |
| `offset` | teks | Contoh: `"GMT+7"`. |

### claim_window_block — Jam klaim
| Field | Tipe | Fungsi |
|-------|------|--------|
| `enabled` | ya/tidak | Ada batasan jam klaim? |
| `start_time` | teks | Jam mulai. Format: `"HH:MM"`. |
| `end_time` | teks | Jam tutup. |
| `days` | daftar | Hari berlaku. Kosong = setiap hari. |

### distribution_window_block — Jam bagi-bagi
| Field | Tipe | Fungsi |
|-------|------|--------|
| `enabled` | ya/tidak | Ada jam khusus bagi-bagi? |
| `start_time` | teks | Jam mulai. |
| `end_time` | teks | Jam selesai. |
| `days` | daftar | Hari berlaku. |

### reset_block — Waktu reset
| Field | Tipe | Fungsi |
|-------|------|--------|
| `enabled` | ya/tidak | Ada reset berkala? |
| `reset_time` | teks | Jam reset. Contoh: `"23:59"` untuk Lucky Spin. |
| `reset_frequency` | teks | `daily` / `weekly`. |

---

## 6. trigger_engine — Pemicu Promo

**Untuk apa?** Apa yang harus terjadi sebelum promo bisa diklaim?

Contoh trigger: deposit, kalah, scatter di slot, download APK, hasil togel cocok.

### primary_trigger_block — Pemicu utama
| Field | Tipe | Fungsi |
|-------|------|--------|
| `trigger_event` | teks | Kejadian pemicu. `deposit` / `loss_incurred` / `first_deposit` / `turnover_reached` / `game_event` / `apk_download` / `lottery_result_match`. |
| `action` | teks | Apa yang terjadi setelah pemicu. |
| `evidence` | teks | Kutipan teks promo. |

### trigger_rule_block — Aturan pemicu
| Field | Tipe | Fungsi |
|-------|------|--------|
| `rule_type` | teks | Jenis aturan. |
| `conditions` | daftar | Kondisi yang harus dipenuhi. |
| `logic_operator` | teks | `AND` / `OR` / `XOR`. |

### alternative_triggers_block — Pemicu alternatif
| Field | Tipe | Fungsi |
|-------|------|--------|
| `or_conditions` | daftar | Salah satu cukup. |
| `and_conditions` | daftar | Semua harus terpenuhi. |

---

## 7. claim_engine — Cara Klaim

**Untuk apa?** Gimana member klaim reward.

Danila baca dari sini kalau ditanya: *"Cara klaimnya gimana?"* atau *"Syarat klaim apa aja?"*

### method_block — Metode klaim
| Field | Tipe | Fungsi |
|-------|------|--------|
| `claim_method` | teks | `auto` / `manual_livechat` / `manual_whatsapp` / `in_app_button`. |
| `auto_credit` | ya/tidak | Kalau `true`, reward otomatis masuk tanpa minta. |

### channels_block — Saluran klaim
| Field | Tipe | Fungsi |
|-------|------|--------|
| `channels` | daftar | Saluran yang tersedia. |
| `priority_order` | daftar | Urutan saluran diutamakan. |

### claim_gate_block — Gerbang Klaim (V.10.2 BARU)

**Penting!** Block ini punya cerita.

**Dulu di V.10.1**, field `min_withdraw` ada di `reward_engine.requirement_block`. Tapi ini gak masuk akal — min WD itu syarat *klaim*, bukan syarat reward. Akhirnya bingung sendiri.

**Sekarang di V.10.2**, semua syarat klaim dikumpulin di sini, di `claim_gate_block`. Cleaner, lebih masuk akal.

#### Deposit & Withdraw Requirements
| Field | Tipe | Fungsi |
|-------|------|--------|
| `requires_deposit_before_claim` | ya/tidak | Harus deposit dulu baru bisa klaim? |
| `min_deposit_for_claim` | angka | Minimal deposit biar bisa klaim. |
| `requires_withdraw_before_claim` | ya/tidak | Harus WD dulu baru bisa klaim? |
| `min_withdraw_for_claim` | angka | Minimal WD biar bisa klaim event. |

#### Claim Sequence
| Field | Tipe | Fungsi |
|-------|------|--------|
| `requires_claim_before_play` | ya/tidak | Harus klaim dulu sebelum main? |
| `requires_claim_before_withdraw_form` | ya/tidak | Harus klaim dulu sebelum buka form WD? |
| `requires_claim_after_event_result` | ya/tidak | Klaim setelah hasil event keluar? |

#### Active User Requirement
| Field | Tipe | Fungsi |
|-------|------|--------|
| `requires_active_user_id` | ya/tidak | Harus user_id aktif? |
| `active_user_period_value` | angka | Periode user_id aktif. Contoh: `30`. |
| `active_user_period_unit` | teks | Satuan periode. `days` / `weeks`. |
| `active_user_min_turnover` | angka | Min turnover untuk dianggap aktif. |

#### History Deposit Requirement
| Field | Tipe | Fungsi |
|-------|------|--------|
| `requires_history_deposit` | ya/tidak | Harus pernah deposit dalam periode tertentu? (Contoh: birthday bonus.) |
| `min_history_deposit_amount` | angka | Min total deposit dalam periode. |
| `history_deposit_period_value` | angka | Berapa lama periode history. |
| `history_deposit_period_unit` | teks | Satuan periode. `days` / `months`. |

#### Claim Deadline
| Field | Tipe | Fungsi |
|-------|------|--------|
| `claim_deadline_value` | angka | Nilai batas klaim. Contoh: `24`. |
| `claim_deadline_unit` | teks | `hours` / `days`. |
| `claim_deadline_anchor` | teks | Dihitung dari mana? `deposit` / `withdraw` / `event_result` / `level_up` / `claim` / `signup` / `birthday` / `prize_announcement` / `match_end` / `period_end`. |

#### Claim Limit & Reset
| Field | Tipe | Fungsi |
|-------|------|--------|
| `claim_limit_per_period` | angka | Maks klaim per periode. Contoh: `1` (1x per hari). |
| `claim_limit_period` | teks | Periode limit. `daily` / `weekly` / `monthly` / `yearly` / `per_event` / `per_match` / `lifetime`. |
| `claim_limit_scope` | teks | Scope limit. `per_user` / `per_event` / `per_match` / `per_promo` / `per_account` / `lifetime_per_user` / `account_wide`. |
| `claim_reset_frequency` | teks | Reset claim count seberapa sering. `daily` / `weekly`. |
| `claim_reset_time` | teks | Jam reset. Format: `"HH:MM"`. |

> **Catatan `min_withdraw_for_claim`:** Field ini ada di **3 tempat**:
> 1. `claim_engine.claim_gate_block` (global)
> 2. `variant_engine.items_block.subcategories[i].claim_gate_block` (per-varian — override global)
> 3. `projection_engine.summary_block.min_withdraw` (hasil hitungan — AI dilarang isi langsung)
>
> Aturan: per-varian menang atas global. Projection dihitung otomatis dari 2 yang di atas.

### proof_requirement_block — Bukti yang dibutuhkan
| Field | Tipe | Fungsi |
|-------|------|--------|
| `proof_required` | ya/tidak | Harus kirim bukti? |
| `proof_types` | daftar | Jenis bukti. `screenshot_win` / `screenshot_deposit` / `foto_ktp`. |
| `proof_destinations` | daftar | Kirim ke mana. `livechat` / `whatsapp_official` / `telegram_official`. |

### instruction_block — Langkah klaim
| Field | Tipe | Fungsi |
|-------|------|--------|
| `claim_steps` | daftar | Langkah-langkah klaim berurutan. |
| `claim_url` | teks | URL form klaim (kalau ada). |

---

## 8. proof_engine — Bukti Promo

**Untuk apa?** Bukti yang harus diunggah ke sosmed atau dokumen yang harus dikirim. Beda sama `claim_engine.proof_requirement_block` — proof_engine ini buat **syarat promo** (bukan buat klaim).

### social_proof_block — Bukti sosmed
| Field | Tipe | Fungsi |
|-------|------|--------|
| `platforms` | daftar | Sosmed yang harus dipakai. `["facebook", "instagram"]`. |
| `hashtags` | daftar | Hashtag yang wajib. |
| `content_requirements` | daftar | Konten spesifik yang harus ada. |

### screenshot_proof_block — Bukti screenshot
| Field | Tipe | Fungsi |
|-------|------|--------|
| `ss_targets` | daftar | Apa yang harus di-screenshot. Contoh: `["big_win", "balance"]`. |
| `rules` | daftar | Aturan pengambilan screenshot. |

### document_proof_block — Bukti Dokumen (V.10.2 BARU)

**Untuk apa?** KYC atau dokumen verifikasi. Contoh: birthday bonus minta foto KTP, atau WD verifikasi minta selfie + KTP + cocokin nama rekening.

| Field | Tipe | Fungsi |
|-------|------|--------|
| `documents_required` | daftar | Jenis dokumen yang dibutuhkan. Contoh: `["ktp", "selfie_with_ktp"]`. |
| `identity_match_required` | ya/tidak | `true` kalau identitas (KTP) harus match dengan data akun. |
| `account_name_match_required` | ya/tidak | `true` kalau nama rekening WD harus match nama di akun. |

---

## 9. payment_engine — Metode Pembayaran

**Untuk apa?** Metode pembayaran apa yang berlaku/gak berlaku.

### deposit_block — Metode deposit
| Field | Tipe | Fungsi |
|-------|------|--------|
| `deposit_method` | teks | `bank` / `ewallet` / `pulsa` / `qris` / `crypto` / `all`. |
| `deposit_method_providers` | daftar | Provider spesifik. `["BCA", "MANDIRI"]` atau `["DANA", "OVO"]`. |
| `deposit_rate` | angka | Rate khusus (kalau ada diskon biaya transfer). |

### method_whitelist_block — Yang diizinkan
| Field | Tipe | Fungsi |
|-------|------|--------|
| `methods` | daftar | Metode yang eksplisit boleh dipakai. |
| `providers` | daftar | Provider yang diizinkan. |

### method_blacklist_block — Yang dilarang
| Field | Tipe | Fungsi |
|-------|------|--------|
| `methods` | daftar | Metode yang eksplisit gak boleh. |
| `providers` | daftar | Provider yang dilarang. |

---

## 10. scope_engine — Cakupan Promo

**Untuk apa?** Promo ini berlaku di game apa, platform apa, wilayah apa.

Danila baca dari sini kalau ditanya: *"Promo ini berlaku di game apa?"*

### game_block — Cakupan game
| Field | Tipe | Fungsi |
|-------|------|--------|
| `game_domain` | teks | `slot` / `casino` / `sportsbook` / `togel` / `all`. |
| `markets` | daftar | Market spesifik. |
| `applicable_markets` | daftar | Market dimana promo berlaku. |
| `eligible_providers` | daftar | Provider yang termasuk. |
| `included_providers` | daftar | Whitelist provider. |
| `excluded_providers` | daftar | Provider dikecualikan. |
| `included_games` | daftar | Game spesifik yang masuk. |
| `excluded_games` | daftar | Game spesifik yang dikecualikan. |
| `bet_types` | daftar | Jenis taruhan. `single_bet` / `mix_parlay`. |
| `match_types` | daftar | Jenis pertandingan. |
| `market_types` | daftar | Jenis market. |

### platform_block — Platform akses
| Field | Tipe | Fungsi |
|-------|------|--------|
| `platform_access` | teks | `web` / `apk` / `mobile` / `all`. |
| `apk_required` | ya/tidak | Promo cuma bisa di APK? |

### geo_block — Wilayah
| Field | Tipe | Fungsi |
|-------|------|--------|
| `geo_restriction` | teks | `indonesia` / `jakarta` / `sea` / `global`. |

### blacklist_block — Pengecualian umum
| Field | Tipe | Fungsi |
|-------|------|--------|
| `types` | daftar | Jenis game yang dikecualikan. |
| `providers` | daftar | Provider yang dikecualikan. |
| `games` | daftar | Game spesifik dikecualikan. |
| `rules` | daftar | Aturan pengecualian (narasi). |

### odds_constraint_block — Batasan Odds (V.10.2 BARU)

**Untuk apa?** Sports parlay events yang punya batasan odds. Contoh: min odds 1.85 per bet.

| Field | Tipe | Fungsi |
|-------|------|--------|
| `min_odds` | angka | Min odds per bet. |
| `max_odds` | angka | Max odds per bet. |
| `min_total_odds` | angka | Min total odds parlay. |

### bet_configuration_block — Konfigurasi Bet (V.10.2 BARU)

**Untuk apa?** Sports parlay configuration. Contoh: minimal 5 tim, minimal stake 30k.

| Field | Tipe | Fungsi |
|-------|------|--------|
| `min_stake` | angka | Min stake per bet. |
| `min_team_count` | angka | Min jumlah tim/legs. |
| `max_team_count` | angka | Max jumlah tim/legs. |
| `required_market_segments` | daftar | Segmen market wajib. Contoh: `["quarter_handicap"]`. |
| `required_market_segment_count` | angka | Berapa segmen yang wajib dipenuhi. |

---

## 11. reward_engine — Reward Promo

**Untuk apa?** Hadiah promo — nilainya, cara hitung, bentuknya.

Danila baca dari sini kalau ditanya: *"Hadiahnya apa?"* atau *"Berapa cashback yang dapat?"*

> **Catatan penting V.10.2:**
> Di V.10.1 ada catatan yang bilang "data asli paling benar ada di `mechanics_engine.items[]`."
> **Catatan itu sudah DIHAPUS.** Sekarang `reward_engine` = sumber kebenaran resmi. `mechanics_engine` cuma catatan kerja AI.

### event_block — Reward utama
| Field | Tipe | Fungsi |
|-------|------|--------|
| `event_rewards` | daftar | Daftar reward utama. |
| `prizes` | daftar | Hadiah untuk event ranking/turnover. |

### requirement_block — Syarat reward
| Field | Tipe | Fungsi |
|-------|------|--------|
| `min_deposit` | angka | Min deposit buat dapat reward. |
| `unlock_conditions` | daftar | Kondisi tambahan untuk buka reward. |

> **Hilang di V.10.2:** Field `min_withdraw` (yang dulu ada di sini di V.10.1) **dipindah** ke `claim_engine.claim_gate_block.min_withdraw_for_claim`. Alasannya simple: min WD itu syarat klaim, bukan syarat reward.

### turnover_tier_by_deposit_block — Turnover per Tier Deposit (V.10.2 BARU)

**Untuk apa?** Welcome bonus yang multiplier turnover-nya beda berdasarkan jumlah deposit. Contoh:
- Deposit < 500k → turnover 8x
- Deposit ≥ 500k → turnover 5x

| Field | Tipe | Fungsi |
|-------|------|--------|
| `enabled` | ya/tidak | Pakai tier by deposit? |
| `tiers` | daftar | Tier per range deposit (lihat detail di bawah). |

#### tiers[] — Detail per tier deposit
Setiap item:
| Field | Tipe | Fungsi |
|-------|------|--------|
| `tier_id` | teks | ID unik tier. Format: `td_001`, `td_002`. |
| `deposit_threshold_min` | angka | Minimal deposit untuk tier ini. |
| `deposit_threshold_max` | angka | Maksimal deposit untuk tier ini. |
| `deposit_threshold_max_unlimited` | ya/tidak | `true` kalau threshold_max tak terbatas. |
| `turnover_multiplier` | angka | Multiplier turnover untuk tier ini. Contoh: `8` untuk 8x. |
| `turnover_basis` | teks | `bonus_only` / `deposit_only` / `deposit_plus_bonus` / `total_bet` / `total_loss`. |
| `note` | teks | Catatan tambahan. |

### combo_reward_block — Reward Gabungan
| Field | Tipe | Fungsi |
|-------|------|--------|
| `combo_items` | daftar | Kombinasi reward. Contoh: mobil + uang tunai. |

### reward_table_block — Tabel Reward 1-Dimensi (V.10.2 BARU)

**Untuk apa?** Pola reward berbentuk ladder/tangga dengan 1 dimensi. Contoh:
- Turnover 10jt → reward 50k
- Turnover 25jt → reward 150k
- Turnover 50jt → reward 400k

Atau winstreak:
- Menang beruntun 5 → 300k
- Menang beruntun 6 → 500k
- Menang beruntun 10 → 2.5jt

| Field | Tipe | Fungsi |
|-------|------|--------|
| `enabled` | ya/tidak | Pakai reward table? |
| `table_type` | teks | Tipe tabel. `turnover_ladder` / `parlay_team_count_table` / `parlay_lose_count_table` / `parlay_lose_half_count_table` / `streak_ladder` / `ranking_prize_table` / `event_prize_table` / dll. Lihat F3 Section 1.11 untuk lengkap. |
| `basis` | teks | Apa yang diukur. `turnover` / `deposit` / `team_count` / `win_count` / `lose_count` / `streak_count` / `winstreak_count` / `losestreak_count` / `rank_position`. Lihat F3 untuk lengkap. |
| `rows` | daftar | Daftar baris tabel. Lihat detail per row di bawah. |

> **Catatan winstreak:** Mau modelin pola winstreak (5x menang beruntun)? Pakai `table_type = "streak_ladder"` dengan `basis = "winstreak_count"`. Detail di Governance Section 5.6. Nilai `winstreak_table` (legacy V.10.1) sudah dihapus di V.10.2.

#### rows[] — Detail per baris reward table

Setiap baris memiliki **27 field**, dikelompokkan dalam 4 grup logical:

**Grup 1 — Threshold / Trigger (syarat untuk dapat reward)**
| Field | Tipe | Fungsi |
|-------|------|--------|
| `row_id` | teks | ID unik baris. Format: `r_001`, `r_002`. |
| `label` | teks | Label display untuk row (opsional). |
| `threshold_min` | angka | Nilai minimal threshold (inclusive). |
| `threshold_max` | angka | Nilai maksimal threshold (inclusive). |
| `threshold_unit` | teks | `idr` / `count` / `percent` / `points` / `multiplier`. |
| `trigger_count` | angka | Jumlah trigger (untuk streak/event count). |
| `trigger_count_unit` | teks | `matches` / `days` / `parlay_legs` / `spins` / `events` / `red_cards` / `goals` / `scatter_hits` / `consecutive_wins` / `consecutive_losses`. Lihat F3. |

**Grup 2 — Reward Details (hadiah yang diberikan)**
| Field | Tipe | Fungsi |
|-------|------|--------|
| `reward_type` | teks | `cash` / `bonus_credit` / `free_chip` / `voucher` / `merchandise` / `ticket` / `points` / `combo`. |
| `reward_name` | teks | Nama reward (opsional). |
| `reward_amount` | angka | Nominal reward. |
| `reward_percent` | angka | Persentase reward (kalau persentase). |
| `reward_unit` | teks | `idr` / `percent` / `items` / `points` / `multiplier`. |
| `reward_basis` | teks | `fixed` / `stake_multiplier` / `deposit_multiplier` / `loss_percentage` / `ranking_position` / `random`. |
| `reward_multiplier_of_stake` | angka | Multiplier dari stake (untuk reward yang dihitung dari stake). |
| `physical_reward_name` | teks | Nama hadiah fisik (untuk merchandise). |
| `cash_reward_amount` | angka | Nominal cash (alternatif dari `reward_amount` untuk combo). |
| `bonus_credit_amount` | angka | Nominal bonus credit (alternatif untuk combo). |
| `max_reward` | angka | Batas maksimal reward per baris. |
| `payout_direction` | teks | `upfront` / `backend`. |
| `turnover_multiplier` | angka | Multiplier turnover untuk klaim reward. |

**Grup 3 — Game-Specific (kondisi spesifik game)**
| Field | Tipe | Fungsi |
|-------|------|--------|
| `stake_min` | angka | Minimal stake (sports parlay). |
| `stake_max` | angka | Maksimal stake (sports parlay). |
| `team_count` | angka | Jumlah tim/legs (sports parlay). |
| `win_count` | angka | Jumlah kemenangan (sports parlay). |
| `lose_count` | angka | Jumlah kekalahan (sports parlay). |
| `condition_text` | teks | Kondisi custom dalam teks. |

**Grup 4 — Note**
| Field | Tipe | Fungsi |
|-------|------|--------|
| `note` | teks | Catatan tambahan untuk baris ini. |

> **Cara baca:** Tidak semua field diisi untuk setiap baris. Promo turnover ladder akan pakai Grup 1 (threshold) + Grup 2 (reward) saja. Promo sports parlay akan pakai Grup 3 juga. Promo streak/event pakai Grup 1 (trigger_count). Skeleton JSON `reward_engine.reward_table_block.rows[]` adalah canonical untuk semua 27 field.

### matrix_reward_block — Tabel Reward 2-Dimensi

**Untuk apa?** Pola reward 2-dimensi. Contoh: scatter pattern di slot dengan reward beda berdasarkan kombinasi stake × jumlah scatter.

| Field | Tipe | Fungsi |
|-------|------|--------|
| `axis_x_label` | teks | Label kolom. Contoh: `"stake_amount"`. |
| `axis_y_label` | teks | Label baris. Contoh: `"multiplier"`. |
| `matrix_cells` | daftar | Isi sel-sel tabel. |

### conditional_reward_block — Reward Bersyarat
| Field | Tipe | Fungsi |
|-------|------|--------|
| `conditions` | daftar | Kondisi JIKA/MAKA untuk reward yang beda. |
| `default_reward` | objek | Reward kalau gak ada kondisi yang terpenuhi. |

### unit_reward_block — Reward Per Unit (V.10.2 BARU)

**Untuk apa?** Reward yang dikalikan per unit. Contoh:
- TARUHANBOLA Red Card: Rp15.000 **per kartu merah**
- Slot scatter: 100k **per scatter hit**

Bedanya dengan `reward_table_block`: di sini kelipatan **linear** (10 unit = 10 × reward). Di reward_table, beda tier beda angka non-linear.

| Field | Tipe | Fungsi |
|-------|------|--------|
| `enabled` | ya/tidak | Pakai unit reward? |
| `trigger_unit` | teks | Unit pemicu. `red_card` / `goal` / `scatter_hit`. |
| `value_per_unit` | angka | Nilai per unit. |
| `value_unit` | teks | Satuan nilai. `idr` / `percent` / `multiplier`. |
| `is_accumulative` | ya/tidak | `true` kalau unit di-akumulasi (10 unit = 10× reward). `false` kalau cuma single trigger. |
| `max_units_per_claim` | angka | Max unit yang dihitung per klaim. |
| `max_reward` | angka | Max total reward. |
| `note` | teks | Catatan tambahan. |

### reward_identity_block — Identitas Reward
| Field | Tipe | Fungsi |
|-------|------|--------|
| `item_name` | teks | Nama spesifik item. Contoh: `"iPhone 15 Pro Max"`. Kosong kalau cash. |
| `quantity` | angka | Jumlah item. |

### Field perhitungan flat (di root reward_engine)
| Field | Tipe | Fungsi |
|-------|------|--------|
| `calculation_basis` | teks | Dasar hitung. `deposit` / `loss` / `turnover` / `win`. |
| `calculation_method` | teks | Cara hitung. `percentage` / `fixed` / `tiered` / `matrix_lookup`. |
| `calculation_value` | angka | Nilai. Contoh: `5` untuk 5%. |
| `calculation_unit` | teks | `percent` / `fixed_idr`. |
| `payout_direction` | teks | Kapan dibayar. `upfront` / `backend`. |
| `reward_type` | teks | Bentuk reward. `cash` / `credit_game` / `physical` / `voucher`. |
| `voucher_kind` | teks | Jenis voucher (kalau reward = voucher). |
| `max_reward` | angka | Batas max reward dalam rupiah. |
| `max_reward_unlimited` | ya/tidak | `true` kalau eksplisit gak ada batas. |
| `currency` | teks | Mata uang. AI isi berdasarkan konteks. |

---

## 12. ticket_engine — Tiket & Undian (V.10.2 BARU)

**Untuk apa?** Lucky spin, raffle, undian — apapun yang pakai mekanisme tiket.

Contoh promo:
- CITRA77 Lucky Spin
- PRESIDENSLOT Bagi HP (random draw)
- OLXTOTO 25 Smartphone undian
- TARUHANBOLA Lucky Wheel

### ticket_block — Tiket
| Field | Tipe | Fungsi |
|-------|------|--------|
| `enabled` | ya/tidak | Promo punya mekanisme tiket? |
| `ticket_name` | teks | Nama tiket. Contoh: `"Lucky Spin Ticket"`, `"Lottery Coupon"`. |
| `ticket_source` | teks | Cara dapat tiket. `deposit` / `turnover` / `event_completion`. |
| `min_deposit_for_ticket` | angka | Min deposit biar dapat tiket. |
| `deposit_per_ticket` | angka | Berapa deposit/turnover untuk dapat 1 tiket. Contoh: 1jt turnover = 1 tiket. |
| `is_accumulative` | ya/tidak | `true` kalau tiket di-akumulasi. |
| `max_ticket_per_claim` | angka | Max tiket per klaim. |
| `max_ticket_per_day` | angka | Max tiket per hari per user. |
| `validity_duration_value` | angka | Berapa lama tiket valid. |
| `validity_duration_unit` | teks | Satuan. `hours` / `days`. |
| `valid_until_time` | teks | Jam expired tiket. Format: `"HH:MM"`. |
| `expires_on_reset` | ya/tidak | `true` kalau tiket expired pas reset (e.g. tengah malam). |
| `ticket_payment_method_exclusion` | daftar | Metode pembayaran yang gak dapet tiket. Contoh: `["pulsa", "qris"]`. |

### draw_block — Undian
| Field | Tipe | Fungsi |
|-------|------|--------|
| `draw_type` | teks | `lucky_spin` / `random_draw` / `wheel_spin`. |
| `draw_frequency` | teks | Seberapa sering undian. `daily` / `weekly` / `event_based`. |
| `draw_time` | teks | Jam undian. Format: `"HH:MM"`. |
| `winner_selection` | teks | Cara pilih pemenang. `random` / `tier_based`. |
| `prize_pool` | daftar | Daftar hadiah dengan probabilitas/quantity. |

---

## 13. loyalty_engine — Poin Loyalitas

**Untuk apa?** Sistem poin loyalitas, cara tukar, tingkatan member.

### mechanism_block — Cara dapat poin
| Field | Tipe | Fungsi |
|-------|------|--------|
| `point_name` | teks | Nama poin. `LP` / `EXP` / `XP` / `COIN` / `GEM`. |
| `earning_rule` | teks | Cara dapat. Contoh: `"1 LP per 1000 turnover"`. |
| `loyalty_mode` | teks | `exp_store` (tukar poin) / `level_up` (naik level) / `both`. |

### exchange_block — Tukar poin
| Field | Tipe | Fungsi |
|-------|------|--------|
| `exchange_groups` | daftar | Kelompok penukaran. Setiap kelompok: nama, batas klaim, hadiah. |

### tier_block — Tingkatan member
| Field | Tipe | Fungsi |
|-------|------|--------|
| `tier_system` | daftar | Sistem tingkatan. Contoh: Bronze → Silver → Gold. |

---

## 14. referral_engine — Referral Commission (V.10.2 BARU)

**Untuk apa?** Program referral dengan struktur komisi yang detail.

Contoh promo:
- CITRA77 Referral up to 15%
- PRESIDENSLOT Referral 1%
- OLXTOTO Referral 4 variants
- TARUHANBOLA Lifetime 0.2%
- BOSTONTOTO Togel 0.5% per market

### program_block — Program
| Field | Tipe | Fungsi |
|-------|------|--------|
| `enabled` | ya/tidak | Promo ini referral program? |
| `referral_type` | teks | Jenis program. `lifetime_commission` / `tier_based` / `one_time_bonus`. |
| `commission_basis` | teks | Dasar komisi. `downline_turnover` / `downline_loss` / `downline_deposit`. |
| `commission_rate` | angka | Rate komisi. Contoh: `0.5` untuk 0.5%. |
| `commission_unit` | teks | Satuan. `percent` / `fixed_idr`. |
| `eligible_game_types` | daftar | Game types yang masuk perhitungan. `["slot", "live_casino", "togel"]`. |
| `eligible_markets` | daftar | Market spesifik. Untuk togel: `["sydney", "singapore", "hk"]`. |
| `min_downline_count` | angka | Min jumlah downline untuk eligible. |
| `min_downline_turnover` | angka | Min turnover downline untuk dapat komisi. |
| `downline_period_value` | angka | Periode hitung downline activity. |
| `downline_period_unit` | teks | Satuan periode. `days` / `weeks` / `months`. |
| `requires_downline_active` | ya/tidak | Downline harus aktif untuk eligible? |
| `requires_referrer_kyc` | ya/tidak | Referrer harus KYC verified? |
| `requires_media_disclosure` | ya/tidak | Wajib disclose di sosmed kalau ngajak referral? |
| `is_lifetime` | ya/tidak | `true` kalau komisi berlaku seumur hidup downline. |

### commission_rule_block — Aturan komisi
| Field | Tipe | Fungsi |
|-------|------|--------|
| `rules` | daftar | Komisi per game/market (lihat detail di bawah). |

#### rules[] — Detail per aturan komisi

Setiap rule:
| Field | Tipe | Fungsi |
|-------|------|--------|
| `rule_id` | teks | ID unik rule. Format: `{game_type}_{tier_index}`. Contoh: `slot_1`, `togel_sydney_1`. |
| `game_type` | teks | `slot` / `casino` / `live_casino` / `sports` / `togel` / `arcade` / `e_lottery` / `sabung_ayam` / `mixed` / `all`. |
| `market` | teks | Market spesifik (untuk togel). Contoh: `"sydney"`, `"singapore"`, `"hk"`. |
| `basis` | teks | Dasar komisi. `downline_bet` / `downline_loss` / `downline_winlose` / `downline_turnover` / `first_deposit` / `net_winlose`. |
| `rate` | angka | Rate komisi. Contoh: `0.5` untuk 0.5%. |
| `rate_unit` | teks | `percent` / `fixed_idr` / `multiplier`. |
| `min_downline` | angka | Minimal jumlah downline untuk eligible (opsional). |
| `min_winlose` | angka | Minimal winlose downline untuk eligible (opsional). |
| `deposit_basis_anchor` | teks | `first_deposit` / `total_deposit` / `period_deposit` / `none`. |
| `condition_text` | teks | Kondisi custom dalam teks. |

### deduction_block — Pemotongan
| Field | Tipe | Fungsi |
|-------|------|--------|
| `deductions` | daftar | Pemotongan sebelum komisi. Contoh: jackpot win deduction. |

### simulation_block — Simulasi
| Field | Tipe | Fungsi |
|-------|------|--------|
| `rows` | daftar | Contoh perhitungan komisi (kalau promo nyediain). Setiap row: kondisi input + hasil komisi. |

### distribution_block — Distribusi
| Field | Tipe | Fungsi |
|-------|------|--------|
| `distribution_frequency` | teks | Seberapa sering komisi dibagikan. `daily` / `weekly` / `monthly`. |
| `distribution_day` | teks | Hari spesifik. Contoh: `"monday"`. |
| `distribution_time` | teks | Jam distribusi. Format: `"HH:MM"`. |
| `auto_credit` | ya/tidak | `true` kalau otomatis masuk saldo tanpa perlu klaim. |

### link_block — Link referral
| Field | Tipe | Fungsi |
|-------|------|--------|
| `requires_referral_link` | ya/tidak | Wajib pakai link referral untuk track downline? |
| `link_format` | teks | Format link referral. |
| `example_link` | teks | Contoh link. Contoh: `"https://bostontoto88.com/link.php?member=USERNAME"`. |

---

## 15. result_event_engine — Event Berbasis Hasil (V.10.2 BARU)

**Untuk apa?** Promo yang reward-nya nentuin berdasarkan hasil/result eksternal.

Contoh: **OLXTOTO Mystery Number** — nomor rekening member dicocokin dengan hasil togel. Kalau cocok → dapat reward.

### result_match_block — Pencocokan hasil

> **CRITICAL fix V.10.2:** Field `match_logic` adalah **string** (enum), BUKAN object. F2 V.10.1 lama salah mendefinisikan sebagai object — ini sudah dibetulkan.

| Field | Tipe | Fungsi |
|-------|------|--------|
| `enabled` | ya/tidak | Promo ini result-based? |
| `result_source` | teks | Sumber hasil. `togel` / `lottery` / `sports_match` / `game_event` / `casino_result` / `slot_event`. |
| `result_source_markets` | daftar | Market sumber result. Contoh: `["sydney", "hk", "singapore"]`. |
| `match_target` | teks | Target yang dicocokkan. `account_number` / `member_id` / `phone_number` / `username` / `birthdate` / `bank_account_last_digits` / `custom_input`. |
| `match_digits` | angka | Jumlah digit yang dicocokkan (opsional). |
| `match_position` | teks | Posisi digit. `last_4` / `last_3` / `last_2` / `first_4` / `first_3` / `exact` / `middle` / `any_position`. |
| `match_logic` | teks | Logika pencocokan. `exact` / `partial` / `any_order` / `contains` / `prefix` / `suffix` / `range_match`. |
| `claim_window_after_result_hours` | angka | Batas waktu klaim setelah result keluar (jam). |

### prize_block — Hadiah
| Field | Tipe | Fungsi |
|-------|------|--------|
| `prizes` | daftar | Hadiah dengan eligibility per-prize (lihat detail di bawah). |

#### prizes[] — Detail per hadiah

Setiap prize:
| Field | Tipe | Fungsi |
|-------|------|--------|
| `prize_id` | teks | ID unik hadiah. Format: `p_001`, `p_consolation_001`. |
| `prize_tier` | teks | `main` / `consolation` / `tier_1` / `tier_2` / `tier_3` / `tier_4` / `tier_5` / `participation` / `grand_prize` / `runner_up`. |
| `prize_label` | teks | Label display (opsional). |
| `prize_amount` | angka | Nominal hadiah. |
| `prize_currency` | teks | Mata uang. Default `IDR`. |
| `requires_bet_on_match_target` | ya/tidak | `true` kalau harus bet pada nomor/entitas yang match. |
| `minimum_bet_amount` | angka | Minimal bet untuk eligible hadiah ini. |
| `max_winners_per_period` | angka | Maksimal pemenang per periode (opsional). |
| `note` | teks | Catatan tambahan. |

> **Hilang di V.10.2:** Field flat `main_prize_amount` dan `consolation_prize_amount` dari V.10.1 **dihapus**. Diganti `prizes[]` typed array — karena main prize sama consolation bisa beda eligibility (e.g., main minta bet target, consolation gak). Juga `requires_bet_on_number` dan `minimum_bet_amount` di result_match_block dihapus → pindah ke `prizes[].requires_bet_on_match_target` dan `prizes[].minimum_bet_amount` (per-prize).

---

## 16. fulfillment_engine — Pengiriman Hadiah Fisik (V.10.2 BARU)

**Untuk apa?** Reward fisik yang perlu dikirim. Contoh:
- PRESIDENSLOT T-Shirt / motor / HP
- CITRA77 Merchandise
- OLXTOTO Gebyar Bulanan (mobil + motor + HP)
- TARUHANBOLA Parlay Smartphone

### physical_reward_block — Reward fisik
| Field | Tipe | Fungsi |
|-------|------|--------|
| `enabled` | ya/tidak | Promo ini ada reward fisik? |
| `requires_shipping` | ya/tidak | Reward perlu dikirim fisik? |
| `shipping_period_anchor` | teks | Dihitung dari mana kapan dikirim. `after_claim` / `after_event_end` / `after_verification`. |
| `shipping_period_value` | angka | Berapa lama proses pengiriman. |
| `shipping_period_unit` | teks | Satuan waktu. `days` / `weeks`. |
| `shipping_method` | teks | Cara kirim. Contoh: `"JNE"`, `"Sicepat"`, `"diambil di lokasi"`. |
| `recipient_data_required` | daftar | Data penerima yang dibutuhkan. Contoh: `["full_name", "address", "ktp_id", "phone"]`. |
| `stock_replacement_allowed` | ya/tidak | `true` kalau hadiah bisa diganti kalau stock habis. |
| `tax_borne_by` | teks | Siapa yang nanggung pajak. `winner` / `operator` / `split`. |
| `fee_required` | ya/tidak | `true` kalau ada biaya yang harus ditanggung pemenang (misal: biaya pengiriman). |
| `fee_note` | teks | Catatan tentang fee. |
| `can_convert_to_credit` | teks | Pilihan konversi ke saldo. `yes` / `no` / `winner_choice`. |

---

## 17. variant_engine — Promo Multi-Varian

**Untuk apa?** Promo yang punya banyak versi/varian. Contoh: Welcome Bonus 30%/50%/100% — 3 varian dalam 1 promo.

### summary_block — Ringkasan varian
| Field | Tipe | Fungsi |
|-------|------|--------|
| `has_subcategories` | ya/tidak | Promo punya varian? |
| `expected_count` | angka | Berapa varian yang diharapkan. |
| `default_variant_id` | teks | Reference ke varian default. Kosong → UI fallback ke varian pertama. |

### items_block — Detail varian
| Field | Tipe | Fungsi |
|-------|------|--------|
| `subcategories` | daftar | Daftar varian. Diisi kalau `has_subcategories = true`. |

### Field per-varian dalam `subcategories[i]`

**Penting:** Setiap varian punya field-nya sendiri. Per-varian **override** record-level. Contoh: kalau record-level bilang `min_deposit = 50k`, tapi varian Sport bilang `min_deposit = 100k`, yang menang adalah varian (100k).

#### Identifier
| Field | Tipe | Fungsi |
|-------|------|--------|
| `variant_id` | teks | ID varian. |
| `variant_name` | teks | Nama varian. Contoh: `"WELCOME BONUS 50% — CASINO"`. |
| `promo_code` | teks | Kode promo per varian. |

#### Calculation
| Field | Tipe | Fungsi |
|-------|------|--------|
| `calculation_basis` | teks | Override `reward_engine.calculation_basis`. |
| `calculation_method` | teks | Override `reward_engine.calculation_method`. |
| `calculation_value` | angka | Nilai. |
| `calculation_unit` | teks | `percent` / `fixed_idr`. |

#### Requirement & Cap
| Field | Tipe | Fungsi |
|-------|------|--------|
| `min_deposit` | angka | Min deposit untuk varian ini. |
| `max_reward` | angka | Max reward varian. |
| `max_reward_unlimited` | ya/tidak | `true` HANYA kalau sumber eksplisit bilang gak ada batas. |
| `min_claim` | angka | Min nominal yang bisa di-claim. |

#### Turnover
| Field | Tipe | Fungsi |
|-------|------|--------|
| `turnover_multiplier` | angka | Multiplier turnover. Contoh: `20` untuk 20x. |
| `turnover_rule_format` | teks | `multiplier` / `min_rupiah`. |
| `turnover_tier_by_deposit` (V.10.2 BARU) | daftar | Turnover tier per deposit untuk varian. |

#### Game Scope (V.10.2 expanded)
| Field | Tipe | Fungsi |
|-------|------|--------|
| `game_domain` | teks | Jenis game varian. |
| `eligible_providers` | daftar | Provider yang termasuk. |
| `included_providers` (V.10.2) | daftar | Whitelist provider. |
| `excluded_providers` (V.10.2) | daftar | Provider dikecualikan. |
| `included_games` (V.10.2) | daftar | Game spesifik yang masuk. |
| `excluded_games` (V.10.2) | daftar | Game spesifik yang dikecualikan. |
| `game_names` | daftar | Daftar nama game. |
| `bet_types` (V.10.2) | daftar | Jenis taruhan. |
| `match_types` (V.10.2) | daftar | Jenis pertandingan. |
| `market_types` (V.10.2) | daftar | Jenis market. |

#### Blacklist (nested)
| Field | Tipe | Fungsi |
|-------|------|--------|
| `blacklist.enabled` | ya/tidak | Blacklist aktif untuk varian? |
| `blacklist.types` | daftar | Jenis game dilarang. |
| `blacklist.providers` | daftar | Provider dilarang. |
| `blacklist.games` | daftar | Game spesifik dilarang. |
| `blacklist.rules` | daftar | Aturan blacklist. |
| `blacklist.note` | teks | Catatan tambahan. |

#### Claim Gate per-Varian (V.10.2 BARU)

**Penting:** Kalau varian punya claim gate sendiri, taruh di sini. Per-varian **menang** atas global.

> **Catatan:** Per-variant `claim_gate_block` adalah versi **slim** dari global `claim_engine.claim_gate_block`. Per-variant TIDAK punya field `enabled` (auto-active kalau ada field yang diisi), dan TIDAK punya field active_user / history_deposit (itu tetap di global).

| Field | Tipe | Fungsi |
|-------|------|--------|
| `claim_gate_block.requires_deposit_before_claim` | ya/tidak | Harus deposit dulu? |
| `claim_gate_block.min_deposit_for_claim` | angka | Min deposit klaim untuk varian. |
| `claim_gate_block.requires_withdraw_before_claim` | ya/tidak | Harus WD dulu? |
| `claim_gate_block.min_withdraw_for_claim` | angka | Min WD untuk varian ini. |
| `claim_gate_block.requires_claim_before_play` | ya/tidak | Klaim sebelum main? |
| `claim_gate_block.requires_claim_before_withdraw_form` | ya/tidak | Klaim sebelum form WD? |
| `claim_gate_block.requires_claim_after_event_result` | ya/tidak | Klaim setelah result event? |
| `claim_gate_block.claim_deadline_value` | angka | Durasi batas klaim. |
| `claim_gate_block.claim_deadline_unit` | teks | `hours` / `days`. |
| `claim_gate_block.claim_deadline_anchor` | teks | `deposit` / `withdraw` / `event_result` / `level_up` / `claim` / `signup` / `birthday` / `prize_announcement` / `match_end` / `period_end`. |
| `claim_gate_block.claim_limit_per_period` | angka | Max klaim per periode. |
| `claim_gate_block.claim_limit_period` | teks | `daily` / `weekly` / `monthly` / `yearly` / `per_event` / `per_match` / `lifetime`. |
| `claim_gate_block.claim_limit_scope` | teks | `per_user` / `per_event` / `per_match` / `per_promo` / `per_account` / `lifetime_per_user` / `account_wide`. |

#### Reward Type
| Field | Tipe | Fungsi |
|-------|------|--------|
| `reward_type` | teks | Jenis reward varian. |
| `payout_direction` | teks | `upfront` / `backend`. |
| `currency` | teks | Mata uang. |

#### Reward Detail
| Field | Tipe | Fungsi |
|-------|------|--------|
| `physical_reward_name` | teks | Nama hadiah fisik. |
| `physical_reward_quantity` | angka | Jumlah hadiah fisik. |
| `cash_reward_amount` | angka | Nominal cash (untuk fixed cash). |
| `reward_quantity` | angka | Jumlah unit reward. |

#### Voucher (kalau reward = voucher)
| Field | Tipe | Fungsi |
|-------|------|--------|
| `voucher_kind` | teks | Jenis voucher. |
| `voucher_valid_from` | tanggal | Mulai berlaku. |
| `voucher_valid_until` | tanggal | Akhir berlaku. |
| `voucher_valid_unlimited` | ya/tidak | `true` kalau gak ada batas waktu. |

#### Lucky Spin (kalau reward = spin)
| Field | Tipe | Fungsi |
|-------|------|--------|
| `lucky_spin_id` | teks | ID lucky spin di sistem. |
| `lucky_spin_max_per_day` | angka | Max spin per hari per user. |

#### Note
| Field | Tipe | Fungsi |
|-------|------|--------|
| `product_note` | teks | Catatan produk per varian. |

### Field yang hilang di V.10.2 vs V.10.1
| Field hilang | Pengganti |
|--------------|-----------|
| `subcategories[i].min_withdraw` (flat) | `subcategories[i].claim_gate_block.min_withdraw_for_claim` |

---

## 18. dependency_engine — Hubungan Antar Promo

**Untuk apa?** Promo ini bisa digabung dengan promo lain atau tidak.

### exclusion_block — Yang gak bisa digabung
| Field | Tipe | Fungsi |
|-------|------|--------|
| `mutually_exclusive_with` | daftar | Promo yang gak bisa berbarengan. |
| `can_combine_with` | daftar | Promo yang boleh berbarengan. |

### stacking_block — Aturan gabung
| Field | Tipe | Fungsi |
|-------|------|--------|
| `stacking_allowed` | ya/tidak | Bisa digabung sama promo lain? |
| `stacking_policy` | teks | `no_stacking` / `stack_with_whitelist` / `stack_freely` / `conditional_stack`. |
| `rules` | daftar | Aturan dalam narasi. |
| `max_concurrent` | angka | Max promo aktif bersamaan. |

### prerequisite_block — Syarat awal
| Field | Tipe | Fungsi |
|-------|------|--------|
| `requires_promo` | daftar | Promo yang harus aktif dulu. |
| `requires_achievement` | daftar | Pencapaian yang harus dipenuhi. |

---

## 19. invalidation_engine — Pembatalan Promo

**Untuk apa?** Kondisi yang membatalkan promo dan akibatnya.

### void_conditions_block — Kondisi pembatalan

> **Penting:** `void_conditions_block` adalah **array langsung** (bukan object dengan `void_conditions[]` di dalamnya). Setiap item dalam array adalah satu kondisi pembatalan.

Kalau promo gak punya kondisi pembatalan → array kosong `[]`.

Setiap item:
| Field | Tipe | Fungsi |
|-------|------|--------|
| `condition_id` | teks | ID unik kondisi. Format: `vc_001`, `vc_002`. |
| `condition_type` | teks | `fraud` / `violation` / `operational` / `technical` / `eligibility` / `timing` / `behavior`. |
| `scope` | teks | Lingkup pembatalan. `bonus_only` / `winnings_only` / `full_balance` / `per_promo` / `account_wide` / `deposit_amount`. |
| `description` | teks | Deskripsi kondisi pembatalan. Contoh: `"Bonus hunter terdeteksi dari pola taruhan"`. |
| `voids_bonus` | ya/tidak | `true` kalau bonus dihanguskan. |
| `voids_winnings` | ya/tidak | `true` kalau kemenangan dihanguskan. |
| `voids_full_balance` | ya/tidak | `true` kalau seluruh saldo dihanguskan. |
| `evidence` | teks | Kutipan dari teks promo sebagai bukti. |

### penalty_block — Hukuman
| Field | Tipe | Fungsi |
|-------|------|--------|
| `void_action` | teks | `bonus_cancel` / `full_balance_void` / `account_suspend`. |
| `penalty_type` | teks | `bonus_forfeit` / `winnings_forfeit` / `full_forfeit`. |
| `penalty_scope` | teks | `current_promo_only` / `all_active_promos` / `all_account_balance`. |

### anti_fraud_block — Anti-kecurangan
| Field | Tipe | Fungsi |
|-------|------|--------|
| `anti_fraud_rules` | daftar | Aturan anti-fraud spesifik. |
| `detection_methods` | daftar | Cara deteksi fraud. |

---

## 20. terms_engine — Syarat & Ketentuan

**Untuk apa?** S&K promo dalam bentuk narasi.

### conditions_block — S&K
| Field | Tipe | Fungsi |
|-------|------|--------|
| `terms_conditions` | daftar | Daftar S&K dari teks promo asli. |

### requirements_block — Persyaratan khusus
| Field | Tipe | Fungsi |
|-------|------|--------|
| `special_requirements` | daftar | Persyaratan di luar S&K umum. Contoh: KYC, verifikasi ulang tahun. |

---

## 21. readiness_engine — Status Data

**Untuk apa?** Status data promo — dari draft sampai siap publish.

### state_block — Status
| Field | Tipe | Fungsi |
|-------|------|--------|
| `state` | teks | `draft` / `ready` / `published` / `rejected`. |
| `state_changed_at` | waktu | Kapan status berubah. |
| `state_changed_by` | teks | Siapa yang ubah. |

### commit_block — Siap simpan
| Field | Tipe | Fungsi |
|-------|------|--------|
| `ready_to_commit` | ya/tidak | `false` = data awal AI. `true` = sudah dikonfirmasi manusia. |

### validation_block — Hasil cek
| Field | Tipe | Fungsi |
|-------|------|--------|
| `is_structurally_complete` | ya/tidak | Semua field yang dibutuhkan terisi? |
| `status` | teks | `draft` / `ready` / `needs_review` / `rejected`. |
| `warnings` | daftar | Hal yang perlu dicek sebelum publish. |

### observability_block — Catatan kejanggalan
| Field | Tipe | Fungsi |
|-------|------|--------|
| `ambiguity_flags` | daftar | Field yang infonya gak jelas. |
| `contradiction_flags` | daftar | Data yang saling bertentangan. |
| `review_required` | ya/tidak | Perlu dicek manusia? |

---

## 22. reasoning_engine — Catatan Pemikiran AI

**Tingkat: AUXILIARY.** Bukan data bisnis — cuma audit trail.

Danila **gak baca** dari sini.

### intent_block — Niat promo
| Field | Tipe | Fungsi |
|-------|------|--------|
| `primary_action` | teks | `deposit_to_bonus` / `lose_to_cashback` / `bet_to_rollingan`. |
| `reward_nature` | teks | `monetary` / `physical_goods` / `credit_game` / `access_right`. |
| `distribution_path` | teks | Cara reward sampai ke member. |
| `value_shape` | teks | `percentage_of_base` / `fixed_amount` / `tiered_escalating` / `matrix_lookup`. |

### selection_block — Keputusan AI
| Field | Tipe | Fungsi |
|-------|------|--------|
| `mechanic_type` | teks | Jenis mekanik utama. |
| `locked_fields` | daftar | Field yang sudah dikonfirmasi. |
| `invariant_violations` | daftar | Pelanggaran aturan saat baca. |

---

## 23. mechanics_engine — Catatan Mekanik AI (AUXILIARY)

**Status di V.10.2: AUXILIARY layer.** Bukan sumber kebenaran.

### Kenapa diubah dari V.10.1?

Dulu di V.10.1, dokumen bilang *"mechanics_engine = sumber kebenaran utama"*.

Masalahnya: kalau Danila ditanya *"berapa min deposit?"*, dia bingung baca dari mana — `mechanics_engine.items[]` atau `reward_engine.requirement_block.min_deposit`?

**Sekarang jelas:**
- Yang resmi = `reward_engine` (sumber kebenaran)
- `mechanics_engine` = catatan kerja AI (audit doang)

Analogi: kayak corat-coret kasir di balik struk. Ada gunanya untuk audit, tapi yang resmi tetap struk-nya.

### Behavior V.10.2

| Aspek | Status |
|-------|--------|
| Danila baca dari sini? | **TIDAK** (baca dari typed engines) |
| Form Wizard tampilin? | **TIDAK** |
| Validator wajib validate? | TIDAK (boleh skip) |
| `items: []` kosong? | **Boleh** (gak block commit) |
| Bentrok dengan typed engine? | **Typed engine MENANG** |

### source_block — Sumber data
| Field | Tipe | Fungsi |
|-------|------|--------|
| `source` | teks | `llm_text` / `llm_image` / `llm_multimodal` / `manual`. |

### items_block — Unit mekanik (audit trace)
| Field | Tipe | Fungsi |
|-------|------|--------|
| `items` | daftar | Daftar unit mekanik. Setiap unit = satu logika promo (untuk audit). |
| `items[].mechanic_id` | teks | ID. Format: `M01`, `M02`. |
| `items[].mechanic_type` | teks | Jenis mekanik. |
| `items[].evidence` | teks | Kutipan teks promo. |
| `items[].confidence` | angka | Keyakinan AI 0-1. |
| `items[].ambiguity` | ya/tidak | `true` kalau gak jelas. |
| `items[].activation_rule` | objek | Kondisi kapan aktif. |
| `items[].data` | objek | Data spesifik mekanik. |

---

## 24. projection_engine — Ringkasan Otomatis (DERIVED)

**Tingkat: DERIVED.** Read-only. **AI extractor DILARANG nulis langsung** ke sini.

### Apa fungsinya?
Buat display di kartu promo, summary di list view, search index. Semua field di sini **dihitung otomatis** dari engine PRIMARY.

### Aturan
- Extractor nulis ke projection → validator BLOCK commit
- Kalau bentrok dengan PRIMARY → re-compute dari PRIMARY

### _description
| Field | Tipe | Fungsi |
|-------|------|--------|
| `_description` | teks | Penjelasan bahwa block ini DERIVED ONLY. |

### summary_block — Ringkasan utama
| Field | Tipe | Sumber |
|-------|------|--------|
| `promo_summary` | teks | Ringkasan 1 kalimat dari identity + reward + trigger. |
| `main_trigger` | teks | Dari trigger_engine. |
| `main_reward_form` | teks | Dari reward_engine. |
| `main_reward_percent` | angka | Dari `reward_engine.calculation_value` (kalau unit = percent). |
| `main_reward_value` | angka | Nilai reward dalam rupiah. |
| `main_reward_unit` | teks | Satuan reward. |
| `max_reward` | angka | Dari reward_engine. |
| `min_deposit` | angka | Dari `reward_engine.requirement_block.min_deposit`. |
| `min_withdraw` | angka | **Dihitung otomatis**: per-varian claim_gate (kalau multi) → global claim_gate → null. |
| `payout_direction` | teks | Dari reward_engine. |
| `turnover_multiplier` | angka | Dari taxonomy/reward. |
| `turnover_basis` | teks | Dari taxonomy_engine. |
| `_summary_skipped_reason` | teks | Alasan kalau ringkasan gak bisa dibuat. |

### claim_summary_block — Ringkasan cara klaim
| Field | Tipe | Sumber |
|-------|------|--------|
| `primary_claim_method` | teks | Dari claim_engine. |
| `primary_claim_platform` | teks | Platform klaim. |
| `claim_channels` | daftar | Dari claim_engine. |
| `auto_credit` | ya/tidak | Dari claim_engine. |
| `proof_required` | ya/tidak | Dari claim_engine. |
| `claim_frequency` | teks | Dari period_engine. |
| `distribution_day` | teks | Dari period_engine. |

### scope_summary_block — Ringkasan cakupan
| Field | Tipe | Sumber |
|-------|------|--------|
| `game_domain` | teks | Domain utama. |
| `game_domains` | daftar | Semua domain (kalau multi). |
| `eligible_providers` | daftar | Provider yang termasuk. |
| `blacklist_summary` | objek | Ringkasan blacklist agregat. |
| `platform_access` | teks | Dari scope_engine. |
| `apk_required` | ya/tidak | Dari scope_engine. |
| `geo_restriction` | teks | Dari scope_engine. |
| `stacking_policy` | teks | Dari dependency_engine. |

### intent_summary_block — Ringkasan tujuan
| Field | Tipe | Sumber |
|-------|------|--------|
| `intent_category` | teks | `acquisition` / `retention` / `reactivation` / `engagement`. |
| `primary_action` | teks | Dari reasoning_engine. |
| `reward_nature` | teks | Dari reasoning_engine. |
| `distribution_path` | teks | Dari reasoning_engine. |
| `value_shape` | teks | Dari reasoning_engine. |
| `target_segment` | teks | Dari identity_engine. |

---

## 25. risk_engine — Tingkat Risiko

**Untuk apa?** Seberapa berisiko promo ini.

### level_block — Level risiko
| Field | Tipe | Fungsi |
|-------|------|--------|
| `promo_risk_level` | teks | `low` / `medium` / `high` / `critical`. |

Contoh:
- Merchandise = `low`
- Lucky draw mobil = `critical`

---

## 26. meta_engine — Metadata Sistem

**Untuk apa?** Info teknis tentang asal data dan identitas skema.

### source_block — Asal data
| Field | Tipe | Fungsi |
|-------|------|--------|
| `source_url` | teks | URL asal promo. |
| `raw_content` | teks | Teks mentah promo. |
| `extraction_source` | teks | `plain_text` / `html` / `image` / `pdf` / `multimodal`. |
| `source_type` | teks | `text_paste` / `website` / `image_upload` / `pdf_upload`. |

### extraction_block — Catatan proses
| Field | Tipe | Fungsi |
|-------|------|--------|
| `has_rowspan_tables` | ya/tidak | HTML punya tabel rowspan? |
| `html_was_normalized` | ya/tidak | HTML udah dirapikan? |
| `client_id_source` | teks | `explicit` / `inferred` / `propagated`. |
| `propagated_fields` | daftar | Field yang diambil dari data promo lain. |
| `ambiguous_blacklists` | angka | Jumlah pengecualian yang gak jelas. |
| `extracted_at` | waktu | Kapan AI baca promo. |
| `classification_overridden` | ya/tidak | Kategori diubah operator? |
| `classification_override_reason` | teks | Alasan perubahan. |
| `original_llm_category` | teks | Kategori asli AI sebelum diubah. |

### unmodeled_evidence_block — Evidence Belum Punya Rumah (V.10.2 BARU)

**Untuk apa?** Kalau AI nemu data di promo tapi belum ada field di skema, taruh di sini. Sebagai temporary capture.

**Penting:**
- BUKAN sumber kebenaran
- Danila gak baca dari sini
- Form Wizard gak tampilin
- Cuma untuk **audit + temporary capture** sebelum schema promotion

| Field | Tipe | Fungsi |
|-------|------|--------|
| `items` | daftar | Daftar evidence yang belum dimodelkan. Setiap item: `evidence_id`, `captured_at`, `captured_by`, `field_candidate`, `source_text`, `reason_not_modeled`, `suggested_engine`, `suggested_path`, `occurrence_count`, `requires_schema_review`, `review_status`, `promoted_to_field`. |

### Kapan evidence di-promote jadi field resmi?

| Frequency | Action |
|-----------|--------|
| 1-2 records | Stay (anekdot, gak action) |
| 3+ records, 1 brand | Stay (brand-specific) |
| **3+ records, 2+ brand** | **Trigger promotion review** → Habe Raja review → kalau approve, jadi field resmi di versi berikutnya |

### schema_block — Identitas skema (V.10.2 expanded)
| Field | Tipe | Fungsi |
|-------|------|--------|
| `schema_name` | teks | Selalu `"PKB_Wolfbrain"`. |
| `schema_version` | teks | `"V.10.2"`. |
| `base_locked_at` | teks | Tanggal V.10 base dikunci. `"2026-04-28"`. |
| `previous_version` | teks | `"V.10.1"`. |
| `previous_released_at` | teks | `"2026-05-04"`. |
| `released_at` | teks | `"2026-05-15"` untuk V.10.2. |
| `created_by` | teks | Selalu `"habe_raja"`. |
| `owner` | teks | `"Habe Raja — Wolfbrain / Promo Knowledge Base"`. |
| `status` | teks | Status skema. `draft` / `candidate_locked` / `review_pending` / `locked` / `deprecated`. V.10.2 = `"candidate_locked"`. |
| `extractor` | teks | `"wolfclaw@claude-sonnet-4-5"`. |
| `amendment_type` | teks | `patch` / `minor_substantive` / `major_minor_version` / `major_schema_expansion` / `major_breaking`. V.10.2 = `"major_schema_expansion"`. |
| `amendment_reason` | teks | Alasan rilis. |
| `record_type` (V.10.2 BARU) | teks | `promo` (default) / `site_policy` (kebijakan brand, gak ditampilin di promo listing) / `informational` (future use). |

---

# Field Khusus Top-Level

### ai_confidence
| Field | Tipe | Fungsi |
|-------|------|--------|
| `ai_confidence` | objek | Map keyakinan AI per field. Key = JSON path, value = 0-1. |

### _field_status
| Field | Tipe | Fungsi |
|-------|------|--------|
| `_field_status` | objek | Map asal usul data per field. Key = JSON path, value = sumber. |

Nilai yang tersedia:
- `explicit` — disebut langsung di promo
- `inferred` — disimpulkan AI dari konteks
- `derived` — dihitung dari field lain
- `propagated` — diambil dari data promo lain
- `not_stated` — gak disebut di promo
- `not_applicable` — gak relevan untuk promo ini

### Audit log fields
| Field | Tipe | Fungsi |
|-------|------|--------|
| `_propagation_stats` | objek | Stats propagasi field lintas record. |
| `_human_override_log` | daftar | Log override manusia. Wajib diisi setiap write ke `unmodeled_evidence_block`. |
| `_ai_resolver_log` | daftar | Log AI resolver activity. |

---

# Aturan Kebenaran Data V.10.2

> **Catatan:** Tabel ini direvisi total dari V.10.1. Dulu `mechanics_engine` ada di prioritas 1. Sekarang di prioritas 3.

Kalau ada data yang beda antar bagian, urutan ini yang menang:

| Prioritas | Bagian | Layer | Peran |
|-----------|--------|-------|-------|
| **1** | **Typed engines (PRIMARY)** | PRIMARY | **Sumber kebenaran resmi.** Danila baca dari sini. |
| 2 | `readiness_engine`, `meta_engine` | OPERATIONAL | Lifecycle + provenance. |
| 3 | `reasoning_engine`, `mechanics_engine` | AUXILIARY | Catatan kerja. Bentrok sama PRIMARY → PRIMARY menang. |
| 4 | `projection_engine` | DERIVED | Read-only. Computed dari PRIMARY. |
| 5 | Validator | Gate | Boleh tahan publish, gak boleh ubah isi. |
| 6 | Sinyal kata kunci | Weak signal | Cuma petunjuk. **Gak boleh memutuskan**. |

**Aturan tambahan:**
- Typed engines = canonical truth. Danila ditanya "min deposit berapa?" → baca `reward_engine.requirement_block.min_deposit`. Bukan mechanics.
- `mechanics_engine` boleh `items: []` kosong. Gak block commit.
- `reward_engine` flat fields bentrok dengan `mechanics_engine.items[]` → **reward_engine MENANG**.
- `projection_engine` semua field harus bisa ditelusuri ke engine PRIMARY. Extractor nulis = validator BLOCK.

---

# Danila Read Paths

Peta pertanyaan member → tempat baca di JSON.

| Pertanyaan Member | Baca dari Engine |
|-------------------|------------------|
| Promo apa ini? | `identity_engine.promo_block` |
| Brand siapa? | `identity_engine.client_block` |
| Targetnya siapa? | `identity_engine.promo_block.target_user` + `scope_engine.geo_block` |
| Min deposit berapa? | `reward_engine.requirement_block.min_deposit` |
| Min WD untuk klaim? | `claim_engine.claim_gate_block.min_withdraw_for_claim` (atau per-varian) |
| Cara klaim? | `claim_engine.method_block` + `channels_block` + `instruction_block` |
| Bukti apa? | `claim_engine.proof_requirement_block` + `proof_engine.*` |
| Hadiahnya apa? | `reward_engine.*` |
| Komisi referral berapa? | `referral_engine.commission_rule_block.rules[]` |
| Hadiah lucky spin? | `ticket_engine.draw_block.prize_pool` |
| Hadiah loyalty point? | `loyalty_engine.exchange_block.exchange_groups` |
| Hadiah lottery match? | `result_event_engine.prize_block.prizes[]` |
| Hadiah fisik kirim ke mana? | `fulfillment_engine.physical_reward_block` |
| Game apa yang berlaku? | `scope_engine.game_block` |
| Provider yang gak boleh? | `scope_engine.blacklist_block` + `variant.subcategories[i].blacklist` |
| Berlaku sampai kapan? | `period_engine.validity_block` |
| Kapan reward dibagikan? | `period_engine.distribution_block` + `time_window_engine.*` |
| Bisa digabung promo lain? | `dependency_engine` |
| Kondisi pembatalan? | `invalidation_engine` |
| S&K? | `terms_engine.conditions_block.terms_conditions` |
| Status data promo? | `readiness_engine.state_block.state` |
| Versi schema? | `meta_engine.schema_block.schema_version` |
| Multi-varian — default mana? | `variant_engine.summary_block.default_variant_id` |
| Detail varian X? | `variant_engine.items_block.subcategories[]` |

**Danila GAK baca dari:**
- ❌ `mechanics_engine` (catatan kerja — bukan resmi)
- ❌ `reasoning_engine` (audit trail)
- ❌ `meta_engine.unmodeled_evidence_block` (escape hatch)
- ❌ `projection_engine` boleh dipakai buat **display** (kartu, search), tapi sumber resmi tetap di typed engines

---

# Changelog

## V.10.1 → V.10.2 (15 Mei 2026)

**Tipe:** Doctrine alignment — sesuain F2 dengan Skeleton + Governance + F3 V.10.2.

**Yang berubah:**

**A. Authority Layers section (BARU)**
Lock 4-layer hierarchy di awal dokumen. **mechanics_engine pindah** dari PRIMARY (V.10.1) ke AUXILIARY (V.10.2).

**B. Section 23 mechanics_engine** — revisi total
- V.10.1: "sumber kebenaran utama"
- V.10.2: **AUXILIARY** — catatan kerja AI doang

**C. Section 11 reward_engine** — catatan misleading dihapus
- V.10.1 catatan: *"Data asli paling benar ada di mechanics_engine."*
- V.10.2 catatan: *"reward_engine = sumber kebenaran resmi."*

**D. Aturan Kebenaran Data** — revisi total
- Prioritas 1: ~~mechanics~~ → **Typed engines**
- Prioritas 3: AUXILIARY (mechanics + reasoning)
- Prioritas 4: DERIVED (projection)

**E. Danila Read Paths** — section baru
Peta pertanyaan → engine yang dibaca.

**F. 4 engine baru didokumentasi**
- Section 12 — `ticket_engine`
- Section 14 — `referral_engine`
- Section 15 — `result_event_engine`
- Section 16 — `fulfillment_engine`

**G. Block baru di engine existing**
- `taxonomy_engine.tier_threshold_block`
- `period_engine.schedule_variant_block`
- `claim_engine.claim_gate_block`
- `proof_engine.document_proof_block`
- `scope_engine.odds_constraint_block`
- `scope_engine.bet_configuration_block`
- `reward_engine.turnover_tier_by_deposit_block`
- `reward_engine.reward_table_block`
- `reward_engine.unit_reward_block`
- `meta_engine.unmodeled_evidence_block`
- `meta_engine.schema_block.record_type`

**H. Section 17 variant_engine** — expanded
- Tambah `subcategories[i].claim_gate_block` per-varian
- Tambah `subcategories[i].turnover_tier_by_deposit[]`
- Tambah segmentation fields

**I. Field yang hilang**
- `reward_engine.requirement_block.min_withdraw` — pindah ke `claim_engine.claim_gate_block.min_withdraw_for_claim`
- `subcategories[i].min_withdraw` (flat) — pindah ke `subcategories[i].claim_gate_block.min_withdraw_for_claim`

**J. projection_engine.summary_block.min_withdraw** — derivation logic
Urutan: per-varian claim_gate → global claim_gate → null

**Approved by:** Habe Raja (Fux), WOLFGANK
**Date:** 15 Mei 2026
**Status:** candidate_locked

---

*PKB_Wolfbrain | File 2 of 4 | Definisi Field V.10.2 | 15 Mei 2026 | Habe Raja*
