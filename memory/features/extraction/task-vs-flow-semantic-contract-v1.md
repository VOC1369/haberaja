# Memory: features/extraction/task-vs-flow-semantic-contract-v1
Updated: 2025-01-14

## Semantic Contract: TASK vs FLOW

### Definisi Formal

| Istilah | Definisi | Field Target |
|---------|----------|--------------|
| **TASK** | Aksi pemicu paling awal yang mengubah state user menjadi ELIGIBLE untuk reward | `trigger_event` |
| **FLOW KLAIM** | Langkah-langkah setelah eligible untuk mengklaim reward | `distribution_note`, `claim_method` |

### Aturan Kritis

1. **TASK = 1 Aksi Saja**
   - `trigger_event` HANYA berisi aksi pemicu pertama
   - BUKAN gabungan trigger + langkah klaim
   - BUKAN flow lengkap

2. **State Change**
   - TASK adalah aksi yang mengubah state:
   - `bukan pengguna` → `pengguna eligible`

3. **Separation of Concerns**
   - TASK → stored in `trigger_event`
   - FLOW → stored in `distribution_note` / `claim_method`

### Contoh per Archetype

| Promo Type | TASK (trigger_event) | FLOW KLAIM (distribution_note) |
|------------|---------------------|--------------------------------|
| APK Download | `APK Download` | Login → Redemption Store → Pilih Reward → Konfirmasi |
| Deposit Bonus | `Deposit` | Otomatis masuk saldo setelah deposit |
| Referral | `Referral` | Downline deposit → Komisi dihitung → Masuk saldo |
| Birthday | `Login` | Login di tanggal ultah → Klaim di CS/Auto |
| Cashback | `Loss` | Akumulasi mingguan → Auto credit Senin |
| Lucky Spin | `Deposit` | Deposit → Dapat tiket → Spin di redemption store |

### Contoh BENAR vs SALAH

**✅ BENAR:**
```json
{
  "trigger_event": "APK Download",
  "distribution_note": "Login ke akun → Masuk Redemption Store → Pilih credit game"
}
```

**❌ SALAH:**
```json
{
  "trigger_event": "Download APK lalu login dan klaim di CS"
}
```

### Implementation Points

1. **promo-intent-reasoner.ts**
   - `primary_action` = TASK saja
   - Detection logic TIDAK memasukkan redemption steps

2. **extraction-prompts.ts**
   - LLM instruksi eksplisit: "trigger_event = aksi pemicu PERTAMA"
   - Contoh benar/salah di prompt

3. **types.ts**
   - JSDoc pada `trigger_event` field menjelaskan kontrak

4. **sanitize-by-mode.ts**
   - Validasi bahwa trigger_event single-action
