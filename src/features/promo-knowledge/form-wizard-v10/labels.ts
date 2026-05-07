/**
 * V.10.1 Form Wizard — UI label dictionaries.
 * Keys = canonical stored values (F3). Values = human Bahasa Indonesia.
 * NOT a schema. UI display only.
 */

export const L_PROMO_TYPE: Record<string, string> = {
  welcome_bonus: "Bonus Selamat Datang",
  deposit_bonus: "Bonus Deposit",
  new_member_bonus: "Bonus Member Baru",
  cashback: "Cashback",
  rollingan: "Rollingan",
  referral: "Referral",
  event_turnover_ladder: "Event Turnover Ladder",
  event_ranking: "Event Ranking",
  lucky_draw: "Lucky Draw",
  lucky_spin: "Lucky Spin",
  level_up: "Level Up",
  loyalty_point: "Poin Loyalitas",
  merchandise: "Merchandise",
  freechip: "Freechip",
  parlay_protection: "Parlay Protection",
  birthday_bonus: "Bonus Ulang Tahun",
  extra_withdraw: "Extra Withdraw",
  payment_discount: "Diskon Pembayaran",
  mystery_number: "Mystery Number",
  event_slot_specific: "Event Slot Specific",
  freespin_bonus: "Freespin Bonus",
};

export const L_TARGET_USER: Record<string, string> = {
  new_member: "Member Baru",
  existing_member: "Member Lama",
  vip: "VIP",
  all_member: "Semua Member",
};

export const L_PROMO_MODE: Record<string, string> = {
  single: "Single (satu varian)",
  multi: "Multi (banyak varian)",
};

export const L_PLATFORM_ACCESS: Record<string, string> = {
  web: "Web",
  apk: "APK",
  mobile: "Mobile",
  all: "Semua",
};

export const L_GEO: Record<string, string> = {
  indonesia: "Indonesia",
  jakarta: "Jakarta",
  sea: "Asia Tenggara",
  global: "Global",
};

export const L_GAME_DOMAIN: Record<string, string> = {
  slot: "Slot",
  casino: "Casino",
  live_casino: "Live Casino",
  sports: "Sports",
  sportsbook: "Sportsbook",
  togel: "Togel",
  sabung_ayam: "Sabung Ayam",
  e_lottery: "E-Lottery",
  arcade: "Arcade",
  mixed: "Campuran",
  all: "Semua",
};

export const L_RISK: Record<string, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
  critical: "Kritis",
};

export const L_TRIGGER_EVENT: Record<string, string> = {
  first_deposit: "Deposit Pertama",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  turnover_reached: "Turnover Tercapai",
  loss_incurred: "Mengalami Kerugian",
  game_event: "Event di Game",
  downline_activity: "Aktivitas Downline",
  birthday_date: "Tanggal Ulang Tahun",
  level_up_achieved: "Level Up Tercapai",
  rank_position: "Posisi Ranking",
  parlay_outcome: "Hasil Parlay",
  random_draw: "Random Draw",
  referral_signup: "Pendaftaran Referral",
  apk_download: "Download APK",
  lottery_result_match: "Hasil Lottery Cocok",
};

export const L_LOGIC: Record<string, string> = {
  AND: "Semua harus terpenuhi (AND)",
  OR: "Salah satu cukup (OR)",
  XOR: "Hanya salah satu (XOR)",
};

export const L_VALIDITY_MODE: Record<string, string> = {
  absolute: "Tanggal Tetap (absolute)",
  relative: "Relatif Setelah Klaim",
};

export const L_DURATION_UNIT: Record<string, string> = {
  hours: "Jam",
  days: "Hari",
  weeks: "Minggu",
  months: "Bulan",
};

export const L_CLAIM_FREQUENCY: Record<string, string> = {
  once: "Sekali",
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  birthday: "Ulang Tahun",
  on_trigger: "Saat Trigger",
};

export const L_DAY: Record<string, string> = {
  monday: "Senin", tuesday: "Selasa", wednesday: "Rabu", thursday: "Kamis",
  friday: "Jumat", saturday: "Sabtu", sunday: "Minggu",
};

export const L_RESET_FREQ: Record<string, string> = {
  daily: "Harian", weekly: "Mingguan", monthly: "Bulanan", on_trigger: "Saat Trigger",
};

export const L_TAXONOMY_MODE: Record<string, string> = {
  fixed: "Fixed", formula: "Formula", tier: "Tier", matrix: "Matrix",
};

export const L_TIER_ARCHETYPE: Record<string, string> = {
  level: "Level",
  user_choice_variants: "Pilihan User (varian)",
  turnover_threshold_ladder: "Tangga Turnover",
  loss_amount_range: "Range Loss",
  downline_count: "Jumlah Downline",
  parlay_team_count: "Jumlah Tim Parlay",
  stake_amount: "Nilai Stake",
  history_deposit_threshold: "History Deposit",
  point_redemption: "Penukaran Poin",
  referral_tier: "Tier Referral",
  exchange_catalog: "Katalog Penukaran",
};

