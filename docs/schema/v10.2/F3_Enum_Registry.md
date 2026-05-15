# PKB_WOLFBRAIN — FILE 3
# ENUM REGISTRY V.10.2

**Project:** Liveboard / Wolfbrain
**Owner:** Habe Raja (Fux), WOLFGANK
**Schema:** PKB_Wolfbrain V.10.2
**Status:** candidate_locked
**Released:** 15 Mei 2026
**Companion:** `PKB_Wolfbrain_V10_2_skeleton.json` + `V10_2_Governance_Rules.md`

---

Dokumen ini mendaftarkan semua nilai yang diizinkan per field di JSON Wolfbrain V.10.2.

**Aturan Penamaan:**
- Nilai sistem: `snake_case`
- Nama brand / financial provider: `UPPERCASE` (BCA, DANA, TELKOMSEL)
- Nama game provider: `Title Case` (Pragmatic Play, PG Soft)
- Tidak boleh ada alias — satu konsep, satu nilai
- Penambahan nilai baru: hanya oleh habe_raja
- Enum adalah kosakata — bukan mesin keputusan

**Per Governance Rule G11 (No-Regex Doctrine):**
Enum dipakai sebagai daftar kosakata resmi untuk validasi. Extractor TIDAK BOLEH pakai enum sebagai keyword matcher. Pengisian field tetap berdasarkan **semantic understanding**, lalu dicocokkan ke enum vocabulary.

---

## BAGIAN 1 — ENUM REGISTRY (per engine)

### 1.1 Identity Engine

**promo_type**
```
welcome_bonus
deposit_bonus
new_member_bonus
cashback
rollingan
referral
event_turnover_ladder
event_ranking
lucky_draw
lucky_spin
level_up
loyalty_point
merchandise
freechip
parlay_protection
birthday_bonus
extra_withdraw
payment_discount
mystery_number
event_slot_specific
event_sports_specific
freespin_bonus
withdraw_bonus
apk_signup_bonus
weekend_special
tier_upgrade_event
```

**target_user**
```
new_member
existing_member
vip
all_member
referrer
downline
```

**promo_mode**
```
single
multi
```

**client_id_field_status**
```
explicit
inferred
propagated
```

**client_id_confidence**
```
high
medium
low
```

---

### 1.2 Classification Engine

**program_classification**
```
A
B
C
```

**review_confidence**
```
high
medium
low
```

**quality_flags**
```
valid
warning
needs_review
missing_required
contradiction_detected
ambiguity_detected
evidence_insufficient
```

**question answer (q1-q4)**
```
ya
tidak
```

---

### 1.3 Taxonomy Engine

**mode**
```
fixed
formula
tier
matrix
```

**tier_archetype**
```
level
user_choice_variants
turnover_threshold_ladder
loss_amount_range
downline_count
parlay_team_count
parlay_lose_count
stake_amount
history_deposit_threshold
point_redemption
referral_tier
exchange_catalog
deposit_amount_tier
winstreak_count
rank_position
```
*Note: `winstreak_count` di `tier_archetype` describes **tier shape** (metadata di `taxonomy_engine.mode_block`). Ini BUKAN reward placement decision. Untuk reward placement winstreak/losestreak events, pakai `reward_engine.reward_table_block.table_type = "streak_ladder"` + `basis = "winstreak_count"` / `"losestreak_count"`. Kedua field complement, BUKAN duplicate. Lihat Governance Section 5.6.*

**turnover_basis**
```
bonus_only
deposit_only
deposit_plus_bonus
total_bet
total_loss
```

**tier_threshold_block.basis**
```
deposit
turnover
loss
downline_count
team_count
stake
point_balance
level
```

**tier_threshold_block.unit**
```
idr
percent
count
multiplier
points
```

**tier_threshold_block.ranges[].reward_unit**
```
percent
idr
multiplier
points
items
```

---

### 1.4 Period Engine

**claim_frequency**
```
once
daily
weekly
monthly
quarterly
yearly
birthday
on_trigger
per_match
per_event
lifetime
```

**validity_mode**
```
absolute
relative
unlimited
```

**validity_duration_unit**
```
hours
days
weeks
months
years
```

**distribution_day**
```
monday
tuesday
wednesday
thursday
friday
saturday
sunday
```

**calculation_period**
```
daily
weekly
monthly
quarterly
yearly
custom
```

**schedule_variant_block.variant_type**
```
day_of_week
time_of_day
date_range
weekday_weekend
custom
```

---

### 1.5 Time Window Engine

**timezone**
```
Asia/Jakarta
Asia/Makassar
Asia/Jayapura
```

**offset**
```
GMT+7
GMT+8
GMT+9
```

**reset_frequency**
```
daily
weekly
monthly
on_trigger
```

**days** (untuk claim_window_block, distribution_window_block, reset_block)
```
monday
tuesday
wednesday
thursday
friday
saturday
sunday
```

---

### 1.6 Trigger Engine

**trigger_event**
```
first_deposit
deposit
withdrawal
turnover_reached
loss_incurred
game_event
downline_activity
downline_bet_placed
apk_download
lottery_result_match
birthday_date
level_up_achieved
rank_position
parlay_outcome
random_draw
referral_signup
ticket_drawn
match_result
red_card_event
scatter_hit
multiplier_hit
goal_scored
corner_kick
```

**logic_operator**
```
AND
OR
XOR
```

**rule_type**
```
simple
compound
sequential
conditional
threshold
recurring
```

**condition_operator**
```
equals
not_equals
greater_than
greater_than_or_equal
less_than
less_than_or_equal
in_range
contains
```

