# F1 — Doctrine + Skeleton V.10.2

**Schema:** PKB_Wolfbrain V.10.2
**Status:** candidate_locked
**Tanggal:** 15 Mei 2026
**Owner:** Habe Raja (Fux), WOLFGANK
**Companion:** F2 (Field Definitions) + F3 (Enum Registry) + Governance Rules

---

## Apa Dokumen Ini?

Dokumen ini berisi **prinsip dasar Wolfbrain** + skeleton JSON V.10.2.

Anggep aja ini **konstitusi** Wolfbrain. Aturan dasar yang gak boleh dilanggar — siapapun yang kerja di sistem ini wajib paham isinya.

> **Audience:** Semua orang yang kerja sama Wolfbrain — coder, designer, operator, AI session (Lovable, Cursor, dll).

---

# Bagian 1 — Prinsip Dasar

---

## 1. Prinsip Utama

> **AI bukan mesin tebak-tebakan. AI baca promo, mikir, terus isi data. Sistem jagain biar data tetap benar. Kalau ada yang gak jelas, manusia yang putusin.**

Wolfbrain dijalanin oleh AI yang **bisa mikir dan paham konteks** — bukan mesin yang cuma cocokin kata kunci.

AI tugasnya bikin **data awal yang paling bagus**. Sistem jagain biar data gak rusak. Kalau AI gak bisa jawab, **manusia turun tangan**.

---

## 2. Cara Kerja yang Benar

```
Promo masuk (teks / gambar / PDF)
  ↓
AI baca + isi data semaksimal mungkin
  ↓
AI yakin → langsung isi
AI gak yakin / data gak ada → tandain field tersebut
  ↓
Sistem bikin pertanyaan HANYA untuk field yang ditandain
  ↓
Admin / operator jawab pertanyaan
  ↓
Data final siap disimpan
```

**Penting:** AI gak boleh langsung nanya ke admin untuk semua hal. AI harus **mikir dulu**. Baru kalau bener-bener gak ada infonya, admin dilibatkan.

> **Kosong (null) bukan berarti salah.** Beberapa field memang boleh kosong — misal promo tanpa batas maksimal bonus, atau promo tanpa tanggal akhir. Field ditandain cuma kalau infonya **dibutuhkan tapi gak ada** di promo.

---

## 3. Cara Kerja yang SALAH

```
Data udah dihasilkan AI
  → sistem mikir ulang
  → sistem ubah kategori
  → form ubah hasil
  → data berubah tanpa alasan
```

**Ini yang ngerusak sistem.** Setelah AI menghasilkan data, **gak ada yang boleh ubah isinya** kecuali admin secara resmi.

---

## 4. Aturan Sistem (Display vs Mengubah)

Setelah AI menghasilkan data promo:

- Tampilan layar **menampilkan** data apa adanya
- Tombol salin **menyalin** data yang sama
- Tombol simpan **menyimpan** data sebagai draft (belum final)
- Sistem boleh **kasih peringatan** untuk hal yang perlu dicek
- Sistem boleh **tahan publikasi** kalau ada data yang bertentangan
- Sistem **GAK BOLEH ubah isi** data yang udah dihasilkan AI

**Bedanya:**

- ❌ **Mengubah isi** = dilarang keras
- ✅ **Menahan publikasi** = boleh, itu kontrol kualitas yang benar

> **AI harus menghasilkan data yang baik. Sistem cuma menjaga, bukan menggantikan pemikiran AI.**

---

## 5. Siapa yang Paling Benar? (Urutan Otoritas)

**Untuk komunikasi sehari-hari dengan tim:**

> AI baca + isi data.
> Sistem jaga kualitas.
> Manusia menyelesaikan ketidakpastian.
> Skema berkembang kalau realita promo melampaui kemampuan skema saat ini.

**Untuk tim teknis (urutan prioritas kalau ada konflik):**

| Prioritas | Bagian | Peran |
|-----------|--------|-------|
| 1 | **Typed engines** (reward, claim, scope, dll) | Sumber kebenaran resmi |
| 2 | `readiness_engine`, `meta_engine` | Lifecycle + metadata |
| 3 | `reasoning_engine`, `mechanics_engine` | Catatan kerja (audit) |
| 4 | `projection_engine` | Hasil hitungan otomatis (read-only) |
| 5 | Validator | Penjaga integritas (gak boleh ubah isi) |
| 6 | Sinyal kata kunci | Petunjuk lemah (gak boleh memutuskan) |

**Soal sinyal kata kunci (urutan 6):**

- ❌ GAK BOLEH dipakai untuk memutuskan kategori promo
- ❌ GAK BOLEH dipakai untuk extract field values (no regex, no keyword matcher)
- ✅ BOLEH dipakai untuk: pencarian, deteksi anomali, menurunkan tingkat keyakinan

> **Perubahan V.10.2:** `mechanics_engine` di V.10.1 ada di prioritas 1 (truth utama). Di V.10.2, **pindah ke prioritas 3 (AUXILIARY)**. Alasannya di Bagian 5 (Aturan Pakai) — Aturan 5.

---

## 6. Kalau Promo Gagal Dibaca AI

Urutan yang wajib diikuti:

1. **Cek dulu — apakah AI salah baca promo?**
2. **Kalau AI benar tapi skema gak punya tempat untuk data itu** → masukin ke `meta_engine.unmodeled_evidence_block` sebagai audit. **Jangan paksa masuk ke field yang ada.**
3. **Kalau pattern muncul di 3+ promo / 2+ brand** → trigger promotion review → perluas skema (versi baru).
4. **JANGAN tambal dengan aturan khusus per promo.**

> **Masalah jutaan promo gak diselesaikan dengan tambalan satu per satu, tapi dengan AI yang kuat dan skema yang bisa berkembang.**

**V.10.2 update:** Tempat darurat untuk data yang belum punya rumah = `meta_engine.unmodeled_evidence_block` (centralized). BUKAN `_extensions` per engine (udah dihapus di V.10.2).

---

## 7. Filter Diskusi

Kalau diskusi gak bikin sistem lebih baik dalam hal:

- Akurasi pembacaan promo
- Kecepatan proses
- Kemudahan perawatan
- Kemampuan menangani skala besar

→ Itu **buang waktu**. Skip.

Termasuk skip: debat panjang soal nama, debat soal struktur yang gak berdampak ke hasil.

---

## 8. Aturan Penamaan

- Pakai **hanya nama yang ada di JSON aktual**.
- Nama lama kayak `_mechanics_v31` = **GAK BOLEH dipakai lagi**.
- Yang resmi: `mechanics_engine.items_block.items`.

Setiap nama baru harus ngacu ke field yang **bener-bener ada di output JSON**, bukan istilah lama atau karangan.

**V.10.2 tambahan:**
- Engine baru: `ticket_engine`, `referral_engine`, `result_event_engine`, `fulfillment_engine`
- Block baru: `claim_gate_block`, `reward_table_block`, `matrix_reward_block`, `unit_reward_block`, `tier_threshold_block`, `odds_constraint_block`, `bet_configuration_block`, `schedule_variant_block`, `document_proof_block`, `unmodeled_evidence_block`, `turnover_tier_by_deposit_block`

Semua nama udah ada di skeleton. Gunakan persis seperti tertulis.

---

## 8.1 Dilarang Hardcode

**DILARANG KERAS** masukin nilai default langsung ke output AI.

Nilai default boleh ada di dokumen sebagai **panduan** (contoh: mata uang biasanya IDR untuk promo Indonesia), tapi **GAK BOLEH langsung diisi otomatis** oleh sistem.

**AI yang memutuskan berdasarkan isi promo:**

- Promo Indonesia → AI isi mata uang: `IDR`
- Promo Thailand → AI isi mata uang: `THB`
- Promo gak jelas → AI isi kosong + tandai sebagai gak jelas

**Bedanya:**

- ❌ **Diisi otomatis sistem** = salah, menggantikan pemikiran AI
- ✅ **Dicatat sebagai panduan** = boleh, sebagai referensi AI

