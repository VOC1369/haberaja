/**
 * Table Parser with Rowspan/Colspan Support
 * 
 * Correctly handles HTML tables where cells span multiple rows/columns.
 * Common in promo tables where min_deposit is shared across variants.
 */

import { isPropagatableField } from './field-rules';

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  hasRowspan: boolean; // Flag for debugging/logging
}

interface RowspanTracker {
  value: string;
  remaining: number;
  columnIndex: number;
}

/**
 * Parse HTML table with full rowspan/colspan support
 */
export const parseTableWithRowspan = (tableHtml: string): ParsedTable => {
  // Use DOMParser for browser
  const parser = new DOMParser();
  const doc = parser.parseFromString(tableHtml, 'text/html');
  const table = doc.querySelector('table');

  if (!table) {
    return { headers: [], rows: [], hasRowspan: false };
  }

  const allRows = table.querySelectorAll('tr');
  const headers: string[] = [];
  const dataRows: string[][] = [];
  
  // Track active rowspans across rows
  const activeRowspans: Map<number, RowspanTracker> = new Map();
  let hasRowspan = false;

  allRows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('th, td');
    const rowData: string[] = [];
    let cellIndex = 0;
    let colPosition = 0;

    // Process each column position
    while (cellIndex < cells.length || activeRowspans.size > 0) {
      // Check for active rowspan at this column
      if (activeRowspans.has(colPosition)) {
        const tracker = activeRowspans.get(colPosition)!;
        rowData.push(tracker.value);
        tracker.remaining--;

        if (tracker.remaining <= 0) {
          activeRowspans.delete(colPosition);
        }
        colPosition++;
        continue;
      }

      // Get actual cell if available
      if (cellIndex >= cells.length) break;
      
      const cell = cells[cellIndex];
      const cellValue = cleanCellValue(cell.textContent || '');
      const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);

      // Track if table uses rowspan (for logging)
      if (rowspan > 1) hasRowspan = true;

      // Handle colspan - same value across multiple columns
      for (let c = 0; c < colspan; c++) {
        rowData.push(cellValue);

        // Track rowspan for future rows
        if (rowspan > 1) {
          activeRowspans.set(colPosition, {
            value: cellValue,
            remaining: rowspan - 1,
            columnIndex: colPosition,
          });
        }
        colPosition++;
      }

      cellIndex++;
    }

    // Categorize row
    const isHeaderRow = row.querySelector('th') !== null && rowIndex === 0;
    if (isHeaderRow) {
      headers.push(...rowData);
    } else if (rowData.length > 0 && rowData.some(v => v.trim() !== '')) {
      dataRows.push(rowData);
    }
  });

  return { headers, rows: dataRows, hasRowspan };
};

/**
 * Clean cell value - remove extra whitespace, normalize
 */
const cleanCellValue = (value: string): string => {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
};

/**
 * Apply shared values to variants (FIELD-AWARE)
 * Only propagates values for fields in PROPAGATABLE_FIELDS
 */
export const applySharedValues = <T extends Record<string, unknown>>(
  variants: T[],
  sharedValues: Record<string, unknown>,
  options: { trackSource?: boolean } = {}
): T[] => {
  const { trackSource = true } = options;

  return variants.map((variant) => {
    const updated = { ...variant };

    for (const [field, value] of Object.entries(sharedValues)) {
      // SAFETY CHECK: Only propagate allowed fields
      if (!isPropagatableField(field)) {
        console.warn(
          `[TableParser] Blocked propagation of variant-specific field: ${field}`
        );
        continue;
      }

      // Only apply if variant doesn't have its own value
      const currentValue = updated[field];
      const isEmpty = 
        currentValue === null || 
        currentValue === undefined || 
        currentValue === '' || 
        currentValue === '-';

      if (isEmpty && value !== null && value !== undefined) {
        (updated as Record<string, unknown>)[field] = value;
        
        // Track source for debugging & AI reasoning
        if (trackSource) {
          (updated as Record<string, unknown>)[`${field}_source`] = 'propagated_from_rowspan';
        }
      }
    }

    return updated;
  });
};

/**
 * Map table headers to schema fields
 * Handles Indonesian variations
 */
export const mapHeaderToField = (header: string): string | null => {
  const normalized = header.toLowerCase().trim();
  
  const HEADER_MAP: Record<string, string> = {
    // Min deposit variations
    'min deposit': 'minimum_base',
    'minimal deposit': 'minimum_base',
    'deposit minimum': 'minimum_base',
    'min depo': 'minimum_base',
    'min. dp': 'minimum_base',
    'min dp': 'minimum_base',
    'syarat deposit': 'minimum_base',
    'minimal dp': 'minimum_base',
    
    // Max bonus variations
    'max bonus': 'max_bonus',
    'maksimal bonus': 'max_bonus',
    'maks bonus': 'max_bonus',
    'max (rp)': 'max_bonus',
    'max bonus (rp)': 'max_bonus',
    'max. bonus': 'max_bonus',
    
    // Turnover variations (CRITICAL for Rollingan/Cashback)
    'turnover': 'turnover_rule',
    'to': 'turnover_rule',
    'syarat to': 'turnover_rule',
    'minimal turnover': 'turnover_rule',
    'min turnover': 'turnover_rule',
    'minimum turnover': 'turnover_rule',
    'syarat turnover': 'turnover_rule',
    'min to': 'turnover_rule',
    'minimal to': 'turnover_rule',
    
    // Game type variations
    'kategori': 'game_types',
    'jenis game': 'game_types',
    'game': 'game_types',
    'produk': 'game_types',
    
    // Provider variations
    'provider': 'game_providers',
    'penyedia': 'game_providers',
    
    // Payout variations
    'dibagikan': 'payout_direction',
    'pembagian': 'payout_direction',
    
    // Variant name variations
    'kode promosi': 'sub_name',
    'nama promo': 'sub_name',
    'varian': 'sub_name',
    'bonus': 'sub_name',
  };

  return HEADER_MAP[normalized] || null;
};

/**
 * Extract tables from HTML content
 */
export const extractTablesFromHtml = (html: string): string[] => {
  const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
  return html.match(tableRegex) || [];
};

/**
 * Parse numeric value from Indonesian currency format
 * e.g., "Rp 50.000" -> 50000, "1jt" -> 1000000
 */
export const parseNumericValue = (value: string): number | null => {
  if (!value || value === '-' || value.toLowerCase() === 'unlimited') {
    return null;
  }

  // Clean the string
  let cleaned = value
    .replace(/rp\.?\s*/gi, '')
    .replace(/\s/g, '')
    .replace(/,/g, '.');

  // Handle "jt" (juta = million)
  if (/jt|juta/i.test(cleaned)) {
    const num = parseFloat(cleaned.replace(/jt|juta/gi, ''));
    return isNaN(num) ? null : num * 1000000;
  }

  // Handle "rb" (ribu = thousand)
  if (/rb|ribu/i.test(cleaned)) {
    const num = parseFloat(cleaned.replace(/rb|ribu/gi, ''));
    return isNaN(num) ? null : num * 1000;
  }

  // Handle "x" suffix for turnover
  if (/x$/i.test(cleaned)) {
    const num = parseFloat(cleaned.replace(/x$/i, ''));
    return isNaN(num) ? null : num;
  }

  // Handle standard numeric with dots as thousand separators
  cleaned = cleaned.replace(/\./g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};
