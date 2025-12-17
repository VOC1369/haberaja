/**
 * APBE Dictionary Preprocessor v1.1
 * 
 * Provides normalization, deduplication, and Indonesian morphological stemming
 * for dictionary_red and dictionary_yellow word lists.
 * 
 * Features:
 * - Case normalization (lowercase)
 * - Whitespace trimming
 * - Punctuation removal
 * - Full Indonesian stemming (prefixes + suffixes + nasalization)
 * - Cross-dictionary deduplication
 * - Similar word detection
 * 
 * Indonesian Morphology Handled:
 * - Prefixes: ber-, di-, ke-, me-, mem-, men-, meng-, meny-, pe-, pem-, pen-, peng-, peny-, per-, se-, ter-
 * - Suffixes: -kan, -an, -i, -lah, -kah, -nya, -ku, -mu
 * - Nasalization restoration: meny- → s, meng- → k/g, mem- → p, men- → t
 */

// ============================================================
// TYPES
// ============================================================

export interface PreprocessResult {
  normalized: string;
  original: string;
  stem: string;
}

export interface AddWordResult {
  success: boolean;
  added: string[];
  rejected: string[];
  warnings: string[];
  errors: string[];
}

export interface DictionaryValidation {
  isValid: boolean;
  duplicates: string[];
  similarWords: Array<{ word: string; similarTo: string }>;
  warnings: string[];
}

// ============================================================
// NORMALIZATION
// ============================================================

/**
 * Normalize a word: lowercase, trim, remove punctuation
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .trim()
    // Remove common punctuation but keep internal hyphens
    .replace(/^[^\w]+|[^\w]+$/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ');
}

// ============================================================
// INDONESIAN STEMMER v1.1
// Based on Nazief-Adriani algorithm (simplified)
// ============================================================

/**
 * Remove Indonesian particles: -lah, -kah, -tah, -pun
 */
function removeParticles(word: string): string {
  const particles = ['lah', 'kah', 'tah', 'pun'];
  for (const p of particles) {
    if (word.endsWith(p) && word.length > p.length + 2) {
      return word.slice(0, -p.length);
    }
  }
  return word;
}

/**
 * Remove Indonesian possessive pronouns: -ku, -mu, -nya
 */
function removePossessive(word: string): string {
  const possessives = ['nya', 'ku', 'mu'];
  for (const p of possessives) {
    if (word.endsWith(p) && word.length > p.length + 2) {
      return word.slice(0, -p.length);
    }
  }
  return word;
}

/**
 * Remove Indonesian derivational suffixes: -kan, -an, -i
 */
function removeDerivationalSuffix(word: string): string {
  // Order matters: check longer suffixes first
  const suffixes = ['kan', 'an', 'i'];
  for (const s of suffixes) {
    if (word.endsWith(s) && word.length > s.length + 2) {
      return word.slice(0, -s.length);
    }
  }
  return word;
}

/**
 * Remove Indonesian prefixes with nasalization restoration
 * Handles: ber-, di-, ke-, me-, mem-, men-, meng-, meny-, pe-, pem-, pen-, peng-, peny-, per-, se-, ter-
 */
