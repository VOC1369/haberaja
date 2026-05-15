# F4 — Form Detail Mapping V.10.2

**Schema:** PKB_Wolfbrain V.10.2
**Document Status:** locked (dokumen ini sudah final)
**Schema Status (`meta_engine.schema_block.status`):** candidate_locked
**Tanggal:** 15 Mei 2026
**Owner:** Habe Raja (Fux), WOLFGANK
**Companion:** F1 (Doctrine + Skeleton) + F2 (Field Definitions) + F3 (Enum Registry) + Governance Rules

---

## Apa Dokumen Ini?

Dokumen ini berisi **mapping antara JSON skema PKB_Wolfbrain V.10.2 dengan Form Wizard UI**.

Anggap aja ini **cetak biru Form Wizard**. Tiap field di JSON → ditampilin di form gimana, pakai komponen UI apa, kapan muncul/hilang, validasi-nya gimana.

> **Audience:** Frontend developer (Lovable, React), QA, designer Form Wizard, operator.

---

## Bedanya dengan dokumen lain?

| Dokumen | Fokus | Audience |
|---------|-------|----------|
| **F1 Doctrine** | Prinsip dasar Wolfbrain | Semua orang |
| **F2 Field Definitions** | Arti tiap field di JSON | Developer + QA |
| **F3 Enum Registry** | Nilai enum yang diizinkan | Developer + extractor AI |
| **Governance Rules** | Aturan operasional + enforcement | Developer + validator |
| **F4 Form Mapping** | JSON ↔ Form UI mapping | Frontend dev + designer |

---

## Hubungan dengan F4 V.10.1

F4 V.10.2 adalah **incremental update** dari F4 V.10.1. **9-step wizard structure tetap berlaku** — F4 V.10.2 cuma menambah:

- **4 engine baru** sebagai conditional sections (muncul kalau promo_type cocok)
- **12 block baru** sebagai extension di step existing
- **1 field global**: `record_type` di Step 1

**Backward compatibility:** Semua field V.10.1 di Form Wizard **tetap berlaku**. V.10.2 cuma additive.

Multi-variant editor (untuk `subcategories[]` dengan 31 field/variant) tetap **deferred** ke V.10.3 sebagai dokumen F5 terpisah.

---

# Bagian 1 — Prinsip Form

Prinsip dari F4 V.10.1 tetap berlaku, plus 4 prinsip baru di V.10.2:

```
1. Form membaca dan menulis ke path JSON V.10.2.
2. Dropdown/radio values WAJIB berasal dari F3 (Enum Registry).
3. Form tidak punya enum sendiri.
4. Form tidak boleh menyimpan label UI sebagai value.
5. Jika mapper label → value gagal, block save dan tampilkan error.
6. Form tidak boleh re-interpret atau override hasil AI reasoning.
7. Field yang diisi AI ditampilkan sebagai pre-filled — admin boleh override hanya via explicit override flow.
8. Field null dari AI → sistem generate pertanyaan ke Admin, bukan diisi otomatis.

V.10.2 BARU:

9. Step dinamis berdasarkan promo_type (conditional steps).
10. Per-variant override (`subcategories[i]`) ditangani Multi-Variant Editor terpisah, BUKAN di 9-step wizard ini.
11. Field `record_type` (promo/site_policy/informational) ditanya DI AWAL Step 1 — sebelum input lainnya.
12. Form WAJIB blokir save kalau ada 2+ reward block enabled (per Governance G5).
```

---

# Bagian 2 — Struktur 9-Step (V.10.1 Baseline)

9-step structure tetap dipertahankan dari F4 V.10.1. Per Master Plan, tiap step punya jumlah field expected:

| Step | Nama | Field Baseline V.10.1 | Field V.10.2 (with extensions) |
|------|------|----------------------|--------------------------------|
| 1 | Identitas Promo | 6 | **7** (+1: record_type) |
| 2 | Batasan & Akses | 8 | **8 + conditional** (odds_constraint, bet_configuration) |
| 3 | Trigger & Validitas | 13 | **13 + conditional** (schedule_variant) |
| 4 | Reward & Perhitungan | 16 | **16 + conditional** (reward_table, matrix, unit, turnover_tier, tier_threshold, ticket, result_event, fulfillment) |
| 5 | Pembayaran | 7 | **7** (no change) |
| 6 | Klaim & Bukti | 13 | **13 + extension** (claim_gate_block, document_proof_block) |
| 7 | Loyalitas | 10 | **10 + conditional** (loyalty_engine.exchange typed, referral_engine) |
| 8 | Ketergantungan & Pembatalan | 9 | **9 + extension** (void_conditions_block typed) |
| 9 | Review & Simpan | 3 | **3** (no change — projection_engine preview) |

**Total field baseline V.10.1:** ~85 field
**Total field V.10.2:** ~85 + 12 block extensions + 4 engine extensions (conditional) = ~150-200 field tergantung promo_type

---

# Bagian 3 — Conditional Steps Strategy

V.10.2 menambah **conditional sub-sections** yang muncul berdasarkan `promo_type` dan `promo_mode`. Strategy: gak semua promo butuh semua engine. Section irrelevant disembunyikan.

## Conditional Trigger Rules

```
IF promo_type IN [lucky_draw, lucky_spin]:
    → Show "Tiket & Undian" subsection di Step 4
    → Render ticket_engine fields

IF promo_type = referral:
    → Show "Referral Commission" subsection di Step 7
    → Render referral_engine fields

IF promo_type = mystery_number:
    → Show "Event Berbasis Hasil" subsection di Step 4
    → Render result_event_engine fields

IF reward_type IN [physical, merchandise] OR variant has physical reward:
    → Show "Pengiriman Hadiah Fisik" subsection di Step 4
    → Render fulfillment_engine fields

IF game_domain IN [sports, sportsbook]:
    → Show "Odds & Bet Configuration" subsection di Step 2
    → Render scope_engine.odds_constraint_block + bet_configuration_block

IF calculation_method = tiered AND tier_archetype = simple:
    → Show "Simple Tier Threshold" subsection di Step 4
    → Render taxonomy_engine.tier_threshold_block

IF calculation_method = matrix_lookup:
    → Show "Matrix Reward" subsection di Step 4
    → Render reward_engine.matrix_reward_block

IF calculation_method = tiered AND complex (multi-row reward table):
    → Show "Reward Table" subsection di Step 4
    → Render reward_engine.reward_table_block

IF reward pattern = per_unit (unit_reward like red_card, goal):
    → Show "Per-Unit Reward" subsection di Step 4
    → Render reward_engine.unit_reward_block

IF promo has weekday/weekend reward variation:
    → Show "Schedule Variant" subsection di Step 3
    → Render period_engine.schedule_variant_block

IF KYC/document required for claim:
    → Show "Document Proof" subsection di Step 6
    → Render proof_engine.document_proof_block

IF loyalty has structured exchange/redemption:
    → Show "Exchange Catalog" subsection di Step 7
    → Render loyalty_engine.exchange_block typed
```

