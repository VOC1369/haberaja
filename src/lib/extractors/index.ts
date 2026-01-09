/**
 * Promo Extractors Module
 * 
 * Modular extraction utilities for promo data with:
 * - Confidence tracking (explicit/derived/ambiguous/unknown)
 * - Source tracking (meta_tag/copyright/content_mention/etc)
 * - Field-aware propagation rules
 * - LLM-based classification (Q1-Q4 reasoning)
 * 
 * === REASONING-FIRST ARCHITECTURE (v2.0) ===
 * New modules added 2025-01-09:
 * - promo-intent-reasoner: Step-0 LLM reasoning (6 core questions)
 * - mechanic-router: Deterministic mechanic routing with invariants
 * - arbitration-rules: Q1-Q4 vs Step-0 conflict resolution
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

// Field Applicability Map (Full-Shape JSON with Inert Values)
export {
  enforceFieldApplicability,
  applyInertValuesToPayload,
  getInertValue,
  INERT_VALUES,
  FIELD_APPLICABILITY_MAP,
  type FieldApplicabilityRule,
  type ApplicabilityResult,
} from './field-applicability-map';

// Canonical Guard (v2.1-FINAL enforcement)
export {
  enforceCanonicalGuard,
  checkHardFail,
  stripUIPrefix,
  isEngineLogicField,
  enforceGameExclusions,
  CANONICAL_EXPORT_WHITELIST,
  TAXONOMY_RULES,
  CANONICAL_OUTPUT_PROMPT,
  type CanonicalFieldName,
  type CanonicalCategory,
  type CanonicalMode,
  type CanonicalTierArchetype,
  type CanonicalGuardResult,
  type HardFailResult,
} from '../canonical-guard';

// ============================================
// REASONING-FIRST ARCHITECTURE (v2.0)
// ============================================

// Promo Intent Reasoner (Step-0)
export {
  reasonPromoIntent,
  calculateIntentConfidence,
  detectIntentConflicts,
  REASONER_VERSION,
  INTENT_REASONER_PROMPT,
  type PromoIntent,
  type PrimaryAction,
  type RewardNature,
  type ValueDeterminer,
  type TimeScope,
  type DistributionPath,
  type ValueShape,
} from './promo-intent-reasoner';

// Mechanic Router
export {
  routeMechanic,
  checkInvariants,
  getMechanicDisplayName,
  ROUTER_VERSION,
  type MechanicType,
  type PromoMode,
  type LockedFields,
  type MechanicRouterResult,
} from './mechanic-router';

// Arbitration Rules
export {
  arbitrate,
  formatConflicts,
  ARBITRATION_VERSION,
  categoryToUIRouting,
  actionToSuggestedCategory,
  isStrongNonPromo,
  type ArbitrationInput,
  type ArbitrationResult,
  type ConflictRecord,
} from './arbitration-rules';