**action** (primary_trigger_block.action)
```
auto_credit
manual_claim
auto_calculate
notify_user
trigger_event_window
trigger_draw
```

---

### 1.7 Claim Engine

**claim_method**
```
auto
manual_livechat
manual_whatsapp
manual_telegram
in_app_button
form_submission
cs_approval
referral_menu
loyalty_menu
event_menu
```

**channels**
```
livechat
whatsapp
telegram
facebook
website_form
apk_redemption
email
phone_call
in_app_menu
```

**claim_gate_block.claim_deadline_unit**
```
hours
days
weeks
months
```

**claim_gate_block.claim_deadline_anchor**
```
deposit
withdraw
event_result
level_up
claim
signup
birthday
prize_announcement
match_end
period_end
```

**claim_gate_block.claim_limit_period**
```
daily
weekly
monthly
yearly
per_event
per_match
lifetime
```

**claim_gate_block.claim_limit_scope**
```
per_user
per_event
per_match
per_promo
per_account
lifetime_per_user
account_wide
```

**claim_gate_block.claim_reset_frequency**
```
daily
weekly
monthly
never
on_trigger
```

**claim_gate_block.active_user_period_unit**
```
hours
days
weeks
months
```

**claim_gate_block.history_deposit_period_unit**
```
hours
days
weeks
months
```

---

### 1.8 Proof Engine

**proof_types**
```
screenshot_win
screenshot_bill
screenshot_wd
screenshot_deposit
screenshot_apk
screenshot_share
foto_ktp
foto_rekening
foto_kk
parlay_ticket
video_share
referral_link_screenshot
```

**proof_destinations**
```
livechat
whatsapp_official
telegram_official
telegram_group
facebook_group
facebook_official
in_app_upload
```

**social_proof_block.share_target_group_type**
```
own_timeline
public_group
private_group
official_group
multiple_groups
story
reel
```

**social_proof_block.proof_destination**
```
livechat
whatsapp_official
telegram_official
telegram_group
facebook_group
facebook_official
in_app_upload
```

**screenshot_proof_block.ss_targets**
```
deposit_receipt
withdrawal_receipt
win_screen
loss_screen
game_screen
bill_screen
apk_install_screen
referral_link_screen
share_post_screen
account_balance_screen
```

---

### 1.9 Payment Engine

**deposit_method**
```
bank
ewallet
pulsa
qris
crypto
all
```

**providers — bank**
```
BCA
BNI
BRI
MANDIRI
CIMB
DANAMON
PERMATA
BTN
MAYBANK
BSI
OCBC
PANIN
BTPN
MEGA
BJB
```

**providers — ewallet**
```
DANA
OVO
GOPAY
SHOPEEPAY
LINKAJA
SAKUKU
JENIUS
```

**providers — pulsa**
```
TELKOMSEL
XL
INDOSAT
TRI
SMARTFREN
AXIS
```

**providers — qris**
```
QRIS
```

**providers — crypto** (extensible)
```
USDT
BTC
ETH
```

---

### 1.10 Scope Engine

**game_domain**
```
slot
casino
live_casino
sports
sportsbook
togel
sabung_ayam
e_lottery
arcade
mixed
all
```

**game_types** (multiple per scope)
```
slot
casino_live
casino_table
sports_match
sports_parlay
togel_4d
togel_3d
togel_2d
togel_other
arcade
e_lottery
sabung_ayam
mahjong
poker
domino
fish_hunter
```

**bet_types**
```
single_bet
mix_parlay
parlay
HDP
OU
1x2
correct_score
half_time
full_time
both_team_score
total_goal
asian_handicap
european_handicap
```

**match_types**
```
FT
HT
both
```

**market_types**
```
4D
3D
2D
permainan_lainnya
colok_bebas
colok_naga
colok_jitu
shio
silang_homo
besar_kecil
genap_ganjil
all_markets
```

**platform_access**
```
web
apk
mobile
all
desktop_only
```

**geo_restriction**
```
indonesia
jakarta
sea
global
custom
```

**game_provider** (extensible — Title Case)
```
Pragmatic Play
PG Soft
Habanero
Spadegaming
Microgaming
Playtech
Evolution Gaming
Sexy Baccarat
Pretty Gaming
SBOBet
CMD368
SV388
WS168
Joker Gaming
NoLimit City
Live22
Mega888
GamePlay
Hot Game
Yggdrasil
ION Casino
SA Gaming
Big Gaming
AE Sexy
Asia Gaming
NextSpin
Slot88
```

**blacklist_block.types**
```
provider
game
bet_type
market_type
game_category
turnover_source
```

**odds_constraint_block.applies_to_bet_types**
```
single_bet
mix_parlay
HDP
OU
1x2
all_bet_types
```

**bet_configuration_block.required_market_segments**
```
sportsbook
casino
slot
live_casino
e_lottery
togel
arcade
specific_provider
specific_game
```

---

### 1.11 Reward Engine

**calculation_basis**
```
deposit
turnover
loss
win
bet
bet_amount
payout
withdraw_amount
downline_bet
downline_winlose
downline_turnover
downline_loss
level_up_reward
fixed
rank_position
stake_amount
first_deposit
event_outcome
unit_count
```

**calculation_method**
```
percentage
fixed
tiered
matrix_lookup
conditional
per_unit
random_draw
formula_multi_deduction
```

**calculation_unit**
```
percent
fixed_idr
multiplier
points
items
```

**payout_direction**
```
upfront
backend
```

