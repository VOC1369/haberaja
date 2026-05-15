/**
 * EDIT COMMANDS - Strict Pattern Matching
 * 
 * CRITICAL: FAIL FAST — No LLM fallback, no fuzzy matching
 * 
 * Commands harus exact match pattern. Unknown = immediate reject.
 * Better reject 10 commands daripada salah execute 1 mutation.
 */

import type { ExtractedPromo, ExtractedPromoSubCategory } from '@/lib/voc-wolf-extractor';

// ============================================
// COMMAND PATTERNS (EXACT MATCH ONLY)
// ============================================

export const COMMAND_PATTERNS = {
  // Set field untuk semua varian: "set min deposit 50K semua varian"
  SET_ALL: /^set\s+(min\s*deposit|minimum|turnover|max\s*bonus|payout)\s+(.+?)\s+(semua|all)\s*(varian)?$/i,
  
  // Set field untuk varian specific: "set max bonus 1jt varian 1"
  SET_VARIAN: /^set\s+(min\s*deposit|minimum|turnover|max\s*bonus|payout)\s+(.+?)\s+varian\s*(\d+)$/i,
  
  // Ubah/ganti field varian: "ubah turnover varian 2 jadi 15x"
  UBAH: /^(ubah|ganti|change)\s+(turnover|min\s*deposit|max\s*bonus|payout)\s+varian\s*(\d+)\s+(jadi|=|ke|to)\s+(.+)$/i,
  
  // Hapus blacklist: "hapus blacklist varian 3" atau "hapus blacklist semua"
  HAPUS_BLACKLIST: /^(hapus|remove|clear)\s+blacklist\s+(varian\s*(\d+)|semua)$/i,
  
  // Tambah blacklist game: "tambah blacklist varian 1: HEROES, SPACEMAN"
  TAMBAH_BLACKLIST: /^(tambah|add)\s+blacklist\s+varian\s*(\d+)\s*[:\s]+(.+)$/i,
  
  // Set provider: "set provider varian 1: PG Soft, Pragmatic"
  SET_PROVIDER: /^set\s+provider\s+varian\s*(\d+)\s*[:\s]+(.+)$/i,
  
  // Set game type: "set game type varian 2: slot, casino"
  SET_GAME_TYPE: /^set\s+(game\s*type|jenis\s*game)\s+varian\s*(\d+)\s*[:\s]+(.+)$/i,
};

// ============================================
// TYPES
// ============================================

export type CommandType = 
  | 'set_all' 
  | 'set_varian' 
  | 'ubah' 
  | 'hapus_blacklist' 
  | 'tambah_blacklist' 
  | 'set_provider' 
  | 'set_game_type' 
  | 'unknown';

export interface EditCommand {
  type: CommandType;
  field?: string;
  value?: number | string | string[];
  varianIndex?: number | 'all';
  raw: string;
}

export interface CommandResult {
  success: boolean;
  data: ExtractedPromo;
  message: string;
}

// ============================================
// FIELD NAME NORMALIZATION
// ============================================

function normalizeFieldName(field: string): string {
  const mapping: Record<string, string> = {
    'min deposit': 'minimum_base',
    'min': 'minimum_base',
    'minimum': 'minimum_base',
    'turnover': 'turnover_rule',
    'to': 'turnover_rule',
    'max bonus': 'max_bonus',
    'maxbonus': 'max_bonus',
    'max': 'max_bonus',
    'payout': 'payout_direction',
  };
  return mapping[field.toLowerCase().trim()] || field;
}

// ============================================
// VALUE PARSING
// ============================================

function parseValue(val: string): number | string {
  const cleaned = val.trim().toLowerCase();
  
  // Handle payout direction
  if (['depan', 'before', 'front'].includes(cleaned)) {
    return 'depan';
  }
  if (['belakang', 'after', 'back'].includes(cleaned)) {
    return 'belakang';
  }
  
  // Handle turnover "15x" → number 15
  const turnoverMatch = cleaned.match(/^(\d+(?:\.\d+)?)x?$/i);
  if (turnoverMatch) {
    return parseFloat(turnoverMatch[1]);
  }
  
  // Handle currency shortcuts
  let numStr = cleaned;
  
  // "50K" → 50000
  if (numStr.endsWith('k')) {
    return parseFloat(numStr.replace('k', '')) * 1000;
  }
  
  // "1.5jt" or "1.5juta" → 1500000
  if (numStr.endsWith('jt') || numStr.endsWith('juta')) {
    return parseFloat(numStr.replace(/jt|juta/, '')) * 1000000;
  }
  
  // "50rb" or "50ribu" → 50000
  if (numStr.endsWith('rb') || numStr.endsWith('ribu')) {
    return parseFloat(numStr.replace(/rb|ribu/, '')) * 1000;
  }
  
  // Try parse as plain number
  const parsed = parseFloat(numStr.replace(/[^\d.]/g, ''));
  if (!isNaN(parsed)) {
    return parsed;
  }
  
  return val.trim();
}