Berlaku untuk semua field: mata uang, bahasa, zona waktu, wilayah, target member, dll.

---

## 8.2 Dilarang Regex / Keyword Matcher (BARU di V.10.2)

**Status:** LOCKED 15 Mei 2026. Setara dengan Aturan 8 (No Fabrication) dan 8.1 (No Hardcode).

### Prinsip

> **Extractor baca promo dengan SEMANTIC UNDERSTANDING, bukan pattern matching.**

### DILARANG KERAS:

- ❌ **No regex** untuk extraction logic
- ❌ **No keyword matcher** untuk klasifikasi
- ❌ **No hardcoded promo-type branching**
- ❌ **No post-processing override** (ubah output AI setelah extraction)
- ❌ **No default angka palsu** (field gak boleh diisi 0 atau angka default kalau gak disebut di promo)
- ❌ **No kalkulasi kecuali eksplisit** (field cuma boleh diisi kalkulasi kalau promo memang ngasih kalkulasi/result eksplisit)
- ❌ **No prompt-engineering hack** untuk paksa output tertentu

### WAJIB:

- ✅ **Reasoning-first** — paham semantic dari source, bukan match pattern
- ✅ **Evidence-based** — setiap field harus punya evidence dari source (kutipan verbatim)
- ✅ **Context-aware** — paham context bukan pattern
- ✅ **Null > guessing** — kalau evidence ambigu atau gak ada, isi `null` + log di `readiness_engine.observability_block.ambiguity_flags[]`

### Contoh konkret

❌ **SALAH (regex/keyword-based):**

```
Source: "Minimal WD 200.000 baru bisa claim"

Extractor logic:
  if text.match(/minimal\s+WD\s+\d+/i):
    output.claim_gate_block.min_withdraw_for_claim = parseNumber(matched)
```

✅ **BENAR (reasoning-based):**

```
Source: "Minimal WD 200.000 baru bisa claim"

Extractor reasoning:
  Saya paham semantic kalimat ini:
  - "Minimal WD 200.000" = threshold withdraw 200.000
  - "baru bisa claim" = ini SYARAT untuk klaim event
  - Konteks: claim gate, bukan reward requirement umum
  → Output: claim_gate_block.min_withdraw_for_claim = 200000
  → Evidence: "Minimal WD 200.000 baru bisa claim" (verbatim)
```

### Cerita lesson learned (D5.1)

Di Phase D5.1 sebelumnya, extractor pakai prompt rule untuk paksa `min_withdraw` di-extract via keyword. Tapi field tetap drop di output.

**Root cause:** schema gak define field-nya — bukan masalah prompt.

**Lesson:** **jangan bandaid dengan prompt engineering atau regex.** Fix root cause di schema/doctrine.

Anti-pattern ini formal di Governance G11.

---

## 9. Untuk AI yang Kerja di Project Ini

- Baca aturan ini di awal **setiap sesi**.
- Perlakukan AI di pipeline (Wolfclaw) sebagai **pemikir yang menghasilkan data awal** — bukan mesin yang outputnya perlu diperiksa dengan aturan kata kunci.
- Kalau ada usulan yang melanggar aturan ini — **jangan langsung setuju, tandai dulu**.
- Kalau menemukan sistem yang ubah keputusan AI — **berhenti dan laporkan**, jangan tambal.
- Kalau promo gagal dibaca — cari tahu kenapa dulu, baru perbaiki skema, **jangan tambal dengan kata kunci**.
- Kalau ragu apakah solusi melanggar aturan — **tanya dulu**, jangan asumsi.

**V.10.2 addition (per Governance G1):** AI tools (Lovable, Claude session, Cursor, agent apapun) **DILARANG patch schema** tanpa:
1. Approval eksplisit Habe Raja
2. F2 doctrine update FIRST
3. Schema_version bump
4. Coverage justification minimal 3 promo sample

---

## 10. Aturan Perubahan Dokumen Ini

**Dikunci oleh:** Habe Raja (Fux)
- 28 April 2026 (V.10 base)
- 4 Mei 2026 (V.10.1)
- 15 Mei 2026 (V.10.2)

**Boleh diubah kalau:**
- Ada bukti nyata bahwa aturan saat ini gak cukup
- Perubahan disetujui langsung oleh Habe Raja
- Ada kasus konkret yang jadi dasar perubahan

**Gak boleh diubah kalau:**
- Cuma usulan AI tanpa persetujuan Fux
- Gak ada bukti, cuma pendapat
- Bertentangan dengan prinsip utama (AI bukan mesin tebak-tebakan)

---

## 11. Tanda Tangan & Lock

**Habe Raja (Fux)** — Chief Creative Director WOLFGANK & AI Systems Architect

- 28 April 2026 — V.10
- 4 Mei 2026 — V.10.1
- 15 Mei 2026 — V.10.2 (candidate_locked)

> Dokumen ini menggantikan semua asumsi sebelumnya tentang cara kerja Wolfbrain. Kalau ada pertentangan antara dokumen ini dengan kode atau kebiasaan lama — **dokumen ini yang menang**.

---

## 12. Flow Final Wolfbrain

```
1. Input promo (teks / gambar / PDF)

2. AI Extractor baca promo
   AI reasoning isi JSON PKB_Wolfbrain V.10.2 sesuai enum V.10.2
   NO regex, NO keyword matcher, NO hardcode (per Aturan 8.2)

3. Gap Detection
   AI yakin → isi field
   AI gak yakin / data gak ada → tandai field
   Pattern belum punya rumah → ke meta_engine.unmodeled_evidence_block

4. Human / Admin Review di Extractor
   Admin jawab gap / ambiguity
   JSON jadi final sesuai kebutuhan promo

5. JSON Final
   Satu objek resmi
   Gak ada re-interpret
   Gak ada keyword override
   Gak ada mapper lama yang mikir ulang

6. Form Wizard baca JSON yang sama
   Form terisi sempurna sesuai JSON final
   Form cuma display / edit resmi / review
   Form gak ubah makna sendiri

7. Save / Publish
   Data yang sama disimpan ke Supabase

8. Danila Runtime
   Danila baca data dari Supabase
   Jawaban livechat dari JSON yang sama
   Danila GAK baca mechanics_engine (auxiliary) atau unmodeled_evidence_block (audit only)
```

**Prinsip lock:**

```
AI reasoning fills JSON.
Admin resolves gaps.
Form follows JSON.
Supabase stores JSON.
Danila answers from JSON.
```

Satu kontrak dari hulu ke hilir.

---

# Bagian 2 — Skeleton JSON V.10.2

---

## Aturan Skeleton

Ini adalah **bentuk kosong standar** untuk data promo Wolfbrain V.10.2.

- Semua field dibiarkan kosong (`""`) atau `null` — AI yang ngisi berdasarkan isi promo
- **DILARANG KERAS** ngisi nilai otomatis di luar pemikiran AI
- `state: "draft"` adalah status awal data, bukan nilai yang dipaksa
- `status: "candidate_locked"` di `meta_engine.schema_block` adalah status SCHEMA (bukan record state)

---

## JSON Skeleton V.10.2

