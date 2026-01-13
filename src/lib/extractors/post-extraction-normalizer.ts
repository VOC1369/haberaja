/**
 * Post-Extraction Normalizer v1.1
 * 
 * FILOSOFI: "Setiap pintu masuk hanya mengantar data mentah. 
 *            Satu normalizer menyamakan makna. 
 *            Display menampilkan tanpa asumsi."
 * 
 * Ini adalah SINGLE POINT OF NORMALIZATION setelah LLM extraction,
 * sebelum data masuk ke Form State (mappedPreview).
 * 
 * 🔒 10 ATURAN WAJIB (SOP Hybrid Extraction):
 * 1. Source Priority: TEXT > IMAGE > HEURISTIC. Jika konflik → TEXT menang.
 * 2. Nilai vs Tampilan: Data inti TANPA suffix. UI yang menambahkan % / x / Rp.
 * 3. Percent Guard: Jika konteks = bonus & ada % → set reward_unit=percent.
 * 4. Terms = Sumber Kebenaran Constraint: Min WD/TO/Claim freq dari Terms.
 * 5. TO Detection (Relasional): Frasa apapun bermakna TO x N → turnover_enabled=true.
 * 6. Gate ≠ Basis: Gate (klaim) vs Basis (hitung) tidak boleh campur.
 * 7. Withdraw Bonus Rule: trigger=Withdraw != basis=withdraw.
 * 8. Game Type Resolution: Terms spesifik override "Semua".
 * 9. Multi Validation: Badge "Multi" hanya jika >1 subcategory valid.
 * 10. Confidence Tagging: hybrid/text → high, image → medium.
 * 
 * 6 NORMALIZATION RULES:
 * 1. normalizeNumericValues - Strip suffixes (%, x, Rp) → pure numbers
 * 2. deriveCalculationMethod - Force from promo_name (% detection)
 * 3. validateTriggerContext - Robust Withdraw detection + payout_direction
 * 4. dedupeSubcategories - Remove ghost/duplicate subcategories
 * 5. syncCalculationMethod - Ensure consistency across subcategories
 * 6. inferTurnoverFromTerms - Fallback TO inference from terms (for image-only)
 */

export interface NormalizablePromo {
  promo_name?: string;
  terms_conditions?: string[];
  subcategories?: NormalizableSubCategory[];
  trigger_event?: string;
  payout_direction?: 'depan' | 'belakang' | null;
  calculation_method?: string;
  calculation_value?: number | string | null;
  turnover_rule?: number | string | null;
  min_calculation?: number | string | null;
  [key: string]: unknown;
}

export interface NormalizableSubCategory {
  sub_name?: string;
  calculation_method?: string;
  calculation_value?: number | string | null;
  turnover_rule?: number | string | null;
  payout_direction?: 'depan' | 'belakang' | null;
  [key: string]: unknown;
}

export type ExtractionSource = 'html' | 'image' | 'text' | 'hybrid';

/**
 * Main normalizer function - applies all 6 rules in sequence
 * 
 * @param extracted - Raw extracted promo data from LLM
 * @param source - Extraction source: 'html' | 'image' | 'text' | 'hybrid'
 */
export function normalizeExtractedPromo<T extends NormalizablePromo>(
  extracted: T,
  source: ExtractionSource
): T {
  let result = { ...extracted };

  // Step 1: Normalize numeric values (strip suffixes)
  result = normalizeNumericValues(result);

  // Step 2: Derive calculation_method from promo_name
  result = deriveCalculationMethod(result);

  // Step 3: Validate trigger context (Withdraw detection + payout)
  result = validateTriggerContext(result);

  // Step 4: Dedupe ghost subcategories
  result = dedupeSubcategories(result);

  // Step 5: Sync calculation_method across subcategories
  result = syncCalculationMethod(result);

  // Step 6: Infer turnover from terms (ONLY for image-only mode)
  // Hybrid mode already has TEXT as source of truth for TO
  if (source !== 'hybrid' && source !== 'text') {
    result = inferTurnoverFromTerms(result);
  }

  console.log(`[PostNormalizer] Source: ${source}, applied normalization rules. Hybrid: ${source === 'hybrid'}`);
  return result;
}

/**
 * Rule 1: Strip suffixes from numeric values
 * - turnover_rule: "1x" → 1
 * - calculation_value: "5%" → 5, also sets calculation_method
 * - min_calculation: "Rp 200.000" → 200000
 */