## Always-Show Sections (no condition)

```
Step 6: claim_engine.claim_gate_block — ALWAYS visible (claim gate selalu relevan)
Step 8: invalidation_engine.void_conditions_block — ALWAYS visible (void conditions selalu relevan)
Step 1: meta_engine.schema_block.record_type — ALWAYS visible (di paling atas)
```

---

# Bagian 4 — Step 1 (Identitas) — V.10.2 EXTENDED

**Field tambahan V.10.2: `record_type` (di paling atas).**

| Label Form | Tipe | Path JSON | Value (JSON) | Label UI |
|------------|------|-----------|--------------|----------|
| **⭐ Tipe Record** | dropdown | `meta_engine.schema_block.record_type` | `promo`, `site_policy`, `informational` | Promo, Kebijakan Situs, Informasional |
| Nama Promo | text | `identity_engine.promo_block.promo_name` | (bebas) | (bebas) |
| Tipe Promo | dropdown | `identity_engine.promo_block.promo_type` | enum V.10.2 dari F3 (lihat F3 Section 1.1) | (sesuai F3) |
| Target User | radio/dropdown | `identity_engine.promo_block.target_user` | `new_member`, `existing_member`, `vip`, `all_member` | Member Baru, Member Lama, VIP, Semua Member |
| Mode Promo | radio | `identity_engine.promo_block.promo_mode` | `single`, `multi` | Single, Multi |
| Klasifikasi Program | card selector | `classification_engine.result_block.program_classification` | `A`, `B`, `C` | Reward Program, Event Program, Aturan Sistem |

## Conditional Logic Step 1

```
IF record_type = "site_policy":
    → Hide promo_type dropdown (irrelevant for site policy)
    → Hide klasifikasi A/B/C card (irrelevant)
    → Pass remaining steps with "policy" path (skip reward/claim/trigger steps)
    → Jump to Step 9 (Terms & Review)

IF record_type = "informational":
    → Hide most fields
    → Show only: name, description, terms
    → Jump to Step 9

IF record_type = "promo" (default):
    → Standard 9-step flow per V.10.1
```

---

# Bagian 5 — Step 2 (Batasan & Akses) — V.10.2 EXTENDED

Field V.10.1 baseline tetap. Plus 2 conditional subsections baru untuk sports promos.

## Conditional: Sports Configuration

```
IF game_domain IN ["sports", "sportsbook"]:
    → Show "Odds & Bet Configuration" subsection
```

### odds_constraint_block — Batasan Odds (untuk sports)

| Label Form | Tipe | Path JSON | Value (JSON) | Label UI |
|------------|------|-----------|--------------|----------|
| Aktifkan Batasan Odds | toggle | `scope_engine.odds_constraint_block.enabled` | `true`/`false` | Ya/Tidak |
| Min Odds | number | `scope_engine.odds_constraint_block.min_odds` | number | (input number, contoh: 1.5) |
| Max Odds | number | `scope_engine.odds_constraint_block.max_odds` | number | (input number) |
| Min Odds per Team | number | `scope_engine.odds_constraint_block.min_odds_per_team` | number | (untuk parlay) |
| Berlaku untuk Bet Types | multiselect | `scope_engine.odds_constraint_block.applies_to_bet_types` | array of F3 bet_types enum | (multi-select) |
| Catatan | textarea | `scope_engine.odds_constraint_block.note` | (bebas) | (free text) |

### bet_configuration_block — Konfigurasi Taruhan

| Label Form | Tipe | Path JSON | Value (JSON) | Label UI |
|------------|------|-----------|--------------|----------|
| Aktifkan Bet Config | toggle | `scope_engine.bet_configuration_block.enabled` | `true`/`false` | Ya/Tidak |
| Min Team Count (Parlay) | number | `scope_engine.bet_configuration_block.min_team_count` | number | (untuk parlay) |
| Max Team Count (Parlay) | number | `scope_engine.bet_configuration_block.max_team_count` | number | (untuk parlay) |
| Min Stake | number | `scope_engine.bet_configuration_block.min_stake` | number | (input number) |
| Max Stake | number | `scope_engine.bet_configuration_block.max_stake` | number | (input number) |
| Required Market Segments | multiselect | `scope_engine.bet_configuration_block.required_market_segments` | F3 enum: `sportsbook`, `casino`, `slot`, `live_casino`, `e_lottery`, `togel`, `arcade`, `specific_provider`, `specific_game` | (multi-select) |
| Required Market Segment Count | number | `scope_engine.bet_configuration_block.required_market_segment_count` | number | (input number) |
| Configuration Notes | textarea | `scope_engine.bet_configuration_block.configuration_notes` | (bebas) | (free text) |

---

# Bagian 6 — Step 3 (Trigger & Validitas) — V.10.2 EXTENDED

Field V.10.1 baseline tetap. Plus 1 conditional subsection: `schedule_variant_block`.

## Conditional: Weekday/Weekend Variation

```
IF promo has different reward for weekday vs weekend:
    → Show "Schedule Variant" subsection
```

### schedule_variant_block — Variasi Jadwal