```json
{
  "domain": "promo_knowledge",
  "record_id": "",
  "created_at": "",
  "updated_at": "",

  "identity_engine": {
    "client_block": {
      "client_id": "",
      "client_id_field_status": "",
      "client_id_confidence": "",
      "client_name": ""
    },
    "promo_block": {
      "promo_name": "",
      "promo_type": "",
      "target_user": "",
      "promo_mode": ""
    }
  },

  "classification_engine": {
    "result_block": {
      "program_classification": "",
      "secondary_classifications": [],
      "review_confidence": ""
    },
    "question_block": {
      "q1": { "answer": "", "reasoning": "", "evidence": "" },
      "q2": { "answer": "", "reasoning": "", "evidence": "" },
      "q3": { "answer": "", "reasoning": "", "evidence": "" },
      "q4": { "answer": "", "reasoning": "", "evidence": "" }
    },
    "meta_block": {
      "quality_flags": [],
      "evidence_count": null,
      "override": false,
      "override_detail": null,
      "prompt_version": "",
      "latency_ms": null
    }
  },

  "taxonomy_engine": {
    "mode_block": {
      "mode": "",
      "tier_archetype": null
    },
    "logic_block": {
      "conversion_formula": "",
      "turnover_basis": null
    },
    "tier_threshold_block": {
      "enabled": false,
      "basis": "",
      "unit": "",
      "ranges": [
        {
          "range_id": "",
          "label": "",
          "threshold_min": null,
          "threshold_max": null,
          "threshold_max_unlimited": false,
          "reward_percent": null,
          "reward_amount": null,
          "reward_unit": "",
          "note": ""
        }
      ]
    }
  },

  "period_engine": {
    "validity_block": {
      "valid_from": null,
      "valid_until": null,
      "valid_until_unlimited": false,
      "validity_mode": "",
      "validity_duration_value": null,
      "validity_duration_unit": ""
    },
    "distribution_block": {
      "claim_frequency": "",
      "calculation_period": "",
      "distribution_day": ""
    },
    "schedule_variant_block": {
      "enabled": false,
      "variant_type": "",
      "variants": [
        {
          "schedule_label": "",
          "applies_to_days": [],
          "applies_to_dates": [],
          "applies_to_time_range": {
            "start": "",
            "end": ""
          },
          "reward_override_amount": null,
          "reward_override_percent": null,
          "reward_override_note": ""
        }
      ]
    }
  },

  "time_window_engine": {
    "timezone_block": {
      "timezone": "",
      "offset": ""
    },
    "claim_window_block": {
      "enabled": false,
      "start_time": "",
      "end_time": "",
      "days": []
    },
    "distribution_window_block": {
      "enabled": false,
      "start_time": "",
      "end_time": "",
      "days": []
    },
    "reset_block": {
      "enabled": false,
      "reset_time": "",
      "reset_frequency": ""
    }
  },

  "trigger_engine": {
    "primary_trigger_block": {
      "trigger_event": "",
      "action": "",
      "evidence": ""
    },
    "trigger_rule_block": {
      "rule_type": "",
      "conditions": [],
      "logic_operator": ""
    },
    "alternative_triggers_block": {
      "or_conditions": [],
      "and_conditions": []
    }
  },

  "claim_engine": {
    "method_block": {
      "claim_method": "",
      "auto_credit": false
    },
    "channels_block": {
      "channels": [],
      "priority_order": []
    },
    "claim_gate_block": {
      "requires_deposit_before_claim": false,
      "min_deposit_for_claim": null,

      "requires_withdraw_before_claim": false,
      "min_withdraw_for_claim": null,

      "requires_claim_before_play": false,
      "requires_claim_before_withdraw_form": false,
      "requires_claim_after_event_result": false,

      "requires_active_user_id": false,
      "active_user_period_value": null,
      "active_user_period_unit": "",
      "active_user_min_turnover": null,

      "requires_history_deposit": false,
      "min_history_deposit_amount": null,
      "history_deposit_period_value": null,
      "history_deposit_period_unit": "",

      "claim_deadline_value": null,
      "claim_deadline_unit": "",
      "claim_deadline_anchor": "",

      "claim_limit_per_period": null,
      "claim_limit_period": "",
      "claim_limit_scope": "",
      "claim_reset_frequency": "",
      "claim_reset_time": ""
    },
    "proof_requirement_block": {
      "proof_required": false,
      "proof_types": [],
      "proof_destinations": []
    },
    "instruction_block": {
      "claim_steps": [],
      "claim_url": ""
    }
  },

  "proof_engine": {
    "social_proof_block": {
      "platforms": [],
      "hashtags": [],
      "content_requirements": [],
      "share_to_groups_count": null,
      "share_target_group_type": "",
      "post_timing": "",
      "post_visibility": "",
      "proof_destination": ""
    },
    "screenshot_proof_block": {
      "ss_targets": [],
      "rules": [],
      "requires_before_action": false,
      "requires_after_action": false,
      "disallow_replay_screenshot": false
    },
    "document_proof_block": {
      "documents_required": [],
      "identity_match_required": false,
      "account_name_match_required": false
    }
  },

  "payment_engine": {
    "deposit_block": {
      "deposit_method": "",
      "deposit_method_providers": [],
      "deposit_rate": null
    },
    "method_whitelist_block": {
      "methods": [],
      "providers": []
    },
    "method_blacklist_block": {
      "methods": [],
      "providers": []
    }
  },

  "scope_engine": {
    "game_block": {
      "game_domain": "",
      "game_types": [],
      "markets": [],
      "applicable_markets": [],
      "eligible_providers": [],
      "included_providers": [],
      "excluded_providers": [],
      "game_names": [],
      "included_games": [],
      "excluded_games": [],
      "bet_types": [],
      "match_types": [],
      "market_types": []
    },
    "platform_block": {
      "platform_access": "",
      "apk_required": false
    },
    "geo_block": {
      "geo_restriction": "",
      "ip_whitelist_country": [],
      "ip_blacklist_country": []
    },
    "blacklist_block": {
      "types": [],
      "providers": [],
      "games": [],
      "rules": []
    },
    "odds_constraint_block": {
      "enabled": false,
      "min_odds": null,
      "max_odds": null,
      "min_odds_per_team": null,
      "applies_to_bet_types": [],
      "note": ""
    },
    "bet_configuration_block": {
      "enabled": false,
      "min_team_count": null,
      "max_team_count": null,
      "min_stake": null,
      "max_stake": null,
      "required_market_segments": [],
      "required_market_segment_count": null,
      "configuration_notes": []
    }
  },

  "reward_engine": {
    "event_block": {
      "event_rewards": [],
      "prizes": []
    },
    "requirement_block": {
      "min_deposit": null,
      "unlock_conditions": []
    },
    "turnover_tier_by_deposit_block": {
      "enabled": false,
      "tiers": [
        {
          "tier_id": "",
          "deposit_threshold_min": null,
          "deposit_threshold_max": null,
          "deposit_threshold_max_unlimited": false,
          "turnover_multiplier": null,
          "turnover_basis": "",
          "note": ""
        }
      ]
    },
    "combo_reward_block": {
      "combo_items": []
    },
    "reward_table_block": {
      "enabled": false,
      "table_type": "",
      "basis": "",
      "rows": [
        {
          "row_id": "",
          "label": "",
          "threshold_min": null,
          "threshold_max": null,
          "threshold_unit": "",
          "trigger_count": null,
          "trigger_count_unit": "",
          "stake_min": null,
          "stake_max": null,
          "team_count": null,
          "win_count": null,
          "lose_count": null,
          "condition_text": "",
          "reward_type": "",
          "reward_name": "",
          "reward_amount": null,
          "reward_percent": null,
          "reward_unit": "",
          "reward_basis": "",
          "reward_multiplier_of_stake": null,
          "physical_reward_name": "",
          "cash_reward_amount": null,
          "bonus_credit_amount": null,
          "max_reward": null,
          "payout_direction": "",
          "turnover_multiplier": null,
          "note": ""
        }
      ]
    },
    "matrix_reward_block": {
      "enabled": false,
      "matrix_type": "",
      "axis_x_label": "",
      "axis_y_label": "",
      "axis_x_values": [],
      "axis_y_values": [],
      "matrix_cells": [
        {
          "x": "",
          "y": "",
          "condition": "",
          "stake_amount": null,
          "stake_range_min": null,
          "stake_range_max": null,
          "symbol_count": null,
          "multiplier": null,
          "team_count": null,
          "reward_amount": null,
          "reward_percent": null,
          "reward_basis": "",
          "max_reward": null,
          "note": ""
        }
      ],
      "source_visual_required": false
    },
    "conditional_reward_block": {
      "conditions": [],
      "default_reward": null
    },
    "unit_reward_block": {
      "enabled": false,
      "trigger_unit": "",
      "value_per_unit": null,
      "value_unit": "",
      "is_accumulative": false,
      "max_units_per_claim": null,
      "max_reward": null,
      "note": ""
    },
    "reward_identity_block": {
      "item_name": null,
      "quantity": null
    },
    "calculation_basis": "",
    "calculation_method": "",
    "calculation_value": null,
    "calculation_unit": "",
    "payout_direction": "",
    "reward_type": "",
    "voucher_kind": null,
    "max_reward": null,
    "max_reward_unlimited": false,
    "currency": ""
  },

  "ticket_engine": {
    "ticket_block": {
      "enabled": false,
      "ticket_name": "",
      "ticket_source": "",
      "min_deposit_for_ticket": null,
      "deposit_per_ticket": null,
      "is_accumulative": false,
      "max_ticket_per_claim": null,
      "max_ticket_per_day": null,
      "validity_duration_value": null,
      "validity_duration_unit": "",
      "valid_until_time": "",
      "expires_on_reset": false,
      "ticket_payment_method_exclusion": []
    },
    "draw_block": {
      "draw_type": "",
      "draw_frequency": "",
      "draw_time": "",
      "winner_selection": "",
      "prize_pool": []
    }
  },

  "loyalty_engine": {
    "mechanism_block": {
      "point_name": "",
      "earning_rule": "",
      "loyalty_mode": "",
      "turnover_per_point": null,
      "point_per_turnover": null,
      "accumulation_time": "",
      "accumulation_timezone": "",
      "reset_period": "",
      "requires_apk": false
    },
    "exchange_block": {
      "exchange_groups": [
        {
          "group_id": "",
          "group_name": "",
          "claim_limit": null,
          "claim_limit_period": "",
          "items": [
            {
              "item_id": "",
              "points_required": null,
              "reward_type": "",
              "reward_name": "",
              "cash_reward_amount": null,
              "credit_game_amount": null,
              "physical_reward_name": "",
              "voucher_kind": "",
              "note": ""
            }
          ]
        }
      ]
    },
    "tier_block": {
      "tier_system": []
    }
  },

  "referral_engine": {
    "program_block": {
      "enabled": false,
      "referral_type": "",
      "commission_basis": "",
      "commission_rate": null,
      "commission_unit": "",
      "eligible_game_types": [],
      "eligible_markets": [],
      "min_downline_count": null,
      "min_downline_turnover": null,
      "downline_period_value": null,
      "downline_period_unit": "",
      "requires_downline_active": false,
      "requires_referrer_kyc": false,
      "requires_media_disclosure": false,
      "is_lifetime": false
    },
    "commission_rule_block": {
      "rules": [
        {
          "rule_id": "",
          "game_type": "",
          "market": "",
          "basis": "",
          "rate": null,
          "rate_unit": "",
          "min_downline": null,
          "min_winlose": null,
          "deposit_basis_anchor": "",
          "condition_text": ""
        }
      ]
    },
    "deduction_block": {
      "deductions": [
        {
          "deduction_id": "",
          "deduction_type": "",
          "amount": null,
          "percent": null,
          "note": ""
        }
      ]
    },
    "simulation_block": {
      "rows": [
        {
          "row_id": "",
          "downline_count": null,
          "winlose": null,
          "commission": null,
          "cashback_deduction": null,
          "fee_deduction": null,
          "net_winlose": null,
          "commission_rate": null,
          "commission_result": null,
          "note": ""
        }
      ]
    },
    "distribution_block": {
      "distribution_frequency": "",
      "distribution_day": "",
      "distribution_time": "",
      "auto_credit": false
    },
    "link_block": {
      "requires_referral_link": false,
      "link_format": "",
      "example_link": ""
    }
  },

  "result_event_engine": {
    "result_match_block": {
      "enabled": false,
      "result_source": "",
      "result_source_markets": [],
      "match_target": "",
      "match_digits": null,
      "match_position": "",
      "match_logic": "",
      "claim_window_after_result_hours": null
    },
    "prize_block": {
      "prizes": [
        {
          "prize_id": "",
          "prize_tier": "",
          "prize_label": "",
          "prize_amount": null,
          "prize_currency": "",
          "requires_bet_on_match_target": false,
          "minimum_bet_amount": null,
          "max_winners_per_period": null,
          "note": ""
        }
      ],
      "prize_rules": []
    }
  },

  "fulfillment_engine": {
    "physical_reward_block": {
      "enabled": false,
      "requires_shipping": false,
      "shipping_period_anchor": "",
      "shipping_period_value": null,
      "shipping_period_unit": "",
      "shipping_method": "",
      "recipient_data_required": [],
      "stock_replacement_allowed": false,
      "tax_borne_by": "",
      "fee_required": false,
      "fee_note": "",
      "can_convert_to_credit": null
    }
  },

  "variant_engine": {
    "summary_block": {
      "has_subcategories": false,
      "expected_count": null,
      "default_variant_id": ""
    },
    "items_block": {
      "subcategories": [
        {
          "variant_id": "",
          "variant_name": "",
          "promo_code": "",

          "calculation_basis": "",
          "calculation_method": "",
          "calculation_value": null,
          "calculation_unit": "",

          "min_deposit": null,
          "max_reward": null,
          "max_reward_unlimited": false,
          "min_claim": null,

          "claim_gate_block": {
            "requires_deposit_before_claim": false,
            "min_deposit_for_claim": null,

            "requires_withdraw_before_claim": false,
            "min_withdraw_for_claim": null,

            "requires_claim_before_play": false,
            "requires_claim_before_withdraw_form": false,
            "requires_claim_after_event_result": false,

            "claim_deadline_value": null,
            "claim_deadline_unit": "",
            "claim_deadline_anchor": "",

            "claim_limit_per_period": null,
            "claim_limit_period": "",
            "claim_limit_scope": ""
          },

          "turnover_multiplier": null,
          "turnover_rule_format": "",
          "turnover_tier_by_deposit": [
            {
              "deposit_threshold_min": null,
              "deposit_threshold_max": null,
              "turnover_multiplier": null,
              "note": ""
            }
          ],

          "game_domain": "",
          "game_types": [],
          "markets": [],
          "applicable_markets": [],
          "eligible_providers": [],
          "included_providers": [],
          "excluded_providers": [],
          "game_names": [],
          "included_games": [],
          "excluded_games": [],
          "bet_types": [],
          "match_types": [],
          "market_types": [],

          "blacklist": {
            "enabled": false,
            "types": [],
            "providers": [],
            "games": [],
            "rules": [],
            "note": ""
          },

          "reward_type": "",
          "payout_direction": "",
          "currency": "",

          "physical_reward_name": "",
          "physical_reward_quantity": null,
          "cash_reward_amount": null,
          "reward_quantity": null,

          "voucher_kind": "",
          "voucher_valid_from": null,
          "voucher_valid_until": null,
          "voucher_valid_unlimited": false,

          "lucky_spin_id": "",
          "lucky_spin_max_per_day": null,

          "product_note": ""
        }
      ]
    }
  },

  "dependency_engine": {
    "exclusion_block": {
      "mutually_exclusive_with": [],
      "can_combine_with": []
    },
    "stacking_block": {
      "stacking_allowed": false,
      "stacking_policy": "",
      "rules": [],
      "max_concurrent": null
    },
    "prerequisite_block": {
      "requires_promo": [],
      "requires_achievement": []
    }
  },

  "invalidation_engine": {
    "void_conditions_block": [
      {
        "condition_id": "",
        "condition_type": "",
        "scope": "",
        "description": "",
        "voids_bonus": false,
        "voids_winnings": false,
        "voids_full_balance": false,
        "evidence": ""
      }
    ],
    "penalty_block": {
      "void_action": "",
      "penalty_type": "",
      "penalty_scope": ""
    },
    "anti_fraud_block": {
      "anti_fraud_rules": [],
      "detection_methods": [],
      "restricted_behaviors": []
    }
  },

  "terms_engine": {
    "conditions_block": {
      "terms_conditions": []
    },
    "requirements_block": {
      "special_requirements": []
    }
  },

  "readiness_engine": {
    "state_block": {
      "state": "draft",
      "state_changed_at": "",
      "state_changed_by": ""
    },
    "commit_block": {
      "ready_to_commit": false
    },
    "validation_block": {
      "is_structurally_complete": false,
      "status": "draft",
      "warnings": []
    },
    "observability_block": {
      "ambiguity_flags": [],
      "contradiction_flags": [],
      "review_required": true
    }
  },

  "reasoning_engine": {
    "intent_block": {
      "primary_action": "",
      "reward_nature": "",
      "distribution_path": "",
      "value_shape": ""
    },
    "selection_block": {
      "mechanic_type": "",
      "locked_fields": [],
      "invariant_violations": []
    }
  },

  "mechanics_engine": {
    "source_block": {
      "source": ""
    },
    "items_block": {
      "items": []
    }
  },

  "projection_engine": {
    "_description": "DERIVED ONLY. Generated post-extraction. Extractor must NOT write directly. Naming follows V.10.2 canonical. Not source of truth.",
    "summary_block": {
      "promo_summary": "",
      "main_trigger": "",
      "main_reward_form": "",
      "main_reward_percent": null,
      "main_reward_value": null,
      "main_reward_unit": "",
      "max_reward": null,
      "min_deposit": null,
      "min_withdraw": null,
      "payout_direction": "",
      "turnover_multiplier": null,
      "turnover_basis": "",
      "_summary_skipped_reason": ""
    },
    "claim_summary_block": {
      "primary_claim_method": "",
      "primary_claim_platform": "",
      "claim_channels": [],
      "auto_credit": false,
      "proof_required": false,
      "claim_frequency": "",
      "distribution_day": ""
    },
    "scope_summary_block": {
      "game_domain": "",
      "game_domains": [],
      "game_types": [],
      "eligible_providers": [],
      "blacklist_summary": {
        "types": [],
        "providers": [],
        "games": [],
        "rules": []
      },
      "platform_access": "",
      "apk_required": false,
      "geo_restriction": "",
      "stacking_policy": ""
    },
    "intent_summary_block": {
      "intent_category": "",
      "primary_action": "",
      "reward_nature": "",
      "distribution_path": "",
      "value_shape": "",
      "target_segment": ""
    }
  },

  "risk_engine": {
    "level_block": {
      "promo_risk_level": ""
    }
  },

  "meta_engine": {
    "source_block": {
      "source_url": "",
      "raw_content": "",
      "extraction_source": "",
      "source_type": ""
    },
    "extraction_block": {
      "has_rowspan_tables": false,
      "html_was_normalized": false,
      "client_id_source": "",
      "propagated_fields": [],
      "ambiguous_blacklists": null,
      "extracted_at": "",
      "classification_overridden": false,
      "classification_override_reason": "",
      "original_llm_category": ""
    },
    "unmodeled_evidence_block": {
      "items": [
        {
          "evidence_id": "",
          "captured_at": "",
          "captured_by": "",
          "field_candidate": "",
          "source_text": "",
          "reason_not_modeled": "",
          "suggested_engine": "",
          "suggested_path": "",
          "occurrence_count": null,
          "requires_schema_review": true,
          "review_status": "pending",
          "promoted_to_field": ""
        }
      ]
    },
    "schema_block": {
      "schema_name": "PKB_Wolfbrain",
      "schema_version": "V.10.2",
      "base_locked_at": "2026-04-28",
      "released_at": "2026-05-15",
      "previous_version": "V.10.1",
      "previous_released_at": "2026-05-04",
      "created_by": "habe_raja",
      "owner": "Habe Raja — Wolfbrain / Promo Knowledge Base",
      "status": "candidate_locked",
      "extractor": "wolfclaw@claude-sonnet-4-5",
      "amendment_type": "major_schema_expansion",
      "amendment_reason": "Coverage expansion based on observed promo corpus analysis. Adds claim gates, reward tables, matrix rewards, unit rewards, ticket mechanics, referral logic, loyalty exchange, result events, fulfillment, schedule variants, odds constraints, bet configuration, game segmentation, typed invalidation, and centralized unmodeled evidence governance.",
      "record_type": "promo"
    }
  },

  "ai_confidence": {},
  "_field_status": {},
  "_propagation_stats": {},
  "_human_override_log": [],
  "_ai_resolver_log": []
}
```

