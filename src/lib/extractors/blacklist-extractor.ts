/**
 * Blacklist Extractor
 * 
 * Handles the complexity of blacklist rules that may or may not apply
 * to specific variants based on their provider.
 * 
 * Key insight: S&K blacklist often written for one provider but displayed
 * across all variants. We must distinguish:
 * - explicit: S&K directly applies to this variant's provider
 * - derived: Variant has provider exclusion (e.g., "kecuali Mega888")
 * - ambiguous: S&K has blacklist but for different provider
 */

import type { ConfidenceLevel } from '../openai-extractor';

export type BlacklistConfidence = 'explicit' | 'derived' | 'ambiguous' | 'none';

export interface BlacklistResult {
  enabled: boolean;
  games: string[];
  providers: string[];
  rules: string[];
  confidence: BlacklistConfidence;
  source_note?: string;
}

interface BlacklistContext {
  variantProvider: string;
  variantGameType: string;
  skText: string;
  skBlacklistGames: string[];
}

/**
 * Extract blacklist configuration for a specific variant
 */
export const extractBlacklist = (context: BlacklistContext): BlacklistResult => {
  const { variantProvider, variantGameType, skText, skBlacklistGames } = context;

  // No blacklist in S&K at all
  if (!skBlacklistGames.length && !hasProviderExclusion(variantProvider)) {
    return {
      enabled: false,
      games: [],
      providers: [],
      rules: [],
      confidence: 'none',
    };
  }

  // Check if variant has provider exclusion (e.g., "Semua kecuali Mega888")
  const providerExclusions = extractProviderExclusions(variantProvider);
  if (providerExclusions.length > 0) {
    return {
      enabled: true,
      games: [], // Provider exclusion, not game-specific
      providers: providerExclusions,
      rules: [],
      confidence: 'derived',
      source_note: `Provider exclusion dari deskripsi: ${providerExclusions.join(', ')}`,
    };
  }

  // Check if S&K blacklist games match variant's provider
  const blacklistProviders = extractProvidersFromGameList(skBlacklistGames);
  const variantProviderLower = variantProvider.toLowerCase();
  
  const providersMatch = blacklistProviders.some((p) => 
    variantProviderLower.includes(p.toLowerCase()) ||
    p.toLowerCase().includes('semua') || // "Semua Slot" applies broadly
    p.toLowerCase().includes('all')
  );

  if (providersMatch) {
    // S&K blacklist directly applies to this variant
    const { games, rules } = categorizeBlacklistItems(skBlacklistGames);
    const applicableGames = filterGamesForProvider(
      games, 
      variantProvider,
      variantGameType
    );
    
    return {
      enabled: true,
      games: applicableGames,
      providers: blacklistProviders,
      rules: rules,
      confidence: 'explicit',
      source_note: 'Blacklist dari S&K sesuai dengan provider varian',
    };
  }

  // S&K has blacklist but for different provider
  // This is the AMBIGUOUS case - we mark it honestly
  return {
    enabled: false,
    games: [],
    providers: [],
    rules: [],
    confidence: 'ambiguous',
    source_note: `S&K blacklist untuk provider lain (${blacklistProviders.join(', ')}), tidak berlaku untuk varian ini`,
  };
};

/**
 * Extract provider names from game blacklist
 * e.g., "MONEY ROLL (Pragmatic)" → ["Pragmatic"]
 */
const extractProvidersFromGameList = (games: string[]): string[] => {
  const providers = new Set<string>();
  
  games.forEach((game) => {
    // Pattern: "GAME NAME (Provider)"
    const match = game.match(/\(([^)]+)\)/);
    if (match) {
      providers.add(match[1].trim());
    }
    
    // Pattern: "Semua Slot" or "All Slot"
    if (/semua\s*(slot|game)/i.test(game)) {
      providers.add('Semua Slot');
    }
  });

  return [...providers];
};

/**
 * Extract provider exclusions from provider description
 * e.g., "Semua Provider Slots, kecuali Mega888, Playtech" → ["Mega888", "Playtech"]
 */