| Label Form | Tipe | Path JSON | Value (JSON) | Label UI |
|------------|------|-----------|--------------|----------|
| Aktifkan Variasi Jadwal | toggle | `period_engine.schedule_variant_block.enabled` | `true`/`false` | Ya/Tidak |
| Tipe Variasi | dropdown | `period_engine.schedule_variant_block.variant_type` | F3 enum: `day_of_week`, `time_of_day`, `date_range`, `weekday_weekend`, `custom` | (sesuai F3 Section 1.4) |
| Variants | table editor | `period_engine.schedule_variant_block.variants[]` | array of variant objects (lihat field per item di bawah) | (table editor) |

#### variants[] — Setiap variant jadwal

| Field | Tipe | Fungsi |
|-------|------|--------|
| `schedule_label` | text | Label variant. Contoh: `"Weekday"`, `"Weekend"`. |
| `applies_to_days` | multiselect | Hari yang berlaku. Contoh: `["monday", "tuesday", "wednesday"]`. |
| `applies_to_dates` | multiselect (date) | Tanggal spesifik. |
| `applies_to_time_range` | time range | Object: `{start, end}` format `"HH:MM"`. |
| `reward_override_amount` | number | Override nominal reward untuk variant ini. |
| `reward_override_percent` | number | Override persen reward untuk variant ini. |
| `reward_override_note` | textarea | Catatan override. |

---

# Bagian 7 — Step 4 (Reward & Perhitungan) — V.10.2 MAJOR EXTENSION

Step 4 paling berubah di V.10.2. **5 conditional reward block + 3 conditional engine baru.**

## Baseline V.10.1 (tetap berlaku)

Field V.10.1 di Step 4 tetap: `reward_type`, `currency`, `max_reward`, `payout_direction`, `calculation_basis`, `calculation_method`, `calculation_value`, `calculation_unit`, `min_deposit`, dst.

## ⚠️ FIELD DIHAPUS V.10.2

```
❌ reward_engine.requirement_block.min_withdraw
   → MOVED to Step 6 (claim_engine.claim_gate_block.min_withdraw_for_claim)
   → Form Wizard V.10.2 TIDAK lagi input field ini di Step 4
```

## Conditional Reward Block Selector

Per Governance G5, hanya **1 reward block utama** yang boleh aktif per promo. Form WAJIB tampilkan **selector** dulu, baru render block yang dipilih.

```
Selector "Pola Reward":
  [ ] Fixed (event_block / combo_reward_block / conditional_reward_block)
  [ ] 1-Dim Ladder (reward_table_block)
  [ ] 2-Dim Matrix (matrix_reward_block)
  [ ] Per-Unit (unit_reward_block)
  [ ] Simple Tier (tier_threshold_block di taxonomy_engine)
  [ ] Turnover Tier by Deposit (turnover_tier_by_deposit_block)

→ Hanya 1 yang dipilih → block lain DISABLED (gak boleh diisi)
→ Validator BLOCK save kalau 2+ block enabled (Governance G5)
```

### tier_threshold_block — Simple Tier (di taxonomy_engine)

⚠️ **Lokasi:** `taxonomy_engine.tier_threshold_block` (BUKAN reward_engine — per Governance G5)

| Label Form | Tipe | Path JSON | Value (JSON) | Label UI |
|------------|------|-----------|--------------|----------|
| Aktifkan Simple Tier | toggle | `taxonomy_engine.tier_threshold_block.enabled` | `true`/`false` | Ya/Tidak |
| Basis | dropdown | `taxonomy_engine.tier_threshold_block.basis` | `loss`, `deposit`, `turnover` | Kekalahan, Deposit, Turnover |
| Unit | dropdown | `taxonomy_engine.tier_threshold_block.unit` | `idr`, `percent`, `count` | Rupiah, Persen, Jumlah |
| Ranges | table editor | `taxonomy_engine.tier_threshold_block.ranges[]` | array of range objects | (table editor — lihat F2 Section 3 untuk field per row) |

### reward_table_block — 1-Dim Ladder

| Label Form | Tipe | Path JSON | Value (JSON) | Label UI |
|------------|------|-----------|--------------|----------|
| Aktifkan Reward Table | toggle | `reward_engine.reward_table_block.enabled` | `true`/`false` | Ya/Tidak |
| Tipe Tabel | dropdown | `reward_engine.reward_table_block.table_type` | F3 enum (turnover_ladder, parlay_team_count_table, streak_ladder, dst) | (sesuai F3 Section 1.11) |
| Basis | dropdown | `reward_engine.reward_table_block.basis` | F3 enum | (sesuai F3) |
| Rows | table editor | `reward_engine.reward_table_block.rows[]` | array of 27-field row objects | (advanced table editor) |

> **Catatan rows[]:** 27 field per row, dikelompokkan 4 grup (Threshold/Trigger, Reward Details, Game-Specific, Note). Lihat F2 Section 11 untuk struktur lengkap.
>
> **UI suggestion:** Table editor dengan tabs per grup. Operator gak perlu lihat 27 column sekaligus — tab "Threshold" → tab "Reward" → tab "Game-Specific" → tab "Note".

### matrix_reward_block — 2-Dim Matrix

| Label Form | Tipe | Path JSON | Value (JSON) | Label UI |
|------------|------|-----------|--------------|----------|
| Aktifkan Matrix Reward | toggle | `reward_engine.matrix_reward_block.enabled` | `true`/`false` | Ya/Tidak |
| Tipe Matrix | dropdown | `reward_engine.matrix_reward_block.matrix_type` | F3 enum (`stake_x_symbol`, `stake_x_multiplier`, dst) | (sesuai F3) |
| Axis X Label | text | `reward_engine.matrix_reward_block.axis_x_label` | (bebas) | (contoh: "stake_amount") |
| Axis Y Label | text | `reward_engine.matrix_reward_block.axis_y_label` | (bebas) | (contoh: "scatter_count") |
| Axis X Values | tags | `reward_engine.matrix_reward_block.axis_x_values` | array of values | (input tags) |
| Axis Y Values | tags | `reward_engine.matrix_reward_block.axis_y_values` | array of values | (input tags) |
| Butuh Visual Sumber? | toggle | `reward_engine.matrix_reward_block.source_visual_required` | `true`/`false` | Ya/Tidak |
| Matrix Cells | matrix editor | `reward_engine.matrix_reward_block.matrix_cells[]` | array of 14-field cell objects | (2-dim grid editor) |