**reward_type**
```
cash
bonus_credit
free_chip
free_spin
voucher
merchandise
ticket
points
discount
status_upgrade
combo
percentage_rebate
```

**voucher_kind**
```
deposit_bonus
lucky_spin_entry
event_entry
discount_code
free_play
cashback_voucher
shopping_voucher
travel_voucher
gadget_voucher
other
```

**currency** (Reference — extensible, BUKAN enum tertutup, ISO 4217)
```
IDR    (Rupiah Indonesia)
THB    (Baht Thailand)
VND    (Dong Vietnam)
MYR    (Ringgit Malaysia)
SGD    (Dolar Singapura)
USD    (Dolar Amerika)
PHP    (Peso Filipina)
KHR    (Riel Kamboja)
```

**turnover_tier_by_deposit_block.tiers[].turnover_basis**
```
bonus_only
deposit_only
deposit_plus_bonus
total_bet
total_loss
```

**reward_table_block.table_type**
```
turnover_ladder
cashback_tier
welcome_combo
level_reward
parlay_team_count_table
parlay_lose_count_table
parlay_lose_half_count_table
streak_ladder
ranking_prize_table
event_prize_table
achievement_reward
referral_tier_table
loyalty_redemption_table
```
*Note: `streak_ladder` digunakan untuk winstreak/losestreak events. Per Governance G5 + Winstreak Note, gunakan dengan `basis = "winstreak_count"` / `"losestreak_count"` dan `trigger_count_unit = "consecutive_wins"` / `"consecutive_losses"`. Nilai `winstreak_table` (legacy V.10.1) telah dihapus di V.10.2 — gunakan `streak_ladder` saja untuk semua streak events (win streak DAN lose streak).*

**reward_table_block.basis**
```
turnover
deposit
loss
win
bet
team_count
win_count
lose_count
streak_count
winstreak_count
losestreak_count
downline_count
stake_amount
rank_position
loyalty_points
```

**reward_table_block.rows[].threshold_unit**
```
idr
count
percent
points
multiplier
```

**reward_table_block.rows[].trigger_count_unit**
```
matches
days
parlay_legs
spins
events
red_cards
goals
scatter_hits
consecutive_wins
consecutive_losses
```
*Note: `consecutive_wins` / `consecutive_losses` dipakai bersama `table_type = "streak_ladder"` dan `basis = "winstreak_count"` / `"losestreak_count"` untuk winstreak/losestreak events. Per Governance Section 5.6, streak events tidak punya engine sendiri di V.10.2 — gunakan `reward_table_block` dengan kombinasi 3 field ini.*

**reward_table_block.rows[].reward_type**
```
cash
bonus_credit
free_chip
voucher
merchandise
ticket
points
combo
```

**reward_table_block.rows[].reward_unit**
```
idr
percent
items
points
multiplier
```

**reward_table_block.rows[].reward_basis**
```
fixed
stake_multiplier
deposit_multiplier
loss_percentage
ranking_position
random
```

**reward_table_block.rows[].payout_direction**
```
upfront
backend
```

**matrix_reward_block.matrix_type**
```
symbol_count_reward
stake_x_symbol
stake_x_multiplier
symbol_combination
stake_x_team_count
multiplier_x_reward
event_count_x_stake
custom
```

**matrix_reward_block.matrix_cells[].reward_basis**
```
fixed
stake_multiplier
percent_of_stake
percent_of_loss
random
```

**unit_reward_block.trigger_unit**
```
red_card
yellow_card
corner_kick
goal
scatter
multiplier_hit
free_spin
win_count
loss_count
referral_count
deposit_count
```

**unit_reward_block.value_unit**
```
idr
percent
points
items
multiplier
```

---

### 1.12 Ticket Engine

**ticket_block.ticket_source**
```
deposit_amount
play_count
turnover_threshold
manual_grant
event_participation
referral_count
loyalty_redemption
```

**ticket_block.validity_duration_unit**
```
hours
days
weeks
months
```

**ticket_block.ticket_payment_method_exclusion**
```
ewallet
pulsa
qris
crypto
specific_bank
specific_ewallet
```

**draw_block.draw_type**
```
random
fixed_winner
top_n
lottery_match
weighted_random
participation_based
ranking_based
```

**draw_block.draw_frequency**
```
once
daily
weekly
monthly
quarterly
yearly
on_event_end
on_threshold_reached
```

---

### 1.13 Loyalty Engine

**mechanism_block.point_name**
```
LP
EXP
XP
COIN
GEM
TOKEN
STAR
```

**mechanism_block.earning_rule**
```
turnover_based
bet_based
deposit_based
loss_based
event_based
manual_grant
```

**mechanism_block.loyalty_mode**
```
exp_store
level_up
both
```

**mechanism_block.reset_period**
```
never
daily
weekly
monthly
quarterly
yearly
on_promotion
```

**exchange_block.exchange_groups[].claim_limit_period**
```
daily
weekly
monthly
yearly
lifetime
per_event
unlimited
```

**exchange_block.exchange_groups[].items[].reward_type**
```
cash
bonus_credit
free_chip
voucher
merchandise
ticket
status_upgrade
discount
```

**exchange_block.exchange_groups[].items[].voucher_kind**
```
deposit_bonus
lucky_spin_entry
event_entry
discount_code
free_play
cashback_voucher
shopping_voucher
travel_voucher
gadget_voucher
other
```

**tier_block.tier_system** (extensible — per brand)
```
Bronze
Silver
Gold
Platinum
Diamond
Starter
VIP
Elite
Legend
Member
Pemula
Pejuang
Master
Sultan
Crazy Rich
```

---