### Ringkasan skeleton

| Aspek | V.10.1 | V.10.2 | Selisih |
|-------|--------|--------|---------|
| Total baris (formatted) | 454 | ~906 | +452 |
| Karakter | 7,337 | ~22,475 | +15,138 |
| Engine | 22 | **26** | +4 |
| Leaf field | ~280 | **469** | +189 |

Skeleton V.10.2 lebih besar karena penambahan 4 engine baru (ticket, referral, result_event, fulfillment) dan 12 block baru di engine existing.

**Semua tambahan strictly additive — backward compatible 100% dengan V.10.1.**

---

# Bagian 3 — 26 Engine V.10.2

| # | Engine | Fungsi | Authority | Status |
|---|--------|--------|-----------|--------|
| 1 | `identity_engine` | Siapa pemilik promo dan apa nama promonya | PRIMARY | V.10 base |
| 2 | `classification_engine` | Kategori promo A/B/C dengan audit reasoning | PRIMARY | V.10 base |
| 3 | `taxonomy_engine` | Bentuk promo (fixed/formula/tier/matrix) | PRIMARY | V.10 base, expanded V.10.2 (tier_threshold_block) |
| 4 | `period_engine` | Periode validity & distribution | PRIMARY | V.10 base, expanded V.10.2 (schedule_variant_block) |
| 5 | `time_window_engine` | Zona waktu & jendela waktu | PRIMARY | V.10 base |
| 6 | `trigger_engine` | Event yang trigger promo | PRIMARY | V.10 base |
| 7 | `claim_engine` | Cara klaim promo | PRIMARY | V.10 base, **expanded V.10.2 (claim_gate_block)** |
| 8 | `proof_engine` | Bukti yang dibutuhkan | PRIMARY | V.10 base, expanded V.10.2 (document_proof_block) |
| 9 | `payment_engine` | Method pembayaran | PRIMARY | V.10 base |
| 10 | `scope_engine` | Scope game/market | PRIMARY | V.10 base, expanded V.10.2 (odds_constraint, bet_configuration) |
| 11 | `reward_engine` | Reward calculation & form | PRIMARY | V.10 base, **expanded V.10.2 (reward_table, matrix typed, unit_reward)** |
| 12 | **`ticket_engine`** | **Lucky spin / raffle / ticket-based draw** | **PRIMARY** | **BARU V.10.2** |
| 13 | `loyalty_engine` | Loyalty point & tier | PRIMARY | V.10 base, expanded V.10.2 |
| 14 | **`referral_engine`** | **Referral commission structured** | **PRIMARY** | **BARU V.10.2** |
| 15 | **`result_event_engine`** | **Event berbasis hasil (lottery match)** | **PRIMARY** | **BARU V.10.2** |
| 16 | **`fulfillment_engine`** | **Physical reward fulfillment** | **PRIMARY** | **BARU V.10.2** |
| 17 | `variant_engine` | Multi-variant subcategories | PRIMARY | V.10 base, expanded V.10.2 (claim_gate per-variant + segmentation) |
| 18 | `dependency_engine` | Dependency & stacking | PRIMARY | V.10 base |
| 19 | `invalidation_engine` | Void conditions & penalty | PRIMARY | V.10 base, expanded V.10.2 (typed void_conditions) |
| 20 | `terms_engine` | Terms & special requirements | PRIMARY | V.10 base |
| 21 | `readiness_engine` | State lifecycle & validation | OPERATIONAL | V.10 base |
| 22 | `reasoning_engine` | Intent & semantic selection | AUXILIARY | V.10 base |
| 23 | `mechanics_engine` | Atomic mechanic items (audit/debug) | **AUXILIARY** ⚠️ | V.10 base, **LOCKED as AUXILIARY in V.10.2** |
| 24 | `projection_engine` | DERIVED summary — read only | **DERIVED** ⚠️ | V.10 base |
| 25 | `risk_engine` | Risk level | PRIMARY | V.10 base |
| 26 | `meta_engine` | Source & schema metadata + unmodeled_evidence | OPERATIONAL | V.10 base, **expanded V.10.2 (unmodeled_evidence_block, schema lifecycle, record_type)** |