#### matrix_cells[] — Sel matrix

Setiap sel berisi field: `x`, `y`, `condition`, `stake_amount`, `stake_range_min`, `stake_range_max`, `symbol_count`, `multiplier`, `team_count`, `reward_amount`, `reward_percent`, `reward_basis`, `max_reward`, `note`.

> Detail field per cell: lihat F2 Section 11 `matrix_reward_block`.

### unit_reward_block — Per-Unit Reward

| Label Form | Tipe | Path JSON | Value (JSON) | Label UI |
|------------|------|-----------|--------------|----------|
| Aktifkan Per-Unit | toggle | `reward_engine.unit_reward_block.enabled` | `true`/`false` | Ya/Tidak |
| Trigger Unit | dropdown | `reward_engine.unit_reward_block.trigger_unit` | `red_card`, `goal`, `scatter_hit`, dst (F3) | Kartu Merah, Gol, Scatter Hit |
| Value per Unit | number | `reward_engine.unit_reward_block.value_per_unit` | number | (input number) |
| Value Unit | dropdown | `reward_engine.unit_reward_block.value_unit` | `idr`, `percent`, `multiplier` | Rupiah, Persen, Multiplier |
| Akumulatif? | toggle | `reward_engine.unit_reward_block.is_accumulative` | `true`/`false` | Ya/Tidak |
| Max Units per Claim | number | `reward_engine.unit_reward_block.max_units_per_claim` | number | (input number) |
| Max Reward | number | `reward_engine.unit_reward_block.max_reward` | number | (input number) |
| Catatan | textarea | `reward_engine.unit_reward_block.note` | (bebas) | (free text) |

### turnover_tier_by_deposit_block — Turnover per Tier Deposit

| Label Form | Tipe | Path JSON | Value (JSON) | Label UI |
|------------|------|-----------|--------------|----------|
| Aktifkan Tier by Deposit | toggle | `reward_engine.turnover_tier_by_deposit_block.enabled` | `true`/`false` | Ya/Tidak |
| Tiers | table editor | `reward_engine.turnover_tier_by_deposit_block.tiers[]` | array of 7-field tier objects | (lihat F2 Section 11) |

---

# Bagian 8 — Step 4 (Lanjutan) — Conditional ENGINE BARU

## Conditional: Ticket Engine

```
IF promo_type IN [lucky_draw, lucky_spin]:
    → Show "Tiket & Undian" subsection
    → Render ticket_engine
```

### ticket_block — Tiket

| Label Form | Tipe | Path JSON | Value (JSON) | Label UI |
|------------|------|-----------|--------------|----------|
| Aktifkan Ticket | toggle | `ticket_engine.ticket_block.enabled` | `true`/`false` | Ya/Tidak |
| Nama Tiket | text | `ticket_engine.ticket_block.ticket_name` | (bebas) | (contoh: "Lucky Spin Ticket") |
| Sumber Tiket | dropdown | `ticket_engine.ticket_block.ticket_source` | F3 enum (deposit_amount, play_count, turnover_threshold, manual_grant, event_participation, referral_count, loyalty_redemption) | (sesuai F3 Section 1.12) |
| Min Deposit untuk Tiket | number | `ticket_engine.ticket_block.min_deposit_for_ticket` | number | (input number) |
| Deposit per Tiket | number | `ticket_engine.ticket_block.deposit_per_ticket` | number | (1jt = 1 tiket?) |
| Akumulatif? | toggle | `ticket_engine.ticket_block.is_accumulative` | `true`/`false` | Ya/Tidak |
| Max Tiket per Klaim | number | `ticket_engine.ticket_block.max_ticket_per_claim` | number | (input number) |
| Max Tiket per Hari | number | `ticket_engine.ticket_block.max_ticket_per_day` | number | (input number) |
| Durasi Validitas | number | `ticket_engine.ticket_block.validity_duration_value` | number | (input number) |
| Satuan Durasi | dropdown | `ticket_engine.ticket_block.validity_duration_unit` | `hours`, `days` | Jam, Hari |
| Berlaku Sampai Jam | time | `ticket_engine.ticket_block.valid_until_time` | "HH:MM" | (time picker) |
| Expired saat Reset? | toggle | `ticket_engine.ticket_block.expires_on_reset` | `true`/`false` | Ya/Tidak |
| Exclusion Payment Methods | multiselect | `ticket_engine.ticket_block.ticket_payment_method_exclusion` | array of payment_method enum | (multi-select) |

### draw_block — Undian

| Label Form | Tipe | Path JSON | Value (JSON) | Label UI |
|------------|------|-----------|--------------|----------|
| Tipe Undian | dropdown | `ticket_engine.draw_block.draw_type` | F3 enum: `random`, `fixed_winner`, `top_n`, `lottery_match`, `weighted_random`, `participation_based`, `ranking_based` | (sesuai F3 Section 1.12) |
| Frekuensi Undian | dropdown | `ticket_engine.draw_block.draw_frequency` | F3 enum: `once`, `daily`, `weekly`, `monthly`, `quarterly`, `yearly`, `on_event_end`, `on_threshold_reached` | (sesuai F3 Section 1.12) |
| Jam Undian | time | `ticket_engine.draw_block.draw_time` | "HH:MM" | (time picker) |
| Cara Pilih Pemenang | text/textarea | `ticket_engine.draw_block.winner_selection` | free text — deskripsi mekanisme pemilihan pemenang | (free text) |
| Prize Pool | table editor | `ticket_engine.draw_block.prize_pool` | array of prize objects | (table editor) |

> **Catatan `winner_selection`:** Field ini **free text/textarea**, BUKAN dropdown enum. Alasannya: `draw_type` di atas sudah memegang mechanism enum (random, top_n, weighted_random, dst). `winner_selection` jadi deskripsi tambahan supaya tidak duplikatif dengan `draw_type`. Kalau nanti pola berulang muncul di 3+ promo / 2+ brand, baru evaluasi promosi ke enum F3 (per Governance G4).

---

## Conditional: Result Event Engine