function normalizeNumericValues<T extends NormalizablePromo>(data: T): T {
  const result = { ...data };

  // Normalize root-level fields
  if (result.turnover_rule !== undefined && result.turnover_rule !== null) {
    result.turnover_rule = stripSuffix(result.turnover_rule, 'x');
  }

  if (result.calculation_value !== undefined && result.calculation_value !== null) {
    const stripped = stripSuffix(result.calculation_value, '%');
    result.calculation_value = stripped;
  }

  if (result.min_calculation !== undefined && result.min_calculation !== null) {
    result.min_calculation = parseCurrency(result.min_calculation);
  }

  // Normalize subcategories
  if (result.subcategories && Array.isArray(result.subcategories)) {
    result.subcategories = result.subcategories.map(sub => ({
      ...sub,
      turnover_rule: sub.turnover_rule !== undefined && sub.turnover_rule !== null
        ? stripSuffix(sub.turnover_rule, 'x')
        : sub.turnover_rule,
      calculation_value: sub.calculation_value !== undefined && sub.calculation_value !== null
        ? stripSuffix(sub.calculation_value, '%')
        : sub.calculation_value,
    }));
  }

  return result;
}

/**
 * Rule 2: Derive calculation_method from promo_name
 * - If promo name contains "X%", force calculation_method = 'percentage'
 * - If promo name contains "Rp X", force calculation_method = 'fixed'
 */
function deriveCalculationMethod<T extends NormalizablePromo>(data: T): T {
  const result = { ...data };
  const promoName = (result.promo_name || '').toLowerCase();

  // Detect percentage pattern in promo name (e.g., "5%", "10 %")
  const hasPercentInName = /\d+\s*%/i.test(promoName);
  
  // Detect fixed amount pattern in promo name (e.g., "Rp 50.000", "50rb")
  const hasFixedInName = /rp\.?\s*[\d.,]+|[\d.,]+\s*(rb|ribu|jt|juta)/i.test(promoName) && !hasPercentInName;

  if (hasPercentInName) {
    console.log('[PostNormalizer] Promo name has %, forcing calculation_method=percentage');
    result.calculation_method = 'percentage';
    
    if (result.subcategories && Array.isArray(result.subcategories)) {
      result.subcategories = result.subcategories.map(sub => ({
        ...sub,
        calculation_method: 'percentage',
      }));
    }
  } else if (hasFixedInName) {
    console.log('[PostNormalizer] Promo name has Rp/rb, forcing calculation_method=fixed');
    result.calculation_method = 'fixed';
    
    if (result.subcategories && Array.isArray(result.subcategories)) {
      result.subcategories = result.subcategories.map(sub => ({
        ...sub,
        calculation_method: 'fixed',
      }));
    }
  }

  return result;
}

/**
 * Rule 3: Validate trigger context
 * - Robust Withdraw detection from promo_name + terms
 * - Force payout_direction = 'belakang' for Withdraw Bonus
 */
function validateTriggerContext<T extends NormalizablePromo>(data: T): T {
  const result = { ...data };
  const promoName = (result.promo_name || '').toLowerCase();
  const termsText = (result.terms_conditions || []).join(' ').toLowerCase();
  const combined = promoName + ' ' + termsText;

  // Robust Withdraw detection patterns
  const isWithdrawTriggered =
    result.trigger_event === 'Withdraw' ||
    /bonus\s*(?:extra\s*)?(wd|withdraw)/i.test(promoName) ||
    /extra\s*wd/i.test(promoName) ||
    /bonus\s*wd/i.test(promoName) ||
    /minimal\s*(?:wd|withdraw)/i.test(combined);

  if (isWithdrawTriggered) {
    console.log('[PostNormalizer] Withdraw Bonus detected, forcing payout_direction=belakang');
    
    // Force payout_direction at root level
    result.payout_direction = 'belakang';
    
    // Force payout_direction in all subcategories
    if (result.subcategories && Array.isArray(result.subcategories)) {
      result.subcategories = result.subcategories.map(sub => ({
        ...sub,
        payout_direction: 'belakang' as const,
      }));
    }
  }

  return result;
}

/**
 * Rule 4: Dedupe ghost subcategories
 * - Remove empty sub_name
 * - Remove duplicates by sub_name
 * - Recalculate hasMultipleSubCategories flag
 */