**Top-level fields:** `domain`, `record_id`, `created_at`, `updated_at`, `ai_confidence`, `_field_status`, `_propagation_stats`, `_human_override_log`, `_ai_resolver_log`

### Justifikasi 4 engine baru V.10.2

| Engine | Promo yang membutuhkan |
|--------|------------------------|
| `ticket_engine` | 5 promo: PRESIDENSLOT Lucky Spin, PRESIDENSLOT Bagi HP, CITRA77 Lucky Spin, OLXTOTO 25 Smartphone, TARUHANBOLA Lucky Wheel |
| `referral_engine` | 6+ promo: CITRA77 Referral 15%, PRESIDENSLOT Referral 1%, OLXTOTO 4 variants, TARUHANBOLA Lifetime 0.2%, BOSTONTOTO Togel 0.5% |
| `result_event_engine` | 1+ unique pattern: OLXTOTO Mystery Number (lottery result match) |
| `fulfillment_engine` | 8+ promo: PRESIDENSLOT T-Shirt+motor+HP, CITRA77 Merchandise, OLXTOTO Gebyar Bulanan, TARUHANBOLA Parlay Smartphone |

---

# Bagian 4 — Aturan Pakai V.10.2

> **Locked 15 Mei 2026.** Bagian ini menjawab pertanyaan operasional: kalau schema punya field di 2 tempat (record-level vs per-varian), mana yang dipakai? Aturan ini mengikat extractor, selector, UI, Admin Verify, dan Danila.

