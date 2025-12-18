/**
 * Promo Extractors Module
 * 
 * Modular extraction utilities for promo data with:
 * - Confidence tracking (explicit/derived/ambiguous/unknown)
 * - Source tracking (meta_tag/copyright/content_mention/etc)
 * - Field-aware propagation rules
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