```
IF promo_type = "mystery_number":
    → Show "Event Berbasis Hasil" subsection
    → Render result_event_engine
```

### result_match_block — Pencocokan Hasil

| Label Form | Tipe | Path JSON | Value (JSON) | Label UI |
|------------|------|-----------|--------------|----------|
| Aktifkan Result Match | toggle | `result_event_engine.result_match_block.enabled` | `true`/`false` | Ya/Tidak |
| Sumber Hasil | dropdown | `result_event_engine.result_match_block.result_source` | `togel`, `lottery`, `sports_match`, `game_event`, `casino_result`, `slot_event` | Togel, Lottery, Sports Match, Game Event, Casino Result, Slot Event |
| Market Sumber | multiselect | `result_event_engine.result_match_block.result_source_markets` | array of market enum | (multi-select) |
| Target Match | dropdown | `result_event_engine.result_match_block.match_target` | F3 enum | (sesuai F3) |
| Jumlah Digit | number | `result_event_engine.result_match_block.match_digits` | number | (input number) |
| Posisi Digit | dropdown | `result_event_engine.result_match_block.match_position` | `last_4`, `last_3`, `last_2`, `first_4`, `exact`, dst | (sesuai F3) |
| Logika Match | dropdown | `result_event_engine.result_match_block.match_logic` | `exact`, `partial`, `contains`, dst | (sesuai F3) |
| Window Klaim (jam) | number | `result_event_engine.result_match_block.claim_window_after_result_hours` | number | (input number) |

### prize_block.prizes[] — Hadiah Per Tier

| Label Form | Tipe | Path JSON | Value (JSON) | Label UI |
|------------|------|-----------|--------------|----------|
| Prizes | table editor | `result_event_engine.prize_block.prizes[]` | array of 9-field prize objects | (lihat F2 Section 15) |

> Field per prize: prize_id, prize_tier, prize_label, prize_amount, prize_currency, requires_bet_on_match_target, minimum_bet_amount, max_winners_per_period, note.

---

## Conditional: Fulfillment Engine

```
IF reward_type IN [physical, merchandise] OR reward_table has physical_reward_name:
    → Show "Pengiriman Hadiah Fisik" subsection
    → Render fulfillment_engine
```

### physical_reward_block — Reward Fisik

| Label Form | Tipe | Path JSON | Value (JSON) | Label UI |
|------------|------|-----------|--------------|----------|
| Aktifkan Pengiriman Fisik | toggle | `fulfillment_engine.physical_reward_block.enabled` | `true`/`false` | Ya/Tidak |
| Butuh Pengiriman? | toggle | `fulfillment_engine.physical_reward_block.requires_shipping` | `true`/`false` | Ya/Tidak |
| Anchor Periode Kirim | dropdown | `fulfillment_engine.physical_reward_block.shipping_period_anchor` | F3 enum: `prize_announcement`, `claim_approval`, `event_end`, `period_end`, `month_end`, `custom` | (sesuai F3 Section 1.16) |
| Durasi Pengiriman | number | `fulfillment_engine.physical_reward_block.shipping_period_value` | number | (input number) |
| Satuan Durasi | dropdown | `fulfillment_engine.physical_reward_block.shipping_period_unit` | F3 enum (`days`, `weeks`, `months`) | (sesuai F3) |
| Metode Pengiriman | dropdown | `fulfillment_engine.physical_reward_block.shipping_method` | F3 enum (sesuai Section 1.16) | (sesuai F3) |
| Data Penerima Dibutuhkan | multiselect | `fulfillment_engine.physical_reward_block.recipient_data_required` | F3 enum: `full_name`, `address`, `phone`, `email`, `ktp_id`, `bank_account` | (multi-select) |
| Bisa Ganti Stock | toggle | `fulfillment_engine.physical_reward_block.stock_replacement_allowed` | `true`/`false` | Ya/Tidak |
| Pajak Ditanggung | dropdown | `fulfillment_engine.physical_reward_block.tax_borne_by` | F3 enum: `operator`, `member`, `shared` | Operator, Member, Berbagi |
| Ada Biaya? | toggle | `fulfillment_engine.physical_reward_block.fee_required` | `true`/`false` | Ya/Tidak |
| Catatan Biaya | textarea | `fulfillment_engine.physical_reward_block.fee_note` | (bebas) | (free text) |
| Bisa Konversi ke Kredit | tri-state | `fulfillment_engine.physical_reward_block.can_convert_to_credit` | nullable boolean: `null` / `true` / `false` | Tidak Disebutkan / Ya / Tidak |

> **Catatan `can_convert_to_credit`:** Field ini adalah **nullable boolean**, BUKAN enum string. Tiga state:
> - `null` = tidak disebutkan di promo
> - `true` = bisa dikonversi ke kredit
> - `false` = tidak bisa dikonversi
>
> UI render sebagai tri-state dropdown (display "Tidak Disebutkan" / "Ya" / "Tidak"), tapi value JSON tetap boolean atau null — JANGAN simpan string `"yes"`/`"no"`/`"winner_choice"`.

---

# Bagian 9 — Step 6 (Klaim & Bukti) — V.10.2 EXTENSION

Step 6 baseline V.10.1 tetap. Plus 2 extension block:

## claim_gate_block — GLOBAL Claim Gate (ALWAYS SHOW)

> **Penting:** Field `min_withdraw_for_claim` di sini sekarang adalah lokasi resmi (V.10.2). Di V.10.1, field `min_withdraw` ada di reward_engine — itu sudah dihapus.

23 field claim_gate_block, dikelompokkan 6 sub-section:

### Sub-section: Deposit & Withdraw Requirements
| Label Form | Tipe | Path JSON | Value | Label UI |
|------------|------|-----------|-------|----------|
| Wajib Deposit Dulu | toggle | `claim_engine.claim_gate_block.requires_deposit_before_claim` | `true`/`false` | Ya/Tidak |
| Min Deposit Klaim | number | `claim_engine.claim_gate_block.min_deposit_for_claim` | number | (input number) |
| Wajib WD Dulu | toggle | `claim_engine.claim_gate_block.requires_withdraw_before_claim` | `true`/`false` | Ya/Tidak |
| **Min WD Klaim** | number | `claim_engine.claim_gate_block.min_withdraw_for_claim` | number | (input number — PINDAH dari Step 4 V.10.1!) |