## Aturan 1 — Header vs Variant (Single vs Multi)

Schema punya field reward yang muncul di 2 lokasi:
- `reward_engine` (record-level)
- `variant_engine.items_block.subcategories[i]` (per-varian)

**Aturan resolusi:**

| `promo_mode` | Sumber kebenaran |
|--------------|------------------|
| `single` | `reward_engine` adalah sumber. `subcategories: []` kosong. |
| `multi` | `subcategories[]` adalah sumber. `reward_engine` cuma global default. |

**Konsekuensi untuk konsumer:**
- UI variant card → baca dari `subcategories[i]` kalau multi, dari `reward_engine` kalau single
- Selector V.10.2 → pakai `promo_mode` sebagai gate
- Admin Verify → tampilkan input record-level untuk single, input per-varian untuk multi
- Danila → jawab dari `subcategories[i]` kalau multi, dari `reward_engine` kalau single

### V.10.2 NEW — claim_gate_block per-variant

V.10.2 nambah `claim_gate_block` di 2 lokasi:
- `claim_engine.claim_gate_block` (GLOBAL — record-level)
- `variant_engine.items_block.subcategories[i].claim_gate_block` (PER-VARIANT)

**Aturan:**
- Per-variant value **MENANG** atas global value (semantically lebih spesifik)
- Kalau per-variant gak diisi, fallback ke global value
- AI extractor **GAK BOLEH** isi 2 path bersamaan kecuali memang ada beda yang explicit

### `min_withdraw_for_claim` 3-Path SSOT

Field `min_withdraw_for_claim` ada di 3 tempat:

| Path | Semantik |
|------|----------|
| `claim_engine.claim_gate_block.min_withdraw_for_claim` | GLOBAL claim gate |
| `variant_engine.items_block.subcategories[i].claim_gate_block.min_withdraw_for_claim` | PER-VARIANT (override global) |
| `projection_engine.summary_block.min_withdraw` | **DERIVED** — AI dilarang tulis langsung |

---

## Aturan 2 — Field Lama yang Sengaja Dihapus

Field berikut dihapus karena di-cover oleh field yang lebih semantic. **Hilangnya intentional. Jangan dikembalikan. Jangan bikin alias.**

### Dihapus di V.10.1:

| Field lama (DROP) | Pengganti |
|---|---|
| `bonus_percentage` | `calculation_value` + `calculation_unit = "percent"` |
| `game_category` | `game_domain` |
| `game_exclusions` | `blacklist.types` / `.providers` / `.games` / `.rules` |
| `max_bonus` | `max_reward` |
| `minimum_base` | `min_deposit` |
| `sub_name` | `variant_name` |
| `calculation_base` | `calculation_basis` |
| `provider_blacklist` (flat) | `blacklist.providers` (nested) |
| `blacklist_confidence` | `ai_confidence[path]` map root |
| `blacklist_note` (flat) | `blacklist.note` (nested) |
| `minimum_base_source` | `_field_status[path]` map root |
| `payment_engine.deposit_block.min_deposit` | `reward_engine.requirement_block.min_deposit` |
| `classification_override` | `override_detail` |
| `classifier_prompt_version` | `prompt_version` |
| `classifier_latency_ms` | `latency_ms` |
| `unlock_conditions` (di trigger_engine) | `reward_engine.requirement_block.unlock_conditions` |

### Dihapus di V.10.2 (BARU):

| Field V.10.1 lama (DROP) | Pengganti V.10.2 | Kenapa? |
|---|---|---|
| `reward_engine.requirement_block.min_withdraw` | `claim_engine.claim_gate_block.min_withdraw_for_claim` | Min WD itu syarat klaim, bukan syarat reward. Logikanya gak match. |
| `variant_engine.subcategories[i].min_withdraw` (flat) | `subcategories[i].claim_gate_block.min_withdraw_for_claim` | Per-variant claim gate proper placement |
| `_extensions: {}` per engine (22 occurrence di V.10.1) | `meta_engine.unmodeled_evidence_block.items[]` | Centralized escape hatch — anti tempat sampah per engine |
| `result_event_engine.result_match_block.requires_bet_on_number` | `result_event_engine.prize_block.prizes[].requires_bet_on_match_target` | Per-prize eligibility (main vs consolation bisa beda eligibility) |
| `result_event_engine.result_match_block.minimum_bet_amount` | `result_event_engine.prize_block.prizes[].minimum_bet_amount` | Per-prize eligibility |
| `result_event_engine.prize_block.main_prize_amount` (flat) | `result_event_engine.prize_block.prizes[].prize_amount` (typed array) | Typed array dengan per-prize fields |
| `result_event_engine.prize_block.consolation_prize_amount` (flat) | `result_event_engine.prize_block.prizes[]` dengan `prize_tier = "consolation"` | Typed array |

### Migration dari V.10.1

- Records yang punya `reward_engine.requirement_block.min_withdraw` → pindahin value ke `claim_engine.claim_gate_block.min_withdraw_for_claim`
- Records yang punya `_extensions: {}` per engine → pindahin content ke `meta_engine.unmodeled_evidence_block.items[]` dengan structured format
- Records yang gak punya `record_type` → default `"promo"`

**Kalau UI lama masih baca field-field di kolom kiri → UI yang harus migrasi ke V.10.2, bukan schema yang bikin alias.**

---

## Aturan 3 — Urutan Varian & Default Variant

**Display order:** Urutan array `subcategories[]` adalah urutan tampilan di UI. UI WAJIB ikutin urutan array, gak boleh sort sendiri.

**Default variant:** `variant_engine.summary_block.default_variant_id` adalah string reference ke `subcategories[i].variant_id`.

```json
"variant_engine": {
  "summary_block": {
    "has_subcategories": true,
    "expected_count": 5,
    "default_variant_id": "WB-CASINO-50"
  },
  "items_block": {
    "subcategories": [
      { "variant_id": "WB-CASINO-50", ... },
      { "variant_id": "WB-SPORTS-50", ... }
    ]
  }
}
```