// ============================================
// FORMAT VALUE FOR DISPLAY
// ============================================

export function formatValue(val: number | string | string[]): string {
  if (Array.isArray(val)) {
    return val.join(', ');
  }
  if (typeof val === 'number') {
    return `Rp ${val.toLocaleString('id-ID')}`;
  }
  if (val === 'depan') return 'DEPAN';
  if (val === 'belakang') return 'BELAKANG';
  return String(val);
}

// ============================================
// COMMAND PARSER (STRICT - FAIL FAST)
// ============================================

export function parseEditCommand(input: string): EditCommand {
  const normalized = input.trim();
  
  // SET ALL: "set min deposit 50K semua varian"
  let match = normalized.match(COMMAND_PATTERNS.SET_ALL);
  if (match) {
    return {
      type: 'set_all',
      field: normalizeFieldName(match[1]),
      value: parseValue(match[2]),
      varianIndex: 'all',
      raw: input,
    };
  }
  
  // SET VARIAN: "set max bonus 1jt varian 1"
  match = normalized.match(COMMAND_PATTERNS.SET_VARIAN);
  if (match) {
    return {
      type: 'set_varian',
      field: normalizeFieldName(match[1]),
      value: parseValue(match[2]),
      varianIndex: parseInt(match[3]) - 1, // Convert to 0-indexed
      raw: input,
    };
  }
  
  // UBAH: "ubah turnover varian 2 jadi 15x"
  match = normalized.match(COMMAND_PATTERNS.UBAH);
  if (match) {
    return {
      type: 'ubah',
      field: normalizeFieldName(match[2]),
      varianIndex: parseInt(match[3]) - 1,
      value: parseValue(match[5]),
      raw: input,
    };
  }
  
  // HAPUS BLACKLIST: "hapus blacklist varian 3" atau "hapus blacklist semua"
  match = normalized.match(COMMAND_PATTERNS.HAPUS_BLACKLIST);
  if (match) {
    const isAll = match[2].toLowerCase().includes('semua');
    return {
      type: 'hapus_blacklist',
      varianIndex: isAll ? 'all' : parseInt(match[3]) - 1,
      raw: input,
    };
  }
  
  // TAMBAH BLACKLIST: "tambah blacklist varian 1: HEROES, SPACEMAN"
  match = normalized.match(COMMAND_PATTERNS.TAMBAH_BLACKLIST);
  if (match) {
    const games = match[3].split(/[,;]/).map(g => g.trim()).filter(Boolean);
    return {
      type: 'tambah_blacklist',
      varianIndex: parseInt(match[2]) - 1,
      value: games,
      raw: input,
    };
  }
  
  // SET PROVIDER: "set provider varian 1: PG Soft, Pragmatic"
  match = normalized.match(COMMAND_PATTERNS.SET_PROVIDER);
  if (match) {
    const providers = match[2].split(/[,;]/).map(p => p.trim()).filter(Boolean);
    return {
      type: 'set_provider',
      varianIndex: parseInt(match[1]) - 1,
      value: providers,
      raw: input,
    };
  }
  
  // SET GAME TYPE: "set game type varian 2: slot, casino"
  match = normalized.match(COMMAND_PATTERNS.SET_GAME_TYPE);
  if (match) {
    const types = match[3].split(/[,;]/).map(t => t.trim().toLowerCase()).filter(Boolean);
    return {
      type: 'set_game_type',
      varianIndex: parseInt(match[2]) - 1,
      value: types,
      raw: input,
    };
  }
  
  // ❌ FAIL FAST — Unknown command
  return { type: 'unknown', raw: input };
}

// ============================================
// COMMAND EXECUTOR (STRICT - NO FALLBACK)
// ============================================

