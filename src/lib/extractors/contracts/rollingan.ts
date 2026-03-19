/**
 * Mechanic Contract: ROLLINGAN (Turnover Commission)
 *
 * Pattern: Player accumulate turnover → earn commission % of total turnover.
 * Period: weekly or monthly. Distribution: on a specific day.
 */

export const ROLLINGAN_CONTRACT = `
=== KONTRAK MECHANIC: ROLLINGAN / KOMISI TURNOVER ===

ATURAN KERAS (WAJIB IKUT — TIDAK BOLEH DILANGGAR):

1. calculation_basis WAJIB: "turnover"
   ❌ JANGAN gunakan "deposit" atau "net_loss" untuk rollingan
   ✅ Rollingan selalu dihitung dari TOTAL TURNOVER (total taruhan)

2. conversion_formula WAJIB: format "total_turnover * rate%"
   Contoh: "Rollingan 0.5% dari TO" → conversion_formula: "total_turnover * 0.005"

3. Bedakan TIGA angka berbeda yang sering muncul:
   a) min_calculation = threshold minimum TO untuk dapat bonus
      Keyword: "minimal turnover", "min TO", "minimal taruhan", "syarat TO"
      Contoh: "Minimal TO 500.000" → min_calculation: 500000
   b) calculation_value = persentase komisi (reward)
      Keyword: "0.5%", "0.8%", "1%", dsb
      Contoh: "Rollingan 0.5%" → calculation_value: 0.5
   c) turnover_rule = TIDAK BERLAKU untuk rollingan (turnover_enabled: false)
      Rollingan sudah selesai setelah bonus cair — tidak ada WD requirement tambahan

   ❌ DILARANG mengisi "Minimal TO X" ke minimum_base (bukan syarat deposit!)
   ❌ DILARANG mengisi "Minimal TO X" ke turnover_rule (itu bukan multiplier WD!)
   ✅ "Minimal TO X" → min_calculation: X

4. turnover_enabled: false
   Bonus rollingan TIDAK punya syarat TO setelah cair (bonus rollingan = reward, bukan bonus deposit)

5. claim_frequency: extract dari teks
   - "mingguan" / "per minggu" → "mingguan"
   - "harian" → "harian"
   - "bulanan" → "bulanan"
   Default jika tidak disebutkan: "mingguan"

6. distribution_schedule: hari pembagian
   Contoh: "dibagikan setiap hari Senin" → distribution_schedule: "senin"
   Jika tidak disebutkan → null

7. payout_direction: "belakang" (rollingan selalu setelah periode selesai)

8. max_bonus: null kecuali S&K eksplisit menyebut batas maksimum bonus

CONTOH OUTPUT YANG BENAR:
{
  "calculation_basis": "turnover",
  "conversion_formula": "total_turnover * 0.005",
  "calculation_value": 0.5,
  "min_calculation": 500000,
  "turnover_enabled": false,
  "claim_frequency": "mingguan",
  "distribution_schedule": "senin",
  "payout_direction": "belakang",
  "max_bonus": null
}

=== END KONTRAK ROLLINGAN ===
`;

/**
 * MechanicType keys that map to this contract.
 * Used by CONTRACT_REGISTRY in contracts/index.ts.
 */
export const ROLLINGAN_MECHANIC_KEYS = [
  'rollingan_turnover',
  'komisi_turnover',
] as const;