### 1.14 Referral Engine

**program_block.referral_type**
```
single_tier
multi_tier
lifetime
one_time
recurring
downline_loss_based
downline_bet_based
downline_winlose_based
```

**program_block.commission_basis**
```
downline_bet
downline_loss
downline_winlose
downline_turnover
first_deposit
net_winlose
referral_signup
```

**program_block.commission_unit**
```
percent
fixed_idr
multiplier
```

**program_block.downline_period_unit**
```
hours
days
weeks
months
```

**program_block.eligible_game_types**
```
slot
casino
live_casino
sports
togel
arcade
e_lottery
sabung_ayam
all
```

**commission_rule_block.rules[].rule_id** (free-text, naming convention: snake_case)
```
(no fixed enum — free-text identifier, recommended format: {game_type}_{tier_index})
Examples: togel_4d, togel_3d, slot_tier_1, sports_parlay_main
```

**commission_rule_block.rules[].game_type**
```
slot
casino
live_casino
sports
togel
arcade
e_lottery
sabung_ayam
mixed
all
```

**commission_rule_block.rules[].basis**
```
downline_bet
downline_loss
downline_winlose
downline_turnover
first_deposit
net_winlose
```

**commission_rule_block.rules[].rate_unit**
```
percent
fixed_idr
multiplier
```

**commission_rule_block.rules[].deposit_basis_anchor**
```
first_deposit
total_deposit
period_deposit
none
```

**deduction_block.deductions[].deduction_type**
```
commission
cashback
admin_fee
tax
bonus_received
fee_other
```

**distribution_block.distribution_frequency**
```
daily
weekly
monthly
quarterly
yearly
on_request
```

---

### 1.15 Result Event Engine

**result_match_block.result_source**
```
togel
lottery
sports_match
game_event
casino_result
slot_event
```

**result_match_block.result_source_markets**
```
Sydney
HK
Singapore
Macau
Bullseye
PCSO
Magnum4D
all_togel_markets
```

**result_match_block.match_target**
```
account_number
member_id
phone_number
username
birthdate
bank_account_last_digits
custom_input
```

**result_match_block.match_position**
```
last_4
last_3
last_2
first_4
first_3
exact
middle
any_position
```

**result_match_block.match_logic**
```
exact
partial
any_order
contains
prefix
suffix
range_match
```

**prize_block.prizes[].prize_tier**
```
main
consolation
tier_1
tier_2
tier_3
tier_4
tier_5
participation
grand_prize
runner_up
```

---

### 1.16 Fulfillment Engine

**physical_reward_block.shipping_period_anchor**
```
prize_announcement
claim_approval
event_end
period_end
month_end
custom
```

**physical_reward_block.shipping_period_unit**
```
hours
days
weeks
months
```

**physical_reward_block.shipping_method**
```
internal_logistics
third_party_courier
pickup_at_office
digital_delivery
mail
specific_courier
```

**physical_reward_block.tax_borne_by**
```
operator
member
shared
```

**physical_reward_block.recipient_data_required** *(BARU V.10.2 — added 15 Mei 2026)*
```
full_name
address
phone
email
ktp_id
bank_account
```
*Note: Array/multiselect — daftar data penerima yang dibutuhkan untuk pengiriman hadiah fisik. Tambahan enum values seperti `kk_id`, `npwp` ditahan dulu sampai ada evidence promo nyata yang membutuhkan (per Governance G4 promotion workflow).*

---

### 1.17 Variant Engine

**items_block.subcategories[].calculation_basis**
```
(reuse Section 1.11 reward_engine.calculation_basis enum)
```

**items_block.subcategories[].calculation_method**
```
(reuse Section 1.11 reward_engine.calculation_method enum)
```

**items_block.subcategories[].calculation_unit**
```
(reuse Section 1.11 reward_engine.calculation_unit enum)
```

**items_block.subcategories[].claim_gate_block.* enums**
```
(reuse Section 1.7 claim_engine.claim_gate_block enums)
```

**items_block.subcategories[].turnover_rule_format**
```
multiplier
min_rupiah
both
none
```

**items_block.subcategories[].reward_type**
```
(reuse Section 1.11 reward_engine.reward_type enum)
```

**items_block.subcategories[].payout_direction**
```
upfront
backend
```

**items_block.subcategories[].voucher_kind**
```
(reuse Section 1.11 reward_engine.voucher_kind enum)
```

**items_block.subcategories[].game_types**
```
(reuse Section 1.10 scope_engine.game_types enum)
```

**items_block.subcategories[].bet_types**
```
(reuse Section 1.10 scope_engine.bet_types enum)
```

**items_block.subcategories[].match_types**
```
(reuse Section 1.10 scope_engine.match_types enum)
```

**items_block.subcategories[].market_types**
```
(reuse Section 1.10 scope_engine.market_types enum)
```

---

### 1.18 Dependency Engine

**stacking_block.stacking_policy**
```
no_stacking
stack_with_whitelist
stack_freely
conditional_stack
```

---

### 1.19 Invalidation Engine

**void_conditions_block[].condition_type**
```
fraud
violation
operational
technical
eligibility
timing
behavior
```

**void_conditions_block[].scope**
```
bonus_only
winnings_only
full_balance
per_promo
account_wide
deposit_amount
```

**void_trigger** (jenis pelanggaran)
```
bonus_hunter
safety_bet
invest
ip_duplicate
data_duplicate
deposit_fraud
hold_freespin
multi_accounting
self_referral
account_change
claim_timeout
wrong_bank_info
screenshot_missing
game_category_violation
cashout_partial
late_share
fake_proof
manipulated_screenshot
```

