# Memory: features/extraction/apk-payout-minmax-fix-v1-2
Updated: now

Implemented APK Promo Display Fixes v1.2:

1. **Payout Direction = null for APK/Event promos**:
   - `sanitize-by-mode.ts`: Added `payout_direction = null` and `global_payout_direction_enabled = false` for NON_FORMULA_MODES
   - `openai-extractor.ts`: Added APK guard in payout_direction IIFE to return null for APK-like promos
   - `PseudoKnowledgeSection.tsx`: UI now displays "-" for Payout and Jenis Game when APK promo detected

2. **Min/Max Bonus Range Parser for APK promos**:
   - Added `parseIDRFromText()` helper to extract IDR amounts from text like "5K", "20rb", "Rp 5.000"
   - Added `apkBonusRange` computation that scans subcategory names for numeric amounts
   - Updated subcategory mapping to use parsed amounts instead of LLM null (which caused "Unlimited")
   - Root-level `reward_amount` set to range min, `max_bonus` set to range max

3. **Detection Criteria for APK-like promos**:
   - `lockedFields?.trigger_event === 'APK Download'`
   - `lockedFields?.require_apk === true`
   - Regex: `/apk|download|aplikasi|freechip|freebet/i` in promo name or terms

4. **UI Display for APK promos**:
   - Payout: "-" (not "BELAKANG")
   - Jenis Game: "-" (not "Semua")
   - Min Bonus: Parsed from range (e.g., 5K)
   - Max Bonus: Parsed from range (e.g., 20K, not "Unlimited")