const extractProviderExclusions = (providerText: string): string[] => {
  const patterns = [
    /kecuali\s+(.+?)(?:\.|$)/i,
    /except\s+(.+?)(?:\.|$)/i,
    /selain\s+(.+?)(?:\.|$)/i,
  ];

  for (const pattern of patterns) {
    const match = providerText.match(pattern);
    if (match) {
      return match[1]
        .split(/[,&]/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }
  }

  return [];
};

/**
 * Check if provider text contains exclusion pattern
 */
const hasProviderExclusion = (providerText: string): boolean => {
  return /kecuali|except|selain/i.test(providerText);
};

/**
 * Filter blacklist games that apply to specific provider/game type
 */
const filterGamesForProvider = (
  games: string[],
  provider: string,
  gameType: string
): string[] => {
  const providerLower = provider.toLowerCase();
  const gameTypeLower = gameType.toLowerCase();

  return games.filter((game) => {
    const gameLower = game.toLowerCase();
    
    // "Semua Slot" applies to all slot variants
    if (gameLower.includes('semua') && gameTypeLower === 'slot') {
      return true;
    }
    
    // Check if game's provider matches variant's provider
    const gameProvider = game.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || '';
    
    // If no provider specified in game, assume it applies
    if (!gameProvider) {
      return true;
    }
    
    return providerLower.includes(gameProvider) || gameProvider.includes('semua');
  });
};

/**
 * Categorize blacklist items into games vs rules
 * games = specific game names (proper nouns)
 * rules = general categories (3 Line, Old game, RTP > 97%, etc.)
 */
const categorizeBlacklistItems = (items: string[]): { games: string[]; rules: string[] } => {
  const games: string[] = [];
  const rules: string[] = [];

  const rulePatterns = [
    /^\d+\s*(line|gambar|reel)/i,
    /^(semua|all)\s+(yang|dengan)/i,
    /old\s*(game|slot)/i,
    /rtp\s*[><]/i,
    /\d+\s*(gambar|line)/i,
  ];

  for (const item of items) {
    const isRule = rulePatterns.some(p => p.test(item.trim()));
    if (isRule) {
      rules.push(item.trim());
    } else {
      games.push(item.trim());
    }
  }

  return { games, rules };
};

/**
 * Extract blacklist games from S&K text
 * Pattern: "tidak di perbolehkan bermain di slot:" followed by list
 */
export const extractBlacklistFromSK = (skText: string): string[] => {
  const games: string[] = [];
  
  // Multiple patterns to catch different S&K formats
  const patterns = [
    // Pattern 1: "tidak di perbolehkan bermain di slot:" followed by list
    /(?:tidak\s*(?:di\s*)?(?:perbolehkan|boleh)|dilarang)\s*(?:bermain|main)\s*(?:di\s*)?(?:slot|game)?[:\s]*([^.]+)/gi,
    
    // Pattern 2: "kecuali:" followed by list
    /kecuali[:\s]+([^.]+)/gi,
    
    // Pattern 3: "blacklist:" or "dikecualikan:"
    /(?:blacklist|dikecualikan)[:\s]+([^.]+)/gi,
    
    // Pattern 4: "game yang tidak berlaku:"
    /game\s+yang\s+tidak\s+berlaku[:\s]+([^.]+)/gi,
  ];

  for (const pattern of patterns) {
    const matches = [...skText.matchAll(pattern)];
    for (const match of matches) {
      const listText = match[1];
      
      // Split by common delimiters and clean
      const items = listText
        .split(/[-•;,\n]/)
        .map(s => s.trim())
        .filter(Boolean)
        .filter(s => s.length > 2); // Filter out noise
      
      games.push(...items);
    }
  }

  // Remove duplicates
  return [...new Set(games)];
};

/**
 * Merge blacklist from global S&K with variant-specific blacklist
 */
export const mergeBlacklists = (
  global: BlacklistResult,
  variant: BlacklistResult
): BlacklistResult => {
  // If variant has explicit blacklist, prefer it
  if (variant.confidence === 'explicit' || variant.confidence === 'derived') {
    return variant;
  }
  
  // If global has explicit blacklist, use it
  if (global.confidence === 'explicit') {
    return global;
  }
  
  // Both are ambiguous or none - return the more informative one
  return global.games.length > 0 ? global : variant;
};
