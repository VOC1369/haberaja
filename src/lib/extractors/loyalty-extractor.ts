/**
 * Loyalty Program Extractor
 * Extracts loyalty tier data from tables
 * 
 * IMPORTANT: Loyalty Point = PERSISTENT SYSTEM, NOT temporal event
 * - "Hadiah Utama" di tabel = exchange rate, BUKAN lucky draw
 * - LP/Point = deterministic currency, NOT random reward
 */

import { parseTableWithRowspan, type ParsedTable } from './table-parser';

// ============= LOYALTY TIER TYPES =============
export interface LoyaltyTier {
  lp_required: number;
  reward_credit: number;
}

export interface LoyaltySubcategory {
  sub_name: string;
  sub_type: 'point_exchange';
  claim_limit?: string;
  tiers: LoyaltyTier[];
}

export interface LoyaltyConfig {
  earning_rule: string;      // "1,000 TO = 1 LP"
  earning_period: string;    // "daily"
  accumulation_time?: string; // "09:00 WIB"
}

export interface LoyaltyExtractionResult {
  loyaltyConfig: LoyaltyConfig;
  subcategories: LoyaltySubcategory[];
}

// ============= LOYALTY DETECTION SIGNALS =============
export const LOYALTY_SIGNALS = [
  'loyalty point',
  'loyality point',      // common typo in ID
  'penukaran point',
  'penukaran poin',
  'tukar point',
  'tukar poin',
  'lp bonus',
  'loyalty bonus',
  'turnover = 1',
  'to = 1 lp',
  'hadiah loyalitas',
  '1,000 turnover',
  '1.000 turnover',
];

// Regex patterns for LP detection
export const LOYALTY_PATTERNS = [
  /\bLP\b/i,             // "LP" as word
  /\d+\s*LP/i,           // "250 LP"
  /\d+\s*poin/i,         // "250 poin"
  /\d+\s*point/i,        // "250 point"
  /turnover\s*=\s*\d+\s*(lp|point|poin)/i, // "turnover = 1 LP"
];

/**
 * Detect if content is a loyalty program
 */
export function isLoyaltyProgram(content: string): boolean {
  const contentLower = content.toLowerCase();
  
  // Check keyword signals
  const hasKeyword = LOYALTY_SIGNALS.some(signal => contentLower.includes(signal));
  if (hasKeyword) return true;
  
  // Check regex patterns
  const hasPattern = LOYALTY_PATTERNS.some(pattern => pattern.test(content));
  return hasPattern;
}

/**
 * Parse Indonesian number format
 * "1.800.000" or "1,800,000" → 1800000
 */
export function parseIndonesianNumber(str: string): number {
  if (!str) return 0;
  // Remove all dots and commas, keep digits only
  const cleaned = str.replace(/[.,]/g, '').trim();
  return parseInt(cleaned, 10) || 0;
}

/**
 * Detect subcategory name from context
 */
function detectSubcategoryName(content: string, tableIndex: number, tableText: string): string {
  const textLower = tableText.toLowerCase();
  
  // Look for headers like "PAKET HARIAN" or "HADIAH UTAMA"
  if (textLower.includes('paket harian') || textLower.includes('daily')) return 'Paket Harian';
  if (textLower.includes('hadiah utama') || textLower.includes('grand prize')) return 'Hadiah Utama';
  if (textLower.includes('paket mingguan') || textLower.includes('weekly')) return 'Paket Mingguan';
  if (textLower.includes('paket bulanan') || textLower.includes('monthly')) return 'Paket Bulanan';
  
  // Check surrounding content for clues
  const contentLower = content.toLowerCase();
  if (tableIndex === 0 && contentLower.includes('harian')) return 'Paket Harian';
  
  return `Tier Group ${tableIndex + 1}`;
}

/**
 * Detect claim limit from content/table
 */
function detectClaimLimit(content: string, tableText: string): string | undefined {
  const combined = `${content} ${tableText}`.toLowerCase();
  
  if (combined.includes('1x per hari') || combined.includes('setiap hari') || combined.includes('daily')) {
    return '1x per hari';
  }
  if (combined.includes('1x per bulan') || combined.includes('monthly') || combined.includes('per bulan')) {
    return '1x per bulan';
  }
  if (combined.includes('1x per minggu') || combined.includes('weekly')) {
    return '1x per minggu';
  }
  
  return undefined;
}

/**
 * Extract loyalty data from content and tables
 */
export function extractLoyaltyData(content: string, tablesHtml: string[]): LoyaltyExtractionResult {
  const subcategories: LoyaltySubcategory[] = [];
  
  // Parse earning rule from content
  const earningMatch = content.match(/(\d+[,.]?\d*)\s*(?:turnover|to)\s*[=→]\s*(\d+)\s*(?:lp|point|poin)/i);
  const loyaltyConfig: LoyaltyConfig = {
    earning_rule: earningMatch ? `${earningMatch[1]} TO = ${earningMatch[2]} LP` : 'Unknown',
    earning_period: 'daily',
    accumulation_time: content.match(/jam\s*(\d{2}:\d{2})/i)?.[1] || undefined
  };
  
  // Extract tiers from each table
  tablesHtml.forEach((tableHtml, index) => {
    const table = parseTableWithRowspan(tableHtml);
    const tiers: LoyaltyTier[] = [];
    const tableText = JSON.stringify(table);
    
    table.rows?.forEach(row => {
      let lpValue: number | null = null;
      let creditValue: number | null = null;
      
      row.forEach(cell => {
        const cellStr = String(cell);
        
        // Try to extract LP value
        const lpMatch = cellStr.match(/([\d.,]+)\s*(?:LP|point|poin)/i);
        if (lpMatch) {
          lpValue = parseIndonesianNumber(lpMatch[1]);
        }
        
        // Try to extract credit value
        // Look for patterns like "credit game 5.000" or just "5.000"
        const creditMatch = cellStr.match(/(?:credit\s*(?:game)?\s*)?([\d.,]+)/i);
        if (creditMatch && !lpMatch) {
          creditValue = parseIndonesianNumber(creditMatch[1]);
        }
      });
      
      // Only add if we found both values
      if (lpValue && lpValue > 0 && creditValue && creditValue > 0) {
        tiers.push({ lp_required: lpValue, reward_credit: creditValue });
      }
    });
    
    if (tiers.length > 0) {
      const subName = detectSubcategoryName(content, index, tableText);
      const claimLimit = detectClaimLimit(content, tableText);
      
      subcategories.push({
        sub_name: subName,
        sub_type: 'point_exchange',
        claim_limit: claimLimit,
        tiers: tiers
      });
    }
  });
  
  return { loyaltyConfig, subcategories };
}
