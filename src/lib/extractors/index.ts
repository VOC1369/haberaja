/**
 * Promo Extractors Module
 * 
 * Modular extraction utilities for promo data with:
 * - Confidence tracking (explicit/derived/ambiguous/unknown)
 * - Source tracking (meta_tag/copyright/content_mention/etc)
 * - Field-aware propagation rules
 * - LLM-based classification (Q1-Q4 reasoning)
 */

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

// LLM-based Category Classifier (v1.0.0+2025-12-21)
export {
  classifyContent,
  calculateCategory,
  getCategoryName,
  getCategoryBadgeVariant,
  getConfidenceBadgeVariant,
  formatQualityFlag,
  applyKeywordOverrides,
  CLASSIFIER_PROMPT_VERSION,
  CLASSIFICATION_MODEL,
  KEYWORD_OVERRIDE_VERSION,
  type ProgramCategory,
  type ClassificationConfidence,
  type QualityFlag,
  type QAnswer,
  type ClassificationResult,
  type ClassificationOverride,
} from './category-classifier';

// Keyword Rules (Single Source of Truth for classification + archetype + defaults)
export {
  matchKeywordRule,
  getCategoryFromKeywords,
  getArchetypeFromKeywords,
  getDefaultsFromKeywords,
  applyKeywordOverride,
  KEYWORD_RULES,
  ARCHETYPE_KEYWORD_ARRAYS,
  type KeywordRule,
  type RewardArchetype,
} from './keyword-rules';

// Category-specific extraction prompts
export {
  getExtractionPrompt,
  getExtractorPromptVersion,
  EXTRACTOR_PROMPT_VERSIONS,
  REWARD_EXTRACTION_PROMPT,
  EVENT_EXTRACTION_PROMPT,
  POLICY_EXTRACTION_PROMPT,
} from './extraction-prompts';