function removePrefix(word: string): string {
  const minLength = 3; // Minimum root length
  
  // ===== MENY- prefix (restores 's') =====
  // menyapu → sapu, menyesal → sesal
  if (word.startsWith('meny') && word.length > 4 + minLength) {
    return 's' + word.slice(4);
  }
  
  // ===== MENG- prefix (restores 'k' or 'g', or vowel) =====
  // mengambil → ambil, mengkaji → kaji
  if (word.startsWith('meng') && word.length > 4 + minLength) {
    const rest = word.slice(4);
    // If starts with vowel, just remove prefix
    if (/^[aiueo]/.test(rest)) {
      return rest;
    }
    // Otherwise restore 'k'
    return 'k' + rest;
  }
  
  // ===== MEM- prefix (restores 'p') =====
  // membeli → beli, memakai → pakai
  if (word.startsWith('mem') && word.length > 3 + minLength) {
    const rest = word.slice(3);
    // If starts with 'b', just remove prefix
    if (rest.startsWith('b')) {
      return rest;
    }
    // If starts with vowel, restore 'p'
    if (/^[aiueo]/.test(rest)) {
      return 'p' + rest;
    }
    return rest;
  }
  
  // ===== MEN- prefix (restores 't') =====
  // menari → tari, menulis → tulis
  if (word.startsWith('men') && word.length > 3 + minLength) {
    const rest = word.slice(3);
    // If starts with vowel, restore 't'
    if (/^[aiueo]/.test(rest)) {
      return 't' + rest;
    }
    return rest;
  }
  
  // ===== ME- prefix =====
  // melamar → lamar, merasa → rasa
  if (word.startsWith('me') && word.length > 2 + minLength) {
    return word.slice(2);
  }
  
  // ===== PENY- prefix (restores 's') =====
  // penyakit → sakit
  if (word.startsWith('peny') && word.length > 4 + minLength) {
    return 's' + word.slice(4);
  }
  
  // ===== PENG- prefix (restores 'k') =====
  // pengusaha → usaha, pengkritik → kritik
  if (word.startsWith('peng') && word.length > 4 + minLength) {
    const rest = word.slice(4);
    if (/^[aiueo]/.test(rest)) {
      return rest;
    }
    return 'k' + rest;
  }
  
  // ===== PEM- prefix (restores 'p') =====
  // pembeli → beli, pemain → main
  if (word.startsWith('pem') && word.length > 3 + minLength) {
    const rest = word.slice(3);
    if (rest.startsWith('b')) {
      return rest;
    }
    if (/^[aiueo]/.test(rest)) {
      return 'p' + rest;
    }
    return rest;
  }
  
  // ===== PEN- prefix (restores 't') =====
  // penari → tari, penulis → tulis
  if (word.startsWith('pen') && word.length > 3 + minLength) {
    const rest = word.slice(3);
    if (/^[aiueo]/.test(rest)) {
      return 't' + rest;
    }
    return rest;
  }
  
  // ===== PER- prefix =====
  // permainan → main (after suffix removal)
  if (word.startsWith('per') && word.length > 3 + minLength) {
    return word.slice(3);
  }
  
  // ===== PE- prefix =====
  // pekerja → kerja
  if (word.startsWith('pe') && word.length > 2 + minLength) {
    return word.slice(2);
  }
  
  // ===== BER- prefix =====
  // bermain → main, belajar → ajar
  if (word.startsWith('ber') && word.length > 3 + minLength) {
    return word.slice(3);
  }
  
  // ===== BEL- prefix (special case) =====
  // belajar → ajar
  if (word.startsWith('bel') && word.length > 3 + minLength) {
    return word.slice(3);
  }
  
  // ===== TER- prefix =====
  // terbang → bang (though 'terbang' is a root), terjatuh → jatuh
  if (word.startsWith('ter') && word.length > 3 + minLength) {
    return word.slice(3);
  }
  
  // ===== DI- prefix =====
  // dimakan → makan, dibeli → beli
  if (word.startsWith('di') && word.length > 2 + minLength) {
    return word.slice(2);
  }
  
  // ===== KE- prefix =====
  // ketua → tua
  if (word.startsWith('ke') && word.length > 2 + minLength) {
    return word.slice(2);
  }
  
  // ===== SE- prefix =====
  // sebuah → buah
  if (word.startsWith('se') && word.length > 2 + minLength) {
    return word.slice(2);
  }
  
  return word;
}

/**
 * Full Indonesian stemming - Nazief-Adriani simplified
 * Order: particles → possessive → derivational suffix → prefix
 */
export function stemWord(word: string): string {
  let stemmed = normalizeWord(word);
  
  // Skip very short words
  if (stemmed.length <= 3) {
    return stemmed;
  }
  
  // Step 1: Remove particles (-lah, -kah, -tah, -pun)
  stemmed = removeParticles(stemmed);
  
  // Step 2: Remove possessive pronouns (-ku, -mu, -nya)
  stemmed = removePossessive(stemmed);
  
  // Step 3: Remove derivational suffixes (-kan, -an, -i)
  stemmed = removeDerivationalSuffix(stemmed);
  
  // Step 4: Remove prefixes (with nasalization restoration)
  stemmed = removePrefix(stemmed);
  
  return stemmed;
}

/**
 * Full preprocessing: normalize + stem
 */
export function preprocessWord(word: string): PreprocessResult {
  const original = word.trim();
  const normalized = normalizeWord(word);
  const stem = stemWord(word);
  
  return { original, normalized, stem };
}

// ============================================================
// DEDUPLICATION
// ============================================================

/**
 * Check if two words are similar (same stem or very similar)
 */