export function executeEditCommand(
  command: EditCommand,
  currentData: ExtractedPromo
): CommandResult {
  
  // ⚠️ FAIL FAST — Langsung reject jika unknown
  if (command.type === 'unknown') {
    return {
      success: false,
      data: currentData,
      message: `✗ Perintah tidak dikenali: "${command.raw}"

Contoh yang valid:
• set min deposit 50K semua varian
• ubah turnover varian 2 jadi 15x
• set max bonus 1jt varian 1
• hapus blacklist varian 3
• tambah blacklist varian 1: HEROES, SPACEMAN
• set payout depan semua varian`,
    };
  }
  
  // Deep clone to avoid mutation
  const newData = JSON.parse(JSON.stringify(currentData)) as ExtractedPromo;
  
  switch (command.type) {
    case 'set_all': {
      if (!newData.subcategories?.length) {
        return {
          success: false,
          data: currentData,
          message: `✗ Tidak ada subcategory untuk diubah`,
        };
      }
      
      const field = command.field!;
      const value = command.value!;
      
      newData.subcategories = newData.subcategories.map(sub => ({
        ...sub,
        [field]: value,
      }));
      
      return {
        success: true,
        data: newData,
        message: `✓ Set ${field} = ${formatValue(value)} untuk semua ${newData.subcategories.length} varian`,
      };
    }
    
    case 'set_varian':
    case 'ubah': {
      const idx = command.varianIndex as number;
      
      if (!newData.subcategories?.[idx]) {
        return {
          success: false,
          data: currentData,
          message: `✗ Varian ${idx + 1} tidak ditemukan (total: ${newData.subcategories?.length || 0} varian)`,
        };
      }
      
      const field = command.field!;
      const value = command.value!;
      
      newData.subcategories[idx] = {
        ...newData.subcategories[idx],
        [field]: value,
      };
      
      return {
        success: true,
        data: newData,
        message: `✓ Set ${field} = ${formatValue(value)} untuk varian ${idx + 1}`,
      };
    }
    
    case 'hapus_blacklist': {
      if (command.varianIndex === 'all') {
        newData.subcategories = newData.subcategories?.map(sub => ({
          ...sub,
          blacklist: {
            enabled: false,
            types: [],
            providers: [],
            games: [],
            rules: [],
          },
        })) || [];
        
        return {
          success: true,
          data: newData,
          message: `✓ Blacklist dihapus untuk semua varian`,
        };
      }
      
      const idx = command.varianIndex as number;
      if (!newData.subcategories?.[idx]) {
        return {
          success: false,
          data: currentData,
          message: `✗ Varian ${idx + 1} tidak ditemukan`,
        };
      }
      
      newData.subcategories[idx] = {
        ...newData.subcategories[idx],
        blacklist: {
          enabled: false,
          types: [],
          providers: [],
          games: [],
          rules: [],
        },
      };
      
      return {
        success: true,
        data: newData,
        message: `✓ Blacklist dihapus untuk varian ${idx + 1}`,
      };
    }
    
    case 'tambah_blacklist': {
      const idx = command.varianIndex as number;
      if (!newData.subcategories?.[idx]) {
        return {
          success: false,
          data: currentData,
          message: `✗ Varian ${idx + 1} tidak ditemukan`,
        };
      }
      
      const games = command.value as string[];
      const existing = newData.subcategories[idx].blacklist?.games || [];
      
      newData.subcategories[idx] = {
        ...newData.subcategories[idx],
        blacklist: {
          ...newData.subcategories[idx].blacklist,
          enabled: true,
          games: [...existing, ...games],
        },
      };
      
      return {
        success: true,
        data: newData,
        message: `✓ Tambah ${games.length} game ke blacklist varian ${idx + 1}: ${games.join(', ')}`,
      };
    }
    
    case 'set_provider': {
      const idx = command.varianIndex as number;
      if (!newData.subcategories?.[idx]) {
        return {
          success: false,
          data: currentData,
          message: `✗ Varian ${idx + 1} tidak ditemukan`,
        };
      }
      
      newData.subcategories[idx] = {
        ...newData.subcategories[idx],
        game_providers: command.value as string[],
      };
      
      return {
        success: true,
        data: newData,
        message: `✓ Set provider varian ${idx + 1}: ${(command.value as string[]).join(', ')}`,
      };
    }
    
    case 'set_game_type': {
      const idx = command.varianIndex as number;
      if (!newData.subcategories?.[idx]) {
        return {
          success: false,
          data: currentData,
          message: `✗ Varian ${idx + 1} tidak ditemukan`,
        };
      }
      
      newData.subcategories[idx] = {
        ...newData.subcategories[idx],
        game_types: command.value as string[],
      };
      
      return {
        success: true,
        data: newData,
        message: `✓ Set game type varian ${idx + 1}: ${(command.value as string[]).join(', ')}`,
      };
    }
    
    default:
      return {
        success: false,
        data: currentData,
        message: `✗ Perintah tidak dikenali`,
      };
  }
}

// ============================================
// COMMAND HELP TEXT
// ============================================

export const COMMAND_EXAMPLES = [
  'set min deposit 50K semua varian',
  'ubah turnover varian 2 jadi 15x',
  'set max bonus 1jt varian 1',
  'hapus blacklist varian 3',
  'tambah blacklist varian 1: HEROES, SPACEMAN',
  'set payout depan semua varian',
  'set provider varian 1: PG Soft, Pragmatic',
  'set game type varian 2: slot, casino',
];