**penalty_block.void_action**
```
bonus_cancel
full_balance_void
winnings_void
bonus_and_winnings_void
account_suspend
permanent_ban
```

**penalty_block.penalty_type**
```
bonus_forfeit
winnings_forfeit
balance_forfeit
full_forfeit
account_restriction
```

**penalty_block.penalty_scope**
```
current_promo_only
all_active_promos
all_account_balance
future_participation
permanent
```

---

### 1.20 Readiness Engine

**state_block.state**
```
draft
ready
published
rejected
deprecated
```

**validation_block.status**
```
draft
ready
needs_review
rejected
passed
warning
```

**observability_block.ambiguity_flags** (free-text descriptive, no fixed enum)
```
Recommended naming: snake_case descriptor
Examples: min_withdraw_ambiguous, reward_amount_unclear, claim_method_implicit
```

**observability_block.contradiction_flags**
```
(same as ambiguity_flags — descriptive snake_case)
Examples: deposit_vs_withdraw_conflict, percentage_vs_fixed_conflict
```

---

### 1.21 Reasoning Engine

**intent_block.primary_action**
```
deposit_to_bonus
withdraw_to_bonus
lose_to_cashback
bet_to_rollingan
refer_to_commission
redeem_to_reward
turnover_to_rank
milestone_to_merchandise
app_install_to_credit
birthday_to_bonus
result_match_to_prize
level_up_to_reward
event_participation_to_prize
referral_commission_earning
```

**intent_block.reward_nature**
```
monetary
physical_goods
credit_game
access_right
discount
status_upgrade
commission
points
```

**intent_block.distribution_path**
```
direct_to_balance
to_bonus_wallet
physical_shipping
manual_disbursement
apk_redemption
event_drawing
ticket_drawing
loyalty_exchange
referral_commission_credit
```

**intent_block.value_shape**
```
percentage_of_base
fixed_amount
tiered_escalating
matrix_lookup
random_draw
ladder_milestone
exchange_rate_based
per_unit_accumulative
multi_deduction_formula
```

**selection_block.mechanic_type**
```
eligibility
trigger
calculation
reward
claim
control
invalidator
distribution
turnover
dependency
intent
scope
proof
time_window
fulfillment
result_match
referral
loyalty
ticket
```

---

### 1.22 Mechanics Engine

**source_block.source**
```
llm_text
llm_image
llm_multimodal
manual
```

---

### 1.23 Projection Engine

**summary_block.main_reward_unit**
```
(reuse reward_engine.calculation_unit enum)
```

**summary_block.payout_direction**
```
(reuse reward_engine.payout_direction enum)
```

**summary_block.turnover_basis**
```
(reuse taxonomy_engine.turnover_basis enum)
```

**summary_block._summary_skipped_reason**
```
insufficient_data
record_not_promo
extraction_error
manual_skip
ambiguous_evidence
classification_failed
```

**intent_summary_block.intent_category**
```
acquisition
retention
reactivation
engagement
virality
upsell
brand_awareness
member_reward
```

**intent_summary_block.target_segment**
```
new_member
existing_member
vip
all_member
high_roller
casual_player
sports_bettor
slot_player
togel_player
referrer
churned_member
```

---

### 1.24 Risk Engine

**level_block.promo_risk_level**
```
low
medium
high
critical
```

---

### 1.25 Meta Engine

**source_block.extraction_source**
```
plain_text
html
image
pdf
multimodal
```

**source_block.source_type**
```
text_paste
website
image_upload
pdf_upload
api_import
```

**schema_block.status** (lifecycle)
```
draft
candidate_locked
review_pending
locked
deprecated
```

**schema_block.amendment_type**
```
patch
minor_substantive
major_minor_version
major_schema_expansion
major_breaking
```

**schema_block.record_type**
```
promo
site_policy
informational
```

**unmodeled_evidence_block.items[].review_status**
```
pending
under_review
promoted
rejected
permanent
```

**unmodeled_evidence_block.items[].suggested_engine**
```
(reuse list of 26 engines — see engine list di skeleton)
```

---

### 1.26 Field Status & Confidence

**_field_status values**
```
explicit
inferred
derived
propagated
not_stated
not_applicable
```

---

## BAGIAN 2 — NULLABLE FIELDS

Field berikut boleh bernilai `null`. Null bukan error — artinya data tidak tersedia, tidak berlaku, atau tidak disebutkan di promo.