### Sub-section: Claim Sequence
| Label Form | Tipe | Path JSON | Value | Label UI |
|------------|------|-----------|-------|----------|
| Klaim Sebelum Main | toggle | `claim_engine.claim_gate_block.requires_claim_before_play` | `true`/`false` | Ya/Tidak |
| Klaim Sebelum Form WD | toggle | `claim_engine.claim_gate_block.requires_claim_before_withdraw_form` | `true`/`false` | Ya/Tidak |
| Klaim Setelah Event Result | toggle | `claim_engine.claim_gate_block.requires_claim_after_event_result` | `true`/`false` | Ya/Tidak |

### Sub-section: Active User Requirement
| Label Form | Tipe | Path JSON | Value | Label UI |
|------------|------|-----------|-------|----------|
| Wajib User Aktif | toggle | `claim_engine.claim_gate_block.requires_active_user_id` | `true`/`false` | Ya/Tidak |
| Periode Aktif (value) | number | `claim_engine.claim_gate_block.active_user_period_value` | number | (input number) |
| Periode Aktif (unit) | dropdown | `claim_engine.claim_gate_block.active_user_period_unit` | `hours`, `days`, `weeks`, `months` | (sesuai F3) |
| Min Turnover Aktif | number | `claim_engine.claim_gate_block.active_user_min_turnover` | number | (input number) |

### Sub-section: History Deposit Requirement
| Label Form | Tipe | Path JSON | Value | Label UI |
|------------|------|-----------|-------|----------|
| Wajib History Deposit | toggle | `claim_engine.claim_gate_block.requires_history_deposit` | `true`/`false` | Ya/Tidak |
| Min History Deposit Amount | number | `claim_engine.claim_gate_block.min_history_deposit_amount` | number | (input number) |
| Periode History Deposit (value) | number | `claim_engine.claim_gate_block.history_deposit_period_value` | number | (input number) |
| Periode History Deposit (unit) | dropdown | `claim_engine.claim_gate_block.history_deposit_period_unit` | F3 enum | (sesuai F3) |

### Sub-section: Claim Deadline
| Label Form | Tipe | Path JSON | Value | Label UI |
|------------|------|-----------|-------|----------|
| Batas Klaim (value) | number | `claim_engine.claim_gate_block.claim_deadline_value` | number | (input number) |
| Batas Klaim (unit) | dropdown | `claim_engine.claim_gate_block.claim_deadline_unit` | `hours`, `days`, `weeks`, `months` | (sesuai F3) |
| Anchor Batas Klaim | dropdown | `claim_engine.claim_gate_block.claim_deadline_anchor` | F3 enum (10 nilai: deposit, withdraw, event_result, level_up, claim, signup, birthday, prize_announcement, match_end, period_end) | (sesuai F3 Section 1.7) |

### Sub-section: Claim Limit & Reset
| Label Form | Tipe | Path JSON | Value | Label UI |
|------------|------|-----------|-------|----------|
| Max Klaim per Periode | number | `claim_engine.claim_gate_block.claim_limit_per_period` | number | (input number) |
| Periode Limit | dropdown | `claim_engine.claim_gate_block.claim_limit_period` | F3 enum (7 nilai: daily, weekly, monthly, yearly, per_event, per_match, lifetime) | (sesuai F3) |
| Scope Limit | dropdown | `claim_engine.claim_gate_block.claim_limit_scope` | F3 enum (7 nilai: per_user, per_event, per_match, per_promo, per_account, lifetime_per_user, account_wide) | (sesuai F3) |
| Reset Frequency | dropdown | `claim_engine.claim_gate_block.claim_reset_frequency` | `daily`, `weekly`, `monthly`, `never`, `on_trigger` | (sesuai F3) |
| Jam Reset | time | `claim_engine.claim_gate_block.claim_reset_time` | "HH:MM" | (time picker) |

---

## Conditional: Document Proof Block

```
IF KYC required OR identity verification needed:
    → Show "Document Proof" subsection
```

### document_proof_block — Bukti Dokumen

| Label Form | Tipe | Path JSON | Value | Label UI |
|------------|------|-----------|-------|----------|
| Dokumen Dibutuhkan | multiselect | `proof_engine.document_proof_block.documents_required` | array (`ktp`, `selfie_with_ktp`, dst) | (multi-select) |
| Match Identitas Wajib | toggle | `proof_engine.document_proof_block.identity_match_required` | `true`/`false` | Ya/Tidak |
| Match Nama Rekening Wajib | toggle | `proof_engine.document_proof_block.account_name_match_required` | `true`/`false` | Ya/Tidak |

---

# Bagian 10 — Step 7 (Loyalitas) — V.10.2 EXTENSION

Step 7 baseline V.10.1 tetap. Plus 2 extension:

## Conditional: Loyalty Exchange (Typed)

```
IF loyalty_engine.exchange_block has structured exchange:
    → Render exchange_groups[] sebagai table editor
```

Field tetap di V.10.2 — `loyalty_engine.exchange_block.exchange_groups[]` jadi structured array (lihat F2 Section 13).

## Conditional: Referral Engine

```
IF promo_type = "referral":
    → Show "Referral Commission" subsection
    → Render referral_engine fields
```

### program_block — Program Referral