export const L_REWARD_TYPE: Record<string, string> = {
  physical: "Fisik",
  cash: "Cash",
  credit_game: "Kredit Game",
  voucher: "Voucher",
  ticket: "Ticket",
  lucky_spin: "Lucky Spin",
  discount: "Diskon",
  freespin: "Freespin",
  combo: "Kombo",
};

export const L_VOUCHER_KIND: Record<string, string> = {
  deposit_bonus: "Voucher Bonus Deposit",
  lucky_spin_entry: "Tiket Lucky Spin",
  event_entry: "Tiket Event",
  discount_code: "Kode Diskon",
  free_play: "Free Play",
  cashback_voucher: "Voucher Cashback",
  other: "Lainnya",
};

export const L_PAYOUT_DIR: Record<string, string> = {
  upfront: "Dibayar di Depan", backend: "Dibayar di Akhir (Backend)",
};

export const L_CALC_BASIS: Record<string, string> = {
  deposit: "Deposit",
  turnover: "Turnover",
  loss: "Loss",
  win: "Win",
  bet: "Bet",
  payout: "Payout",
  downline_winlose: "Downline Win/Lose",
  level_up_reward: "Level Up Reward",
  fixed: "Fixed",
  rank_position: "Posisi Ranking",
  stake_amount: "Nilai Stake",
};

export const L_CALC_METHOD: Record<string, string> = {
  percentage: "Persentase",
  fixed: "Fixed Amount",
  tiered: "Tier Table",
  matrix_lookup: "Matrix",
  conditional: "Kondisional",
};

export const L_CALC_UNIT: Record<string, string> = {
  percent: "Persen (%)",
  fixed_idr: "IDR",
};

export const L_TURNOVER_BASIS: Record<string, string> = {
  bonus_only: "Bonus Saja",
  deposit_only: "Deposit Saja",
  deposit_plus_bonus: "Deposit + Bonus",
  total_bet: "Total Bet",
  total_loss: "Total Loss",
};

export const L_DEPOSIT_METHOD: Record<string, string> = {
  bank: "Bank", ewallet: "E-Wallet", pulsa: "Pulsa",
  qris: "QRIS", crypto: "Crypto", all: "Semua",
};

export const L_CLAIM_METHOD: Record<string, string> = {
  auto: "Otomatis",
  manual_livechat: "Manual via Livechat",
  manual_whatsapp: "Manual via WhatsApp",
  manual_telegram: "Manual via Telegram",
  in_app_button: "Tombol di Aplikasi",
  form_submission: "Submit Form",
  cs_approval: "Approval CS",
};

export const L_CHANNEL: Record<string, string> = {
  livechat: "Livechat", whatsapp: "WhatsApp", telegram: "Telegram",
  facebook: "Facebook", website_form: "Form Website",
  apk_redemption: "APK Redemption", email: "Email", phone_call: "Telepon",
};

export const L_PROOF_TYPE: Record<string, string> = {
  screenshot_win: "Screenshot Kemenangan",
  screenshot_bill: "Screenshot Tagihan",
  screenshot_wd: "Screenshot Withdrawal",
  screenshot_deposit: "Screenshot Deposit",
  screenshot_apk: "Screenshot APK",
  foto_ktp: "Foto KTP",
  foto_rekening: "Foto Rekening",
  parlay_ticket: "Tiket Parlay",
};

export const L_PROOF_DEST: Record<string, string> = {
  livechat: "Livechat",
  whatsapp_official: "WhatsApp Official",
  telegram_official: "Telegram Official",
  telegram_group: "Telegram Group",
  facebook_group: "Facebook Group",
  facebook_official: "Facebook Official",
};

export const L_SOCIAL_PLATFORM: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram",
  telegram: "Telegram", twitter: "Twitter / X",
};

export const L_POINT_NAME: Record<string, string> = {
  LP: "LP", EXP: "EXP", XP: "XP", COIN: "COIN", GEM: "GEM",
};

export const L_STACKING: Record<string, string> = {
  no_stacking: "Tidak Bisa Digabung",
  stack_with_whitelist: "Hanya dengan Whitelist",
  stack_freely: "Bebas Digabung",
  conditional_stack: "Kondisional",
};

export const L_VOID_ACTION: Record<string, string> = {
  bonus_cancel: "Batalkan Bonus",
  full_balance_void: "Hanguskan Semua Saldo",
  winnings_void: "Hanguskan Kemenangan",
  bonus_and_winnings_void: "Hanguskan Bonus + Kemenangan",
  account_suspend: "Suspend Akun",
  permanent_ban: "Ban Permanen",
};

export const L_PENALTY_TYPE: Record<string, string> = {
  bonus_forfeit: "Hangus Bonus",
  winnings_forfeit: "Hangus Kemenangan",
  balance_forfeit: "Hangus Saldo",
  full_forfeit: "Hangus Semua",
  account_restriction: "Restriksi Akun",
};

export const L_PENALTY_SCOPE: Record<string, string> = {
  current_promo_only: "Promo Ini Saja",
  all_active_promos: "Semua Promo Aktif",
  all_account_balance: "Seluruh Saldo Akun",
  future_participation: "Partisipasi Selanjutnya",
};