| Field | Kenapa boleh null |
|-------|-------------------|
| `taxonomy_engine.mode_block.tier_archetype` | Hanya relevan kalau mode = tier |
| `taxonomy_engine.logic_block.turnover_basis` | Tidak semua promo punya turnover |
| `period_engine.validity_block.valid_from` | Tidak semua promo punya tanggal mulai |
| `period_engine.validity_block.valid_until` | Tidak semua promo punya batas waktu |
| `period_engine.validity_block.validity_duration_value` | Hanya relevan kalau validity_mode = relative |
| `reward_engine.requirement_block.min_deposit` | Tidak semua promo ada syarat deposit |
| `reward_engine.calculation_value` | Tidak semua promo dihitung persentase |
| `reward_engine.max_reward` | Tidak semua promo punya batas maksimal |
| `reward_engine.voucher_kind` | Hanya relevan kalau reward_type = voucher |
| `claim_engine.claim_gate_block.min_withdraw_for_claim` | Hanya relevan untuk WD-gated promo |
| `claim_engine.claim_gate_block.min_deposit_for_claim` | Hanya relevan untuk deposit-gated promo |
| `claim_engine.claim_gate_block.active_user_min_turnover` | Hanya relevan kalau requires_active_user_id = true |
| `claim_engine.claim_gate_block.min_history_deposit_amount` | Hanya relevan kalau requires_history_deposit = true |
| `claim_engine.claim_gate_block.claim_limit_per_period` | Hanya kalau ada batas klaim |
| `payment_engine.deposit_block.deposit_rate` | Hanya relevan kalau ada rate khusus |
| `classification_engine.meta_block.latency_ms` | Tidak selalu dicatat |
| `variant_engine.summary_block.expected_count` | Tidak selalu diketahui di awal |
| `variant_engine.items_block.subcategories[].claim_gate_block.min_withdraw_for_claim` | Hanya relevan kalau WD threshold beda per-varian |
| `dependency_engine.stacking_block.max_concurrent` | Tidak semua promo define batas ini |
| `meta_engine.extraction_block.client_id_source` | Bisa tidak ada kalau client sudah diketahui |
| `ticket_engine.ticket_block.max_ticket_per_claim` | Tidak semua promo punya batas |
| `ticket_engine.ticket_block.max_ticket_per_day` | Tidak semua promo punya batas harian |
| `referral_engine.program_block.min_downline_count` | Tidak semua program ada minimum |
| `referral_engine.program_block.min_downline_turnover` | Tidak semua program ada syarat turnover |
| `result_event_engine.result_match_block.minimum_bet_amount` | Tidak semua prize butuh bet |
| `result_event_engine.prize_block.prizes[].requires_bet_on_match_target` | Per-prize eligibility |
| `fulfillment_engine.physical_reward_block.shipping_period_value` | Hanya relevan untuk physical reward |
| `reward_engine.turnover_tier_by_deposit_block.tiers[].deposit_threshold_max` | Tier terakhir biasanya unlimited |
| `reward_engine.matrix_reward_block.matrix_cells[].max_reward` | Tidak semua sel matrix ada batas |
| `reward_engine.unit_reward_block.max_units_per_claim` | Tidak semua per-unit reward dibatasi |

---

## BAGIAN 3 — NUMERIC RANGES

| Field | Tipe | Rentang | Catatan |
|-------|------|---------|---------|
| `ai_confidence` values | float | 0.0 – 1.0 | 1.0 = sangat yakin, 0.0 = tidak yakin sama sekali |
| `classification_engine.meta_block.evidence_count` | integer | 0 – tak terbatas | Jumlah bukti yang ditemukan |
| `reward_engine.calculation_value` | float | 0 – 100 | Untuk persentase. Untuk fixed, tidak ada batas |
| `reward_engine.max_reward` | integer | 0 – tak terbatas | Dalam satuan rupiah |
| `reward_engine.requirement_block.min_deposit` | integer | 0 – tak terbatas | Dalam satuan rupiah |
| `claim_engine.claim_gate_block.min_withdraw_for_claim` | integer | 0 – tak terbatas | Dalam satuan rupiah |
| `claim_engine.claim_gate_block.min_deposit_for_claim` | integer | 0 – tak terbatas | Dalam satuan rupiah |
| `claim_engine.claim_gate_block.claim_deadline_value` | integer | 1 – tak terbatas | Minimal 1 kalau diisi |
| `claim_engine.claim_gate_block.claim_limit_per_period` | integer | 1 – tak terbatas | Minimal 1 kalau diisi |
| `dependency_engine.stacking_block.max_concurrent` | integer | 1 – tak terbatas | Minimal 1 kalau diisi |
| `classification_engine.meta_block.latency_ms` | integer | 0 – tak terbatas | Dalam milidetik |
| `meta_engine.extraction_block.ambiguous_blacklists` | integer | 0 – tak terbatas | Jumlah blacklist ambigu |
| `referral_engine.program_block.commission_rate` | float | 0 – 100 | Untuk percent. Untuk fixed_idr, tidak ada batas atas |
| `referral_engine.program_block.min_downline_count` | integer | 1 – tak terbatas | Minimal 1 downline |
| `result_event_engine.prize_block.prizes[].prize_amount` | integer | 0 – tak terbatas | Dalam satuan rupiah |
| `ticket_engine.ticket_block.deposit_per_ticket` | integer | 0 – tak terbatas | Dalam satuan rupiah |
| `reward_engine.unit_reward_block.value_per_unit` | integer / float | 0 – tak terbatas | Tergantung value_unit |
| `meta_engine.unmodeled_evidence_block.items[].occurrence_count` | integer | 0 – tak terbatas | Frekuensi kemunculan pattern |

**Threshold ai_confidence untuk trigger pertanyaan ke Admin:** di bawah 0.7 (sementara — belum diuji final)

---

## BAGIAN 4 — REFERENCE MAPS

Pemetaan kode ke label tampilan. Dipakai untuk UI dan komunikasi tim — bukan nilai operasional.

### program_classification → nama program

| Kode | Nama Tampilan |
|------|---------------|
| `A` | Program Reward |
| `B` | Program Event |
| `C` | Aturan Sistem |

### state → label status

| Kode | Label Tampilan |
|------|----------------|
| `draft` | Data Awal |
| `ready` | Siap Tayang |
| `published` | Sudah Tayang |
| `rejected` | Ditolak |
| `deprecated` | Sudah Tidak Berlaku |

### schema_block.status (lifecycle) → label

| Kode | Label |
|------|-------|
| `draft` | Draft Awal |
| `candidate_locked` | Kandidat Terkunci |
| `review_pending` | Menunggu Review |
| `locked` | Final Terkunci |
| `deprecated` | Sudah Tidak Berlaku |

