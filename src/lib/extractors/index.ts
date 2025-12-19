/**
 * Promo Extractors Module
 * 
 * Modular extraction utilities for promo data with:
 * - Confidence tracking (explicit/derived/ambiguous/unknown)
 * - Source tracking (meta_tag/copyright/content_mention/etc)
 * - Field-aware propagation rules
 * - Category classification (A/B/C)
 */

// Category Classification (NEW) with program_nature & hard lock routing
export {
  classifyContent,
  getExtractionPrompt,
  getCategoryDisplayInfo,
  applyHardLockRouting,
  REWARD_EXTRACTION_PROMPT,
  EVENT_EXTRACTION_PROMPT,
  POLICY_EXTRACTION_PROMPT,
  type ProgramCategory,
  type ProgramNature,
  type CategoryCSubtype,
  type EnhancedEventType,
  type ClassificationResult,
} from './category-classifier';

// Loyalty Program Extraction
export {
  extractLoyaltyData,
  isLoyaltyProgram,
  parseIndonesianNumber,
  LOYALTY_SIGNALS,
  LOYALTY_PATTERNS,
  type LoyaltyTier,
  type LoyaltySubcategory,
  type LoyaltyConfig,
  type LoyaltyExtractionResult,
} from './loyalty-extractor';

// Client ID extraction
export { 
  extractClientId, 
  createTenantExtractor,
  type ClientIdResult,
  type ClientIdSource 
} from './client-id-extractor';

// Table parsing with rowspan support
export {
  parseTableWithRowspan,
  applySharedValues,
  mapHeaderToField,
  extractTablesFromHtml,
  parseNumericValue,
  type ParsedTable,
} from './table-parser';

// HTML table normalization (pre-processor)
export {
  normalizeHtmlTables,
  hasRowspanTables,
  hasColspanTables,
  needsNormalization,
  type NormalizedTable,
} from './html-normalizer';

// Blacklist extraction with ambiguity handling
export {
  extractBlacklist,
  extractBlacklistFromSK,
  mergeBlacklists,
  type BlacklistResult,
  type BlacklistConfidence,
} from './blacklist-extractor';

// Field propagation rules
export {
  PROPAGATABLE_FIELDS,
  VARIANT_SPECIFIC_FIELDS,
  isPropagatableField,
  isVariantSpecificField,
  type PropagatableField,
  type VariantSpecificField,
} from './field-rules';