export function areSimilar(word1: string, word2: string): boolean {
  const stem1 = stemWord(word1);
  const stem2 = stemWord(word2);
  
  // Same stem = similar
  if (stem1 === stem2) return true;
  
  // Levenshtein distance for very close matches
  if (levenshteinDistance(stem1, stem2) <= 1) return true;
  
  return false;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Remove duplicates from array (case-insensitive)
 */
export function deduplicateWords(words: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  
  for (const word of words) {
    const normalized = normalizeWord(word);
    if (!seen.has(normalized) && normalized.length > 0) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  
  return result;
}

// ============================================================
// ADD WORD WITH VALIDATION
// ============================================================

/**
 * Process and validate words to add to a dictionary
 * 
 * @param newWords - Comma-separated string or array of words
 * @param targetDictionary - The dictionary to add to (red or yellow)
 * @param otherDictionary - The other dictionary to check for conflicts
 * @returns AddWordResult with success status and details
 */
export function processWordsToAdd(
  newWords: string | string[],
  targetDictionary: string[],
  otherDictionary: string[]
): AddWordResult {
  const result: AddWordResult = {
    success: false,
    added: [],
    rejected: [],
    warnings: [],
    errors: []
  };
  
  // Parse input
  const wordsArray = typeof newWords === 'string'
    ? newWords.split(',').map(w => w.trim()).filter(w => w.length > 0)
    : newWords;
  
  if (wordsArray.length === 0) {
    result.errors.push('Tidak ada kata yang valid untuk ditambahkan');
    return result;
  }
  
  // Normalize existing dictionaries
  const targetNormalized = targetDictionary.map(normalizeWord);
  const otherNormalized = otherDictionary.map(normalizeWord);
  const targetStems = targetDictionary.map(stemWord);
  
  for (const word of wordsArray) {
    const { normalized, stem } = preprocessWord(word);
    
    if (normalized.length === 0) {
      result.rejected.push(word);
      continue;
    }
    
    // Check exact duplicate in target
    if (targetNormalized.includes(normalized)) {
      result.rejected.push(normalized);
      result.errors.push(`"${normalized}" sudah ada di dictionary ini`);
      continue;
    }
    
    // Check exact duplicate in other dictionary
    if (otherNormalized.includes(normalized)) {
      result.rejected.push(normalized);
      result.errors.push(`"${normalized}" sudah ada di dictionary lain`);
      continue;
    }
    
    // Check for similar words (same stem) - warning only
    const similarInTarget = targetDictionary.find(w => stemWord(w) === stem && normalizeWord(w) !== normalized);
    if (similarInTarget) {
      result.warnings.push(`"${normalized}" mirip dengan "${similarInTarget}" yang sudah ada`);
    }
    
    // Add to result
    result.added.push(normalized);
    targetNormalized.push(normalized);
    targetStems.push(stem);
  }
  
  result.success = result.added.length > 0;
  return result;
}

// ============================================================
// DICTIONARY VALIDATION
// ============================================================

/**
 * Validate a dictionary for internal consistency
 */
export function validateDictionary(dictionary: string[]): DictionaryValidation {
  const result: DictionaryValidation = {
    isValid: true,
    duplicates: [],
    similarWords: [],
    warnings: []
  };
  
  const seen = new Map<string, string>(); // normalized -> original
  const stems = new Map<string, string>(); // stem -> first word with that stem
  
  for (const word of dictionary) {
    const normalized = normalizeWord(word);
    const stem = stemWord(word);
    
    // Check for exact duplicates
    if (seen.has(normalized)) {
      result.duplicates.push(normalized);
      result.isValid = false;
    } else {
      seen.set(normalized, word);
    }
    
    // Check for similar words (same stem)
    if (stems.has(stem) && stems.get(stem) !== normalized) {
      result.similarWords.push({
        word: normalized,
        similarTo: stems.get(stem)!
      });
      result.warnings.push(`"${normalized}" mirip dengan "${stems.get(stem)}"`);
    } else {
      stems.set(stem, normalized);
    }
  }
  
  return result;
}

/**
 * Clean and normalize an entire dictionary
 */
export function cleanDictionary(dictionary: string[]): string[] {
  return deduplicateWords(dictionary.map(normalizeWord));
}

// ============================================================
// CROSS-DICTIONARY VALIDATION
// ============================================================

/**
 * Find conflicts between two dictionaries
 */
export function findDictionaryConflicts(
  redDictionary: string[],
  yellowDictionary: string[]
): { conflicts: string[]; warnings: string[] } {
  const redNormalized = new Set(redDictionary.map(normalizeWord));
  const redStems = new Set(redDictionary.map(stemWord));
  
  const conflicts: string[] = [];
  const warnings: string[] = [];
  
  for (const word of yellowDictionary) {
    const normalized = normalizeWord(word);
    const stem = stemWord(word);
    
    // Exact match = conflict
    if (redNormalized.has(normalized)) {
      conflicts.push(normalized);
    }
    // Same stem = warning
    else if (redStems.has(stem)) {
      warnings.push(`"${normalized}" di Yellow memiliki stem yang sama dengan kata di Red`);
    }
  }
  
  return { conflicts, warnings };
}

// ============================================================
// VERSION
// ============================================================

export const PREPROCESSOR_VERSION = "1.1.0" as const;