| Label Form | Tipe | Path JSON | Value | Label UI |
|------------|------|-----------|-------|----------|
| Aktifkan Referral | toggle | `referral_engine.program_block.enabled` | `true`/`false` | Ya/Tidak |
| Tipe Referral | dropdown | `referral_engine.program_block.referral_type` | F3 enum: `single_tier`, `multi_tier`, `lifetime`, `one_time`, `recurring`, `downline_loss_based`, `downline_bet_based`, `downline_winlose_based` | (sesuai F3 Section 1.14) |
| Basis Komisi | dropdown | `referral_engine.program_block.commission_basis` | F3 enum: `downline_bet`, `downline_loss`, `downline_winlose`, `downline_turnover`, `first_deposit`, `net_winlose`, `referral_signup` | (sesuai F3 Section 1.14) |
| Rate Komisi | number | `referral_engine.program_block.commission_rate` | number | (input number) |
| Unit Komisi | dropdown | `referral_engine.program_block.commission_unit` | `percent`, `fixed_idr` | Persen, Rupiah |
| Game Types Eligible | multiselect | `referral_engine.program_block.eligible_game_types` | array of game_type enum | (multi-select) |
| Markets Eligible (Togel) | multiselect | `referral_engine.program_block.eligible_markets` | array of market enum | (multi-select) |
| Min Downline Count | number | `referral_engine.program_block.min_downline_count` | number | (input number) |
| Min Downline Turnover | number | `referral_engine.program_block.min_downline_turnover` | number | (input number) |
| Periode Downline (value) | number | `referral_engine.program_block.downline_period_value` | number | (input number) |
| Periode Downline (unit) | dropdown | `referral_engine.program_block.downline_period_unit` | `days`, `weeks`, `months` | (sesuai F3) |
| Wajib Downline Aktif | toggle | `referral_engine.program_block.requires_downline_active` | `true`/`false` | Ya/Tidak |
| Wajib Referrer KYC | toggle | `referral_engine.program_block.requires_referrer_kyc` | `true`/`false` | Ya/Tidak |
| Wajib Disclosure Sosmed | toggle | `referral_engine.program_block.requires_media_disclosure` | `true`/`false` | Ya/Tidak |
| Lifetime? | toggle | `referral_engine.program_block.is_lifetime` | `true`/`false` | Ya/Tidak |

### commission_rule_block.rules[] — Aturan Komisi Per Game/Market

| Label Form | Tipe | Path JSON | Value | Label UI |
|------------|------|-----------|-------|----------|
| Rules | table editor | `referral_engine.commission_rule_block.rules[]` | array of 10-field rule objects | (lihat F2 Section 14) |

### deduction_block, simulation_block, distribution_block, link_block

Field-field ini di-render sebagai sub-form di bawah referral section. Lihat F2 Section 14 untuk detail field.

---

# Bagian 11 — Step 8 (Ketergantungan & Pembatalan) — V.10.2 EXTENSION

Baseline V.10.1 tetap untuk dependency_block. Yang berubah: **void_conditions_block** structure.

## void_conditions_block — TYPED ARRAY (V.10.2)

> **PERUBAHAN V.10.2:** `void_conditions_block` sekarang adalah **array langsung** (bukan object dengan `void_conditions[]` di dalamnya). Form Wizard harus render sebagai table editor.

### Setiap item void_conditions

| Label Form | Tipe | Path JSON | Value | Label UI |
|------------|------|-----------|-------|----------|
| ID Kondisi | text | `invalidation_engine.void_conditions_block[i].condition_id` | format `vc_001` | (auto-generate atau input) |
| Tipe Kondisi | dropdown | `invalidation_engine.void_conditions_block[i].condition_type` | `fraud`, `violation`, `operational`, `technical`, `eligibility`, `timing`, `behavior` | (sesuai F3) |
| Scope | dropdown | `invalidation_engine.void_conditions_block[i].scope` | `bonus_only`, `winnings_only`, `full_balance`, `per_promo`, `account_wide`, `deposit_amount` | (sesuai F3) |
| Deskripsi | textarea | `invalidation_engine.void_conditions_block[i].description` | (bebas) | (free text) |
| Batalkan Bonus | toggle | `invalidation_engine.void_conditions_block[i].voids_bonus` | `true`/`false` | Ya/Tidak |
| Batalkan Kemenangan | toggle | `invalidation_engine.void_conditions_block[i].voids_winnings` | `true`/`false` | Ya/Tidak |
| Batalkan Full Saldo | toggle | `invalidation_engine.void_conditions_block[i].voids_full_balance` | `true`/`false` | Ya/Tidak |
| Evidence | textarea | `invalidation_engine.void_conditions_block[i].evidence` | (bebas) | (free text — kutipan promo) |

Field penalty_block (V.10.1 baseline) tetap berlaku tanpa perubahan.

---

# Bagian 12 — Validasi Form V.10.2

V.10.1 baseline aturan validasi tetap berlaku. V.10.2 menambah:

## V.10.2 NEW Validation Rules

```
1. record_type WAJIB diisi di Step 1 (sebelum semua input lain).

2. min_withdraw_for_claim TIDAK BOLEH ditulis ke reward_engine.requirement_block.min_withdraw
   → Validator BLOCK save kalau field forbidden ini terdeteksi.
   → Field hanya boleh ada di:
     - claim_engine.claim_gate_block.min_withdraw_for_claim (global)
     - variant_engine.items_block.subcategories[i].claim_gate_block.min_withdraw_for_claim (per-variant)
     - projection_engine.summary_block.min_withdraw (DERIVED only — form gak boleh tulis)

3. projection_engine semua field READ-ONLY.
   → Validator BLOCK save kalau form mencoba tulis ke projection_engine.

4. Hanya 1 reward block utama yang boleh enabled (Governance G5).
   → Validator scan: count(reward_block.enabled = true) MUST be ≤ 1.
   → Reward blocks dengan flag enabled: tier_threshold_block, reward_table_block, matrix_reward_block, unit_reward_block, turnover_tier_by_deposit_block.
   → Blocks tanpa enabled flag (event_block, combo_reward_block, conditional_reward_block) dianggap aktif kalau isi non-empty.
   → BLOCK save kalau 2+ enabled atau aktif bersamaan.

5. void_conditions_block adalah array LANGSUNG.
   → Form WAJIB render sebagai table editor dengan add/remove row.
   → JANGAN render sebagai object dengan property void_conditions[].

6. ticket_engine, referral_engine, result_event_engine, fulfillment_engine
   → Conditional rendering — section hanya muncul kalau trigger condition terpenuhi.
   → Kalau section gak muncul, field di JSON tetap di state default (empty/null), TIDAK auto-fill.

7. mechanics_engine TIDAK ditampilkan di Form Wizard (Governance G9 — AUXILIARY).
   → Jika lo butuh debug, akses via JSON inspector terpisah, bukan form input.

8. unmodeled_evidence_block TIDAK ditampilkan di Form Wizard (audit only).
   → Akses via Admin Verify atau JSON inspector.

9. Form Wizard anti-regex doctrine (Governance G11).
   → Form INPUT pakai dropdown/radio dari F3 (vocabulary-based).
   → JANGAN bikin form auto-extract dari free text dengan regex.
   → Form cuma display + edit, bukan parser.
```