**Aturan resolusi default variant:**
- Kalau `default_variant_id` non-empty → cari subcategory dengan `variant_id` yang match → tampilkan duluan
- Kalau `default_variant_id` kosong `""` → fallback ke `subcategories[0]`
- Kalau `default_variant_id` non-empty tapi `variant_id` gak ditemukan → fallback ke `subcategories[0]` + log warning

**JANGAN:**
- ❌ Pakai array index sebagai source of truth (`default_variant_index: 0`)
- ❌ Tambah `is_default: true` flag di setiap subcategory (bisa konflik kalau 2 varian sama-sama `true`)
- ❌ Sort `subcategories[]` di UI (array order = display order)

---

## Aturan 4 — Format `_field_status` Map

`_field_status` di root JSON adalah map `{ "JSON path": "status enum" }`.

**Key format:** Full JSON path dengan dot notation untuk object dan bracket notation untuk array index.

**Value format:** Enum dari F3:
- `explicit` — disebut langsung di sumber
- `inferred` — disimpulkan AI dari konteks
- `derived` — dihitung dari field lain (deterministic)
- `propagated` — di-cascade dari parent context (e.g. client_id)
- `not_stated` — gak disebut, AI jujur gak tau
- `not_applicable` — gak relevan untuk promo ini

**Contoh konkret (V.10.2 dengan engine baru):**

```json
"_field_status": {
  "identity_engine.promo_block.promo_type": "explicit",
  "reward_engine.calculation_value": "explicit",
  "reward_engine.max_reward": "inferred",
  "period_engine.validity_block.valid_until": "not_stated",
  "variant_engine.items_block.subcategories[0].claim_gate_block.min_withdraw_for_claim": "explicit",
  "claim_engine.claim_gate_block.min_withdraw_for_claim": "explicit",
  "referral_engine.program_block.enabled": "explicit",
  "ticket_engine.ticket_block.enabled": "not_applicable",
  "result_event_engine.result_match_block.enabled": "not_applicable",
  "fulfillment_engine.physical_reward_block.requires_shipping": "explicit",
  "meta_engine.schema_block.record_type": "explicit"
}
```

**Konsumer rules:**
- Question Engine → tampilin pertanyaan untuk field critical yang `not_stated`
- Question Engine → SKIP field `not_applicable`
- UI confidence badge → kombinasi `_field_status[path]` + `ai_confidence[path]`
- Selector → pakai `_field_status[path]` sebagai guard untuk null vs unknown

---

## Aturan 5 — `mechanics_engine` = AUXILIARY (V.10.2 LOCKED)

**Update V.10.2:** Status `mechanics_engine` di-LOCK sebagai **AUXILIARY layer**. Bukan deferred typing lagi.

### Kenapa diubah dari V.10.1?

V.10.1 dulu bilang: *"mechanics_engine = sumber kebenaran utama"*.

**Masalahnya:** Kalau Danila (AI customer service) ditanya *"min deposit berapa?"*, dia bingung baca dari mana — `mechanics_engine.items[]` atau `reward_engine.requirement_block.min_deposit`?

**Sekarang jelas:**
- Yang resmi = `reward_engine` (sumber kebenaran)
- `mechanics_engine` = catatan kerja AI (audit doang)

Analogi: kayak corat-coret kasir di balik struk. Ada gunanya untuk audit, tapi yang resmi tetap struk-nya.

### Behavior V.10.2

| Aspek | V.10.1 | V.10.2 |
|-------|--------|--------|
| Authority | Truth #1 | **AUXILIARY** |
| Danila baca? | YA | **GAK** (typed engines yang resmi) |
| Form Wizard tampilin? | YA | **GAK** |
| Validator wajib validate? | YA | **OPTIONAL** (boleh skip) |
| Bentrok dengan typed engines? | mechanics menang | **typed engines MENANG** |
| `items: []` kosong? | Warning | **Allowed** (gak block commit) |

**Bukan blocker untuk V.10.2 production.**

**Future:** Kalau ada use case yang butuh atomic mechanic units (misal: future ML training data, advanced reasoning trace) → typing detail bisa di-spec ulang. Saat ini cukup sebagai placeholder.

---

## Aturan 6 — `unmodeled_evidence_block` Discipline (V.10.2 BARU)

Per Governance G4. Replaces per-engine `_extensions` yang dihapus di V.10.2.

**Lokasi:** `meta_engine.unmodeled_evidence_block.items[]`

**Schema item:**

```json
{
  "evidence_id": "",
  "captured_at": "",
  "captured_by": "",
  "field_candidate": "",
  "source_text": "",
  "reason_not_modeled": "",
  "suggested_engine": "",
  "suggested_path": "",
  "occurrence_count": null,
  "requires_schema_review": true,
  "review_status": "pending",
  "promoted_to_field": ""
}
```

**Hard rules:**

1. `unmodeled_evidence_block` **BUKAN** sumber kebenaran
2. **GAK** dibaca Danila runtime
3. **GAK** ditampilin di Form Wizard
4. **HANYA** untuk audit + temporary capture sebelum schema promotion
5. AI extractor **DILARANG** nulis ke `unmodeled_evidence_block` otomatis tanpa Human override
6. Setiap write WAJIB di-log di `_human_override_log[]`

**Promotion workflow:**

| Frequency | Action |
|-----------|--------|
| 1-2 records | Stay (anekdot) |
| 3+ records, 1 brand | Stay (brand-specific) |
| **3+ records, 2+ brand** | **TRIGGER promotion review** → Habe Raja review → approve/reject |

---

## Aturan 7 — `projection_engine` = DERIVED ONLY

`projection_engine` adalah **derived-only output**. AI extractor **DILARANG** tulis langsung.

**Generated post-extraction dari engine PRIMARY.**

**Validator BLOCK commit kalau extractor write detected di projection paths.**

Per G3.3 — `projection.summary_block.min_withdraw` di-derive dengan urutan:

```
IF variant_engine.summary_block.has_subcategories = true:
    1. subcategories[default_variant_id].claim_gate_block.min_withdraw_for_claim
    2. Fallback: claim_engine.claim_gate_block.min_withdraw_for_claim
ELSE:
    1. claim_engine.claim_gate_block.min_withdraw_for_claim
    2. Fallback: null
```

---

## Aturan 8 — `record_type` Discipline (V.10.2 BARU)

Per Governance G7. New field `meta_engine.schema_block.record_type` dengan 3 enum:

| Value | Meaning | Behavior |
|-------|---------|----------|
| `"promo"` | Standard promo record | Default. Displayed in promo listing. Available to Danila. |
| `"site_policy"` | Brand-wide policy (bukan promo) | GAK displayed di promo listing. Bisa di-reference Danila untuk policy questions. |
| `"informational"` | Content informational (transparency, anti-scam posts) | Future use. GAK displayed di promo listing. |

**Migration:**
- V.10.1 records (yang gak punya `record_type`) → default `"promo"`
- TARUHANBOLA #1 (*"Syarat & Ketentuan Bermain"*) → kandidat re-classify ke `"site_policy"`

---

# Changelog

## V.10.1 → V.10.2 (15 Mei 2026)

**Tipe:** `major_schema_expansion` — coverage expansion via 4 engine baru + 12 block baru + governance structural changes.
**Status:** `candidate_locked`
**Backward compatibility:** Strictly additive — semua field V.10.1 tetap berlaku.

**Trigger:** Audit gap V.10.1 via stress test 4 brand (PRESIDENSLOT, CITRA77, OLXTOTO, TARUHANBOLA) + cross-validation BOSTONTOTO. V.10.1 schema gak punya rumah untuk:
- `min_withdraw_for_claim` (WD-gated promo)
- Lucky spin / raffle mechanics
- Referral commission structured (per game/market)
- Lottery result match (Mystery Number pattern)
- Physical reward fulfillment (shipping)
- Reward table 1-dim (turnover ladder, parlay events)
- Reward matrix 2-dim (stake × symbol)
- Per-unit reward (Red Card pattern)
- Tier threshold simple (cashback 5/7/10%)