function dedupeSubcategories<T extends NormalizablePromo>(data: T): T {
  const result = { ...data };

  if (result.subcategories && Array.isArray(result.subcategories) && result.subcategories.length > 0) {
    const originalCount = result.subcategories.length;
    
    // Step 1: Remove entries with empty or whitespace-only sub_name
    let valid = result.subcategories.filter(sub =>
      sub.sub_name && sub.sub_name.trim() !== ''
    );

    // Step 2: Dedupe by normalized sub_name (case-insensitive)
    const seen = new Set<string>();
    valid = valid.filter(sub => {
      const key = (sub.sub_name || '').toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    result.subcategories = valid;
    
    if (originalCount !== valid.length) {
      console.log(`[PostNormalizer] Subcategories deduped: ${originalCount} → ${valid.length}`);
    }
  }

  return result;
}

/**
 * Rule 5: Sync calculation_method across subcategories
 * - If root calculation_method is set, propagate to all subcategories
 * - If not, inherit from first subcategory with valid method
 */
function syncCalculationMethod<T extends NormalizablePromo>(data: T): T {
  const result = { ...data };

  if (result.subcategories && Array.isArray(result.subcategories) && result.subcategories.length > 0) {
    // Priority 1: Use root calculation_method
    if (result.calculation_method) {
      result.subcategories = result.subcategories.map(sub => ({
        ...sub,
        calculation_method: sub.calculation_method || result.calculation_method,
      }));
    } else {
      // Priority 2: Inherit from first subcategory with valid method
      const firstMethod = result.subcategories.find(s => s.calculation_method)?.calculation_method;
      if (firstMethod) {
        result.subcategories = result.subcategories.map(sub => ({
          ...sub,
          calculation_method: sub.calculation_method || firstMethod,
        }));
      }
    }
  }

  return result;
}

/**
 * Rule 6: Infer turnover from terms
 * - Fallback for image/OCR extraction that misses structured turnover data
 * - Parses terms_conditions for patterns like "to x 1", "minimal to x1", "dengan to x 1"
 */
function inferTurnoverFromTerms<T extends NormalizablePromo>(data: T): T {
  const result = { ...data };
  
  // Skip if turnover already exists at root or in any subcategory
  const hasExistingTurnover = 
    (result.turnover_rule && Number(result.turnover_rule) > 0) ||
    result.subcategories?.some(sub => sub.turnover_rule && Number(sub.turnover_rule) > 0);
  
  if (hasExistingTurnover) {
    return result;
  }
  
  const termsText = (result.terms_conditions || []).join(' ').toLowerCase();
  
  // Pattern matching for turnover multipliers
  const patterns = [
    /(?:to|turnover)\s*(?:x|kali)\s*(\d+)/i,           // "to x 1", "turnover x 3"
    /(\d+)\s*(?:x|kali)\s*(?:to|turnover)/i,           // "1x to", "3 kali turnover"
    /minimal\s*(?:to|turnover)\s*(?:x|kali)?\s*(\d+)/i, // "minimal to x 1"
    /dengan\s*(?:to|turnover)\s*x?\s*(\d+)/i,          // "dengan to x1"
    /claim\s*dengan.*?(?:to|turnover)\s*x?\s*(\d+)/i,  // "claim dengan minimal to x1"
    /syarat\s*(?:to|turnover)\s*(?:x|kali)?\s*(\d+)/i, // "syarat to x 1"
    /wajib\s*(?:to|turnover)\s*(?:x|kali)?\s*(\d+)/i,  // "wajib to x 1"
  ];
  
  for (const pattern of patterns) {
    const match = termsText.match(pattern);
    if (match && match[1]) {
      const multiplier = parseInt(match[1], 10);
      if (multiplier > 0 && multiplier <= 100) {
        console.log(`[PostNormalizer] Inferred turnover_rule=${multiplier} from terms`);
        
        // Set at root level
        result.turnover_rule = multiplier;
        
        // Also apply to subcategories that don't have turnover
        if (result.subcategories && Array.isArray(result.subcategories)) {
          result.subcategories = result.subcategories.map(sub => ({
            ...sub,
            turnover_rule: sub.turnover_rule ?? multiplier,
          }));
        }
        break;
      }
    }
  }
  
  return result;
}

// ============= UTILITY FUNCTIONS =============

/**
 * Strip suffix from value and return as number
 * "1x" → 1, "5%" → 5, "10" → 10
 */
function stripSuffix(value: unknown, suffix: string): number | string | null {
  if (value === null || value === undefined) return null;
  
  const str = String(value).trim();
  
  // If already a clean number, return as number
  const directNum = parseFloat(str);
  if (!isNaN(directNum) && !/[a-zA-Z%]/.test(str)) {
    return directNum;
  }
  
  // Strip the suffix if present
  if (str.toLowerCase().endsWith(suffix.toLowerCase())) {
    const num = parseFloat(str.slice(0, -suffix.length).trim());
    return isNaN(num) ? str : num;
  }
  
  // Try to parse as number anyway
  const num = parseFloat(str.replace(/[^0-9.,]/g, '').replace(',', '.'));
  return isNaN(num) ? str : num;
}

/**
 * Parse currency string to number
 * "Rp 200.000" → 200000, "50rb" → 50000, "1jt" → 1000000
 */
function parseCurrency(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  
  // If already a number, return as-is
  if (typeof value === 'number') return value;
  
  const str = String(value).toLowerCase().trim();
  
  // Remove currency prefix
  let cleaned = str.replace(/^rp\.?\s*/i, '').replace(/^idr\s*/i, '');
  
  // Handle suffixes (jt, juta, rb, ribu, k)
  let multiplier = 1;
  if (/jt|juta/i.test(cleaned)) {
    multiplier = 1_000_000;
    cleaned = cleaned.replace(/\s*(jt|juta)/i, '');
  } else if (/rb|ribu|k/i.test(cleaned)) {
    multiplier = 1_000;
    cleaned = cleaned.replace(/\s*(rb|ribu|k)/i, '');
  }
  
  // Parse the number (handle both . and , as separators)
  // Indonesian format: 200.000 = 200000
  const num = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  
  if (isNaN(num)) return null;
  
  return num * multiplier;
}