### record_type → label

| Kode | Label | Behavior |
|------|-------|----------|
| `promo` | Promo Standard | Tampil di promo listing |
| `site_policy` | Aturan Sistem Brand | Referensi, tidak tampil di promo list |
| `informational` | Konten Informasi | Future use |

### promo_risk_level → label risiko

| Kode | Label | Contoh |
|------|-------|--------|
| `low` | Risiko Rendah | Merchandise, freechip kecil |
| `medium` | Risiko Sedang | Cashback mingguan |
| `high` | Risiko Tinggi | Lucky draw hadiah besar |
| `critical` | Risiko Kritis | Lucky draw mobil, hadiah miliaran |

### payout_direction → label pembayaran

| Kode | Label |
|------|-------|
| `upfront` | Dibayar di Depan |
| `backend` | Dibayar Setelah Main |

### amendment_type → label perubahan

| Kode | Label |
|------|-------|
| `patch` | Patch Kecil |
| `minor_substantive` | Update Minor |
| `major_minor_version` | Update Major (Engine Baru) |
| `major_schema_expansion` | Ekspansi Schema Major |
| `major_breaking` | Breaking Change |

### prize_tier → label

| Kode | Label |
|------|-------|
| `main` | Hadiah Utama |
| `consolation` | Hadiah Hiburan |
| `grand_prize` | Grand Prize |
| `participation` | Hadiah Partisipasi |
| `tier_1` – `tier_5` | Peringkat 1-5 |

### mechanic_type → label mekanik

| Kode | Label |
|------|-------|
| `eligibility` | Syarat Klaim |
| `trigger` | Pemicu |
| `calculation` | Perhitungan |
| `reward` | Reward |
| `claim` | Cara Klaim |
| `control` | Batas & Kontrol |
| `invalidator` | Pembatalan |
| `distribution` | Distribusi |
| `turnover` | Turnover |
| `dependency` | Ketergantungan |
| `intent` | Tujuan Promo |
| `scope` | Cakupan Game |
| `proof` | Bukti |
| `time_window` | Jendela Waktu |
| `fulfillment` | Pemenuhan Hadiah |
| `result_match` | Pencocokan Hasil |
| `referral` | Referral |
| `loyalty` | Loyalty |
| `ticket` | Tiket |

---

## BAGIAN 5 — ATURAN PENAMAAN NILAI BARU

1. Hanya **habe_raja** yang boleh menambah nilai baru ke enum registry ini
2. **System enum values** = `snake_case`. Contoh: `deposit_bonus`, `first_deposit`, `loss_incurred`
3. **Financial providers** (bank, ewallet, pulsa) = `UPPERCASE`. Contoh: `DANA`, `BCA`, `TELKOMSEL`
4. **Game providers** = Official display name / Title Case. Contoh: `Pragmatic Play`, `PG Soft`, `Evolution Gaming`
5. **Currency** = ISO 4217 tiga huruf. Contoh: `IDR`, `THB`, `USD`
6. Tidak boleh ada alias — satu konsep, satu nilai
7. Kalau ada nilai yang tidak cocok dengan yang ada → eskalasi ke habe_raja, **jangan ngarang sendiri**
8. Extensible lists (game_provider, tier_name, market, brand) boleh ditambah sesuai kebutuhan brand baru — tetap dengan approval
9. **Per Governance G4:** Nilai yang belum punya rumah → masuk `meta_engine.unmodeled_evidence_block` dulu, BUKAN paksa masuk enum

---

## BAGIAN 6 — ENUM YANG REUSE (DRY)

Enum berikut **dipakai di multiple lokasi** dengan vocabulary yang sama (jangan duplicate definition):

| Enum Group | Master Location | Reused at |
|------------|-----------------|-----------|
| `calculation_basis` | reward_engine | variant_engine.subcategories[] |
| `calculation_method` | reward_engine | variant_engine.subcategories[] |
| `calculation_unit` | reward_engine | variant_engine.subcategories[] |
| `payout_direction` | reward_engine | variant_engine.subcategories[], projection_engine |
| `reward_type` | reward_engine | variant_engine.subcategories[], loyalty_engine.exchange_block.items[], reward_table_block.rows[] |
| `voucher_kind` | reward_engine | variant_engine.subcategories[], loyalty_engine.exchange_block.items[] |
| `game_types` | scope_engine | variant_engine.subcategories[], referral_engine.program_block, projection_engine |
| `bet_types` | scope_engine | variant_engine.subcategories[] |
| `match_types` | scope_engine | variant_engine.subcategories[] |
| `market_types` | scope_engine | variant_engine.subcategories[] |
| `turnover_basis` | taxonomy_engine | reward_engine.turnover_tier_by_deposit_block.tiers[], projection_engine |
| `claim_frequency` | period_engine | projection_engine, referral_engine.distribution_block |
| `claim_gate_block.*` enums | claim_engine | variant_engine.subcategories[].claim_gate_block |
| `days` | period_engine | time_window_engine (claim_window/distribution_window/reset_block) |

**Aturan:** Kalau di skeleton ada field reuse enum, F3 wajib reference master location, BUKAN re-define dengan vocabulary beda.

---

## CHANGELOG

### V.10.1 → V.10.2 (15 Mei 2026)

**Amendment type:** `major_schema_expansion`
**Backward compatibility:** Strictly additive — semua enum V.10.1 tetap berlaku.

#### Penambahan section baru:

- **Section 1.7 (extended)** — Claim Engine: 7 enum baru untuk claim_gate_block (claim_deadline_anchor, claim_limit_scope, claim_limit_period, dst)
- **Section 1.12 (NEW)** — Ticket Engine: 5 enum (ticket_source, draw_type, draw_frequency, dst)
- **Section 1.14 (NEW)** — Referral Engine: 10 enum (referral_type, commission_basis, deduction_type, dst)
- **Section 1.15 (NEW)** — Result Event Engine: 6 enum (result_source, match_target, match_position, match_logic, prize_tier, result_source_markets)
- **Section 1.16 (NEW)** — Fulfillment Engine: 5 enum (shipping_period_anchor, shipping_method, tax_borne_by, recipient_data_required, dst)
- **Section 1.25 (extended)** — Meta Engine: 4 enum baru (status lifecycle, amendment_type, record_type, review_status)

#### Penambahan enum di section existing:

- **Section 1.1** Identity Engine — `promo_type`: tambah 6 value (event_sports_specific, withdraw_bonus, apk_signup_bonus, weekend_special, tier_upgrade_event, freespin_bonus); `target_user`: tambah `referrer`, `downline`
- **Section 1.3** Taxonomy Engine — `tier_archetype`: tambah 4 value (parlay_lose_count, deposit_amount_tier, winstreak_count, rank_position); NEW `tier_threshold_block.basis/unit`
- **Section 1.4** Period Engine — `claim_frequency`: tambah 5 value (quarterly, yearly, per_match, per_event, lifetime); NEW `schedule_variant_block.variant_type`
- **Section 1.6** Trigger Engine — `trigger_event`: tambah 10 value (downline_bet_placed, ticket_drawn, match_result, red_card_event, scatter_hit, multiplier_hit, goal_scored, corner_kick, dst); NEW `action` enum
- **Section 1.10** Scope Engine — NEW enums: `game_types` (multi-value), `bet_types`, `match_types`, `market_types`, `odds_constraint_block.applies_to_bet_types`, `bet_configuration_block.required_market_segments`, `blacklist_block.types`; extended `game_provider` list (16 → 27)
- **Section 1.11** Reward Engine — `calculation_basis`: tambah 8 value (bet_amount, withdraw_amount, downline_bet, downline_turnover, downline_loss, first_deposit, event_outcome, unit_count); `calculation_method`: tambah 3 value (per_unit, random_draw, formula_multi_deduction); `reward_type`: extended; NEW enum sections (reward_table_block, matrix_reward_block, unit_reward_block, turnover_tier_by_deposit_block)
- **Section 1.13** Loyalty Engine — NEW typed exchange_block enums; `point_name`: tambah TOKEN, STAR; `tier_system`: extended
- **Section 1.19** Invalidation Engine — NEW void_conditions_block typed (condition_type, scope); `void_trigger`: tambah 3 value
- **Section 1.20** Readiness Engine — `state`: tambah `deprecated`; NEW `validation_status.passed`, `warning`
- **Section 1.21** Reasoning Engine — `primary_action`: tambah 5 value (withdraw_to_bonus, result_match_to_prize, level_up_to_reward, event_participation_to_prize, referral_commission_earning); `value_shape`: tambah `per_unit_accumulative`, `multi_deduction_formula`; `mechanic_type`: extended

#### Penambahan reference maps:

- `record_type` → label (3 values + behavior)
- `amendment_type` → label (5 values)
- `prize_tier` → label
- `schema_block.status` (lifecycle) → label (5 values)

#### Penambahan governance constraints:

- Per **Governance Rule G4**: enum yang belum punya rumah → masuk `unmodeled_evidence_block`, bukan paksa ke enum existing
- Per **Governance Rule G11**: enum dipakai sebagai vocabulary validasi, BUKAN keyword matcher di extractor
- Per **Governance Rule G9**: `mechanics_engine.mechanic_type` enum extended, tapi mechanics_engine = AUXILIARY (bukan source of truth)

#### Yang TIDAK berubah:

- Semua enum existing V.10.1 (Section 1.1 - 1.21 di V.10.1) **tetap berlaku 100%** di V.10.2
- Format penamaan (snake_case / UPPERCASE / Title Case) **tidak berubah**
- Nullable rules **extended**, tidak ada yang dihapus
- Numeric ranges **extended**, tidak ada yang dihapus
- Reference maps **extended**, tidak ada yang dihapus

#### Catatan migration:

- V.10.1 records yang gak punya `record_type` → default `"promo"`
- V.10.1 records yang punya `reward_engine.requirement_block.min_withdraw` → migrate ke `claim_engine.claim_gate_block.min_withdraw_for_claim`
- V.10.1 enum value yang masih dipakai → tidak perlu di-migrate (backward compat)

**Approved by:** Habe Raja (Fux), WOLFGANK
**Date:** 15 Mei 2026

---

## DOCUMENT METADATA

| Field | Value |
|-------|-------|
| schema_name | PKB_Wolfbrain |
| schema_version | V.10.2 |
| status | candidate_locked |
| amendment_type | major_schema_expansion |
| document_type | Enum Registry |
| companion | PKB_Wolfbrain_V10_2_skeleton.json + V10_2_Governance_Rules.md |
| next_step | F4 Form Mapping V.10.2 |

---

*PKB_Wolfbrain | File 3 of 4 | Enum Registry V.10.2 | 15 Mei 2026 | Habe Raja*
*Authority: Vocabulary lock untuk extractor + validator + Form Wizard. Conflict: Governance Rules > Skeleton JSON > Enum Registry > Code.*
*Status: candidate_locked — next phase F4 Form Mapping.*
