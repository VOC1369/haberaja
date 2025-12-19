/**
 * Client ID Extractor
 * 
 * Hierarchy (highest to lowest confidence):
 * 1. og:site_name meta tag → explicit
 * 2. Copyright text → explicit  
 * 3. Known brands from config → derived
 * 4. S&K pattern matching → derived
 * 
 * IMPORTANT: Never guess. If uncertain, return unknown.
 */

import type { ConfidenceLevel } from '../openai-extractor';

/**
 * Ensure regex has global flag for matchAll compatibility
 * CRITICAL: matchAll() throws if regex doesn't have 'g' flag
 */
const ensureGlobal = (rx: RegExp): RegExp => {
  if (rx.flags.includes('g')) return rx;
  return new RegExp(rx.source, rx.flags + 'g');
};

// Patterns ordered by confidence level
const CLIENT_ID_PATTERNS = {
  // Meta tags (highest confidence)
  metaTag: [
    /property=["']?og:site_name["']?\s*content=["']?([A-Z][A-Z0-9]+)/i,
    /content=["']?([A-Z][A-Z0-9]+)["']?\s*property=["']?og:site_name/i,
    /<meta[^>]*property=["']?og:site_name["'][^>]*content=["']?([^"']+)/i,
    /<meta[^>]*content=["']?([A-Z][A-Z0-9]+)["'][^>]*property=["']?og:site_name/i,
  ],
  
  // Copyright (high confidence)
  copyright: [
    /©\s*\d{4}\s+([A-Z][A-Z0-9]+)/i,
    /copyright\s*\d{4}\s+([A-Z][A-Z0-9]+)/i,
    /©\s*([A-Z][A-Z0-9]+)\s*\d{4}/i,
    /all\s*rights?\s*reserved\.?\s*([A-Z][A-Z0-9]+)/i,
  ],
  
  // S&K mentions (medium confidence)
  contentMention: [
    /(?:di|oleh|dari|ke)\s+([A-Z][A-Z0-9]{2,})(?=\s|\.|\,|$)/gi,
    /keputusan\s+([A-Z][A-Z0-9]+)\s+bersifat/i,
    /member\s+(?:setia\s+)?([A-Z][A-Z0-9]+)/i,
    /daftar\s+di\s+([A-Z][A-Z0-9]+)/i,
    /(?:bermain|main)\s+di\s+([A-Z][A-Z0-9]+)/i,
    /pihak\s+([A-Z][A-Z0-9]+)/i,
    /customer\s*service\s+([A-Z][A-Z0-9]+)/i,
  ],
} as const;

// Words to exclude from extraction (common Indonesian words that match pattern)
const EXCLUDED_WORDS = new Set([
  'DAN', 'ATAU', 'YANG', 'UNTUK', 'DARI', 'DENGAN', 'PADA', 'AKAN',
  'BISA', 'HARUS', 'TIDAK', 'JIKA', 'MAKA', 'AGAR', 'SAAT', 'SLOT',
  'CASINO', 'SPORTS', 'BONUS', 'PROMO', 'DEPOSIT', 'MEMBER', 'BANK',
  'DANA', 'QRIS', 'PULSA', 'EWALLET', 'CRYPTO', 'VIP', 'NEW', 'ALL',
  'LIVE', 'GAME', 'GAMES', 'PLAY', 'PLAYER', 'USER', 'SPIN', 'WIN',
  'JACKPOT', 'MEGA', 'SUPER', 'LUCKY', 'FREE', 'WELCOME', 'DAILY',
]);

export type ClientIdSource = 'meta_tag' | 'copyright' | 'known_brand' | 'content_mention' | null;

export interface ClientIdResult {
  client_id: string | null;
  confidence: ConfidenceLevel;
  source: ClientIdSource;
  raw_match?: string; // Original matched text for debugging
}

interface ExtractorConfig {
  knownBrands?: string[]; // Tenant-scoped brands from DB/config
}

/**
 * Extract client_id from HTML content
 * 
 * @param content - Raw HTML string
 * @param config - Optional config with tenant-specific known brands
 * @returns ClientIdResult with value, confidence, and source
 */
export const extractClientId = (
  content: string,
  config: ExtractorConfig = {}
): ClientIdResult => {
  
  // 1. Check og:site_name meta tag (highest confidence)
  for (const pattern of CLIENT_ID_PATTERNS.metaTag) {
    const match = content.match(pattern);
    if (match && match[1] && isValidBrandName(match[1])) {
      console.log(`[ClientIdExtractor] Found in meta tag: ${match[1]}`);
      return {
        client_id: match[1].toUpperCase(),
        confidence: 'explicit',
        source: 'meta_tag',
        raw_match: match[0],
      };
    }
  }

  // 2. Check copyright pattern
  for (const pattern of CLIENT_ID_PATTERNS.copyright) {
    const match = content.match(pattern);
    if (match && match[1] && isValidBrandName(match[1])) {
      console.log(`[ClientIdExtractor] Found in copyright: ${match[1]}`);
      return {
        client_id: match[1].toUpperCase(),
        confidence: 'explicit',
        source: 'copyright',
        raw_match: match[0],
      };
    }
  }

  // 3. Check for known brands from config (tenant-scoped)
  const knownBrands = config.knownBrands || getDefaultKnownBrands();
  const upperContent = content.toUpperCase();
  
  for (const brand of knownBrands) {
    if (upperContent.includes(brand.toUpperCase())) {
      console.log(`[ClientIdExtractor] Found known brand: ${brand}`);
      return {
        client_id: brand.toUpperCase(),
        confidence: 'derived',
        source: 'known_brand',
        raw_match: brand,
      };
    }
  }

  // 4. Try S&K pattern matching (lowest confidence)
  // Count occurrences to ensure it's not a false positive
  const candidateCounts: Record<string, { count: number; match: string }> = {};
  
  for (const pattern of CLIENT_ID_PATTERNS.contentMention) {
    // HOTFIX: Ensure regex has global flag for matchAll compatibility
    const regex = pattern instanceof RegExp 
      ? ensureGlobal(pattern) 
      : new RegExp(pattern, 'gi');
    const matches = [...content.matchAll(regex)];
    for (const match of matches) {
      const candidate = match[1]?.toUpperCase();
      if (candidate && isValidBrandName(candidate) && !EXCLUDED_WORDS.has(candidate)) {
        if (!candidateCounts[candidate]) {
          candidateCounts[candidate] = { count: 0, match: match[0] };
        }
        candidateCounts[candidate].count++;
      }
    }
  }

  // Get the most frequently mentioned candidate (must appear 2+ times)
  const sortedCandidates = Object.entries(candidateCounts)
    .sort((a, b) => b[1].count - a[1].count);
  
  if (sortedCandidates.length > 0 && sortedCandidates[0][1].count >= 2) {
    const [brand, data] = sortedCandidates[0];
    console.log(`[ClientIdExtractor] Derived from content: ${brand} (mentioned ${data.count} times)`);
    return {
      client_id: brand,
      confidence: 'derived',
      source: 'content_mention',
      raw_match: data.match,
    };
  }

  // No match found - return unknown (honest, not guessing)
  console.log('[ClientIdExtractor] No brand detected');
  return { 
    client_id: null, 
    confidence: 'unknown', 
    source: null 
  };
};

/**
 * Validate brand name format
 * Must be: 3+ chars, contains letter, contains number (typical iGaming brand pattern)
 */
const isValidBrandName = (name: string): boolean => {
  if (!name || name.length < 3 || name.length > 15) return false;
  const upper = name.toUpperCase();
  // Must have letters AND numbers (typical brand pattern like CITRA77, SLOT25)
  return /[A-Z]/.test(upper) && /\d/.test(upper);
};

/**
 * Default known brands - fallback when no tenant config provided
 * IMPORTANT: In production, this should come from DB/config per tenant
 */
const getDefaultKnownBrands = (): string[] => [
  'CITRA77', 'WIN25', 'SLOT25', 'WG77', 'NEXUS88', 'HOKI777',
  'SLOT88', 'WIN88', 'MEGA88', 'MAJU77', 'HOKI77', 'ZEUS77',
  'NAGA77', 'RAJA77', 'SULTAN77', 'INDO88', 'ASIA88', 'ROYAL88',
  // Add more as needed, but prefer tenant-scoped config
];

/**
 * For future: Load known brands from tenant config
 * This makes the extractor multi-tenant safe
 */
export const createTenantExtractor = (tenantConfig: { brands: string[] }) => {
  return (content: string) => extractClientId(content, { 
    knownBrands: tenantConfig.brands 
  });
};