---

# Bagian 13 — Tabel Migration: V.10.1 Form → V.10.2 Form

Untuk Lovable developer — perubahan yang harus di-implement:

| Perubahan | V.10.1 Form | V.10.2 Form | Action |
|-----------|-------------|-------------|--------|
| **Field record_type baru** | (tidak ada) | Step 1, top of form | ADD |
| **min_withdraw** | Step 4 (reward) | Step 6 (claim_gate) | MOVE |
| **claim_gate_block (23 field)** | (tidak ada) | Step 6, 6 sub-section | ADD |
| **document_proof_block** | (tidak ada) | Step 6, conditional | ADD |
| **tier_threshold_block (taxonomy)** | (tidak ada) | Step 4, conditional | ADD |
| **reward_table_block (27 field rows)** | (tidak ada) | Step 4, conditional | ADD with tab table editor |
| **matrix_reward_block (typed)** | basic | Step 4, conditional | EXTEND |
| **unit_reward_block** | (tidak ada) | Step 4, conditional | ADD |
| **turnover_tier_by_deposit_block** | (tidak ada) | Step 4, conditional | ADD |
| **odds_constraint_block** | (tidak ada) | Step 2, conditional (sports) | ADD |
| **bet_configuration_block** | (tidak ada) | Step 2, conditional (sports) | ADD |
| **schedule_variant_block** | (tidak ada) | Step 3, conditional | ADD |
| **ticket_engine** (full) | (tidak ada) | Step 4, conditional (lucky_spin/draw) | ADD |
| **referral_engine** (full) | basic | Step 7, conditional (referral) | EXTEND |
| **result_event_engine** (full) | (tidak ada) | Step 4, conditional (mystery_number) | ADD |
| **fulfillment_engine** (full) | (tidak ada) | Step 4, conditional (physical reward) | ADD |
| **void_conditions_block** | builder object | Step 8, array editor | RESTRUCTURE |
| **loyalty_engine.exchange (typed)** | builder | Step 7, table editor | EXTEND |
| **_extensions per engine** | (form gak tampilin) | DELETED | NO ACTION (sudah gak ada) |

---

# Bagian 14 — Field yang TIDAK Perlu UI Input (Update V.10.2)

Update dari Master Plan V.10.1 Section 4 (12 field). V.10.2 menambah:

| # | Field | Reason |
|---|-------|--------|
| 1-12 | (V.10.1 list — tetap berlaku) | (lihat Master Plan) |
| 13 | `meta_engine.unmodeled_evidence_block.items[]` | AUDIT only — admin verify saja |
| 14 | `meta_engine.schema_block.previous_version` | Auto-set system |
| 15 | `meta_engine.schema_block.previous_released_at` | Auto-set system |
| 16 | `meta_engine.schema_block.status` | Auto-managed lifecycle |
| 17 | `meta_engine.schema_block.amendment_type` | Auto-set on version bump |
| 18 | `projection_engine.summary_block.min_withdraw` | DERIVED only |

---

# CHANGELOG

## V.10.1 → V.10.2 (15 Mei 2026)

**Type:** `major_schema_expansion` — additive Form Wizard extension untuk 4 engine baru + 12 block baru + 1 field global.
**Status:** Document locked / Schema candidate_locked
**Backward compatibility:** Strictly additive — semua Step 1-9 V.10.1 tetap berlaku.

**Trigger:** PKB_Wolfbrain schema V.10.2 expansion butuh UI representation untuk:
- 4 engine baru (ticket, referral, result_event, fulfillment)
- 12 block baru (claim_gate, reward_table, matrix, unit, turnover_tier, tier_threshold, odds_constraint, bet_configuration, schedule_variant, document_proof, exchange typed, void_conditions typed)
- 1 field global (record_type)

**Yang berubah:**

### A. Field DIHAPUS dari Form
- `reward_engine.requirement_block.min_withdraw` (Step 4) — PINDAH ke Step 6 (claim_gate_block)

### B. Field BARU di Form
- `meta_engine.schema_block.record_type` (Step 1, top) — DROPDOWN

### C. 4 Conditional Engine Section BARU
- ticket_engine (Step 4 conditional)
- referral_engine extended (Step 7 conditional)
- result_event_engine (Step 4 conditional)
- fulfillment_engine (Step 4 conditional)

### D. 12 Conditional/Always Block Extensions
- claim_gate_block, document_proof_block (Step 6)
- reward_table_block, matrix_reward_block, unit_reward_block, turnover_tier_by_deposit_block, tier_threshold_block (Step 4)
- odds_constraint_block, bet_configuration_block (Step 2)
- schedule_variant_block (Step 3)
- exchange_block typed (Step 7)
- void_conditions_block typed (Step 8)

### E. Validation Rules BARU (per Governance V.10.2)
- record_type WAJIB di Step 1
- min_withdraw forbidden path validation
- projection_engine READ-ONLY enforcement
- 1 reward block per promo (G5 anti-overlap)
- void_conditions array structure enforcement
- mechanics_engine + unmodeled_evidence_block excluded from form

### F. Multi-Variant Editor — DEFERRED
Per F1 Aturan 1 + Master Plan Phase 4 — multi-variant editor (`subcategories[]` dengan 31 field per variant + per-variant claim_gate_block override) **TIDAK** di-spec di F4 V.10.2. Akan jadi dokumen terpisah `F5_Multi_Variant_Editor.md` di V.10.3.

**Approved by:** Habe Raja (Fux), WOLFGANK
**Date:** 15 Mei 2026
**Status:** Document locked / Schema candidate_locked

---

*PKB_Wolfbrain | F4 of 5 | Form Detail Mapping V.10.2 | Base lock 29 April 2026 (V.10) → 4 Mei 2026 (V.10.1) → 15 Mei 2026 (V.10.2) | Habe Raja*