**Yang berubah:**

### A. 4 Engine Baru
- `ticket_engine` — Lucky spin / raffle
- `referral_engine` — Referral commission structured
- `result_event_engine` — Lottery result match
- `fulfillment_engine` — Physical reward fulfillment

### B. 12 Block Baru di Engine Existing
- `claim_engine.claim_gate_block` — GLOBAL claim gate
- `reward_engine.reward_table_block` — 1-dim reward table
- `reward_engine.matrix_reward_block` (typed expansion) — 2-dim matrix
- `reward_engine.unit_reward_block` — Per-unit reward
- `reward_engine.turnover_tier_by_deposit_block` — Turnover multiplier per deposit tier
- `taxonomy_engine.tier_threshold_block` — Simple tier/range logic
- `scope_engine.odds_constraint_block` — Sports parlay odds constraints
- `scope_engine.bet_configuration_block` — Sports parlay configuration
- `period_engine.schedule_variant_block` — Weekday/weekend reward variation
- `proof_engine.document_proof_block` — KYC / document requirements
- `loyalty_engine.exchange_block` (typed items expansion)
- `invalidation_engine.void_conditions_block` (typed expansion)

### C. Block Baru di variant_engine.subcategories[i]
- `claim_gate_block` per-variant (slim version)
- `turnover_tier_by_deposit[]` per-variant
- Segmentation fields: `included_providers`, `excluded_providers`, `included_games`, `excluded_games`, `bet_types`, `match_types`, `market_types`

### D. SSOT Cleanup — Forbidden Paths Removed
- `reward_engine.requirement_block.min_withdraw` → DELETED (pindah ke `claim_engine.claim_gate_block.min_withdraw_for_claim`)
- `variant_engine.subcategories[i].min_withdraw` (flat) → DELETED (pindah ke per-variant `claim_gate_block`)
- `_extensions: {}` per engine (22 occurrence di V.10.1) → DELETED (centralized to `meta_engine.unmodeled_evidence_block`)

### E. Typed Restructure
- `result_event_engine.prize_block`:
  - REMOVED: `main_prize_amount`, `consolation_prize_amount` (flat fields)
  - REMOVED: `result_match_block.requires_bet_on_number`, `minimum_bet_amount`
  - ADDED: `prizes[]` typed array dengan per-prize eligibility

### F. New Meta Fields
- `meta_engine.schema_block.record_type` — `promo` / `site_policy` / `informational`
- `meta_engine.schema_block.previous_version`, `previous_released_at` — version audit trail
- `meta_engine.schema_block.status` lifecycle expansion — `draft` → `candidate_locked` → `review_pending` → `locked` → `deprecated`
- `meta_engine.schema_block.amendment_type` enum — 5 levels
- `meta_engine.unmodeled_evidence_block` — centralized escape hatch

### G. Doctrine Updates

Aturan baru:
- **Aturan 8.2** — DILARANG REGEX / KEYWORD MATCHER (BARU)
- **Aturan 6** — `unmodeled_evidence_block` Discipline (BARU)
- **Aturan 7** — `projection_engine` = DERIVED ONLY (formalized)
- **Aturan 8** — `record_type` Discipline (BARU)

Aturan yang di-LOCK:
- **mechanics_engine = AUXILIARY** (per Governance G9) — bukan deferred typing lagi

### H. Governance Rules — companion document

V.10.2 ships dengan `V10_2_Governance_Rules.md` (12 rules locked):
- G1: AI Schema Patch Prohibition
- G2: Versioning Discipline
- G3: min_withdraw 3-path SSOT
- G4: unmodeled_evidence_block discipline
- G5: Reward Block Placement (anti-overlap) + Section 5.6 Winstreak Note
- G6: Coverage Claim Discipline
- G7: record_type Discipline
- G8: Doctrine-Code Sync Sequence
- G9: Authority Layers (mechanics = AUXILIARY)
- G10: event_block Placement
- G11: Extractor No-Regex Doctrine
- G12: Status Lifecycle

### I. F3 Enum Registry — companion document

V.10.2 ships dengan `WB_F3_Enum_Registry_V10_2.md`:
- 26 sections (1 per engine)
- 6 enum baru untuk winstreak (table_type: `streak_ladder`, basis: `streak_count`/`winstreak_count`/`losestreak_count`, trigger_count_unit: `consecutive_wins`/`consecutive_losses`)
- 30+ enum baru untuk engine baru

### Yang gak berubah

- 22 engine V.10.1 (semua tetap ada, ditambah 4 baru)
- Field per-engine V.10.1 (tetap berlaku, ditambah block baru)
- Doctrine prinsip dasar (Aturan 1-10 sebagian besar gak berubah)
- Enum vocabulary V.10.1 (tetap berlaku, ditambah enum baru)
- Form mapping V.10.1 baseline (F4 di-update di step berikutnya)

### Hubungan record-level vs per-varian (V.10.2 LOCKED)

| Record-level (default — promo single) | Per-varian (override — multi) |
|---|---|
| `reward_engine.requirement_block.min_deposit` | `subcategories[i].min_deposit` |
| `reward_engine.calculation_basis` | `subcategories[i].calculation_basis` |
| `reward_engine.calculation_method` | `subcategories[i].calculation_method` |
| `reward_engine.calculation_value` | `subcategories[i].calculation_value` |
| `reward_engine.calculation_unit` | `subcategories[i].calculation_unit` |
| `reward_engine.max_reward` | `subcategories[i].max_reward` |
| `reward_engine.max_reward_unlimited` | `subcategories[i].max_reward_unlimited` |
| `reward_engine.currency` | `subcategories[i].currency` |
| `reward_engine.reward_type` | `subcategories[i].reward_type` |
| `reward_engine.payout_direction` | `subcategories[i].payout_direction` |
| `reward_engine.voucher_kind` | `subcategories[i].voucher_kind` |
| `reward_engine.turnover_tier_by_deposit_block.tiers[]` | `subcategories[i].turnover_tier_by_deposit[]` |
| `scope_engine.game_block.game_domain` | `subcategories[i].game_domain` |
| `scope_engine.game_block.eligible_providers` | `subcategories[i].eligible_providers` |
| `scope_engine.game_block.included_providers` | `subcategories[i].included_providers` |
| `scope_engine.game_block.excluded_providers` | `subcategories[i].excluded_providers` |
| `scope_engine.game_block.included_games` | `subcategories[i].included_games` |
| `scope_engine.game_block.excluded_games` | `subcategories[i].excluded_games` |
| `scope_engine.game_block.bet_types` | `subcategories[i].bet_types` |
| `scope_engine.game_block.match_types` | `subcategories[i].match_types` |
| `scope_engine.game_block.market_types` | `subcategories[i].market_types` |
| `scope_engine.blacklist_block.{types,providers,games,rules}` | `subcategories[i].blacklist.{types,providers,games,rules,note}` |
| `claim_engine.claim_gate_block.{...}` | `subcategories[i].claim_gate_block.{...}` ⭐ BARU V.10.2 |

**Aturan resolusi:**
- `has_subcategories = false` → semua data di record-level. `subcategories[]` kosong.
- `has_subcategories = true` → record-level = default; per-varian = override.
- Field yang **GAK BOLEH per-varian**: gak ada (semua field reward + scope + claim_gate boleh di-override per varian)

**Approved by:** Habe Raja (Fux), WOLFGANK
**Date:** 15 Mei 2026
**Status:** candidate_locked

---

*PKB_Wolfbrain | File 1 of 4 | Doctrine + Skeleton V.10.2 | 28 Apr 2026 (V.10) → 4 Mei 2026 (V.10.1) → 15 Mei 2026 (V.10.2 candidate_locked) | Habe Raja*
