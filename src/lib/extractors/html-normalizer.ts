/**
 * HTML Table Normalizer
 * 
 * Resolves rowspan/colspan BEFORE AI extraction.
 * AI should NEVER see empty cells that are actually filled via rowspan.
 * 
 * This is a PRE-PROCESSOR, not a post-processor.
 */

/**
 * Header patterns to identify column types
 */
const HEADER_PATTERNS: Record<string, RegExp[]> = {
  min_deposit: [/min.*deposit/i, /deposit.*min/i, /minimal.*deposit/i],
  turnover: [/turnover/i, /^to$/i, /turn.*over/i],
  max_bonus: [/max.*bonus/i, /bonus.*max/i, /maksimal.*bonus/i],
  provider: [/provider/i, /produk/i],
  game_type: [/kategori/i, /jenis.*game/i, /game.*type/i],
  payout: [/dibagikan/i, /payout/i, /pembagian/i],
};

export interface NormalizedTable {
  headers: string[];
  rows: string[][];
  columnTypes: Map<number, string>; // column index → field type
}

/**
 * Normalize HTML by resolving all rowspan/colspan in tables
 * Returns HTML string with expanded tables (no rowspan/colspan attributes)
 */
export const normalizeHtmlTables = (html: string): string => {
  // Parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = doc.querySelectorAll('table');

  tables.forEach((table) => {
    const normalized = normalizeTable(table);
    replaceTableWithNormalized(table, normalized);
  });

  return doc.documentElement.outerHTML;
};

/**
 * Normalize a single table - expand all rowspan/colspan
 */
const normalizeTable = (table: Element): NormalizedTable => {
  const rows = table.querySelectorAll('tr');
  const headers: string[] = [];
  const dataRows: string[][] = [];
  const columnTypes = new Map<number, string>();

  // Track active rowspans: Map<colIndex, { value: string, remaining: number }>
  const rowspanTracker = new Map<number, { value: string; remaining: number }>();

  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('th, td');
    const rowData: string[] = [];
    let cellIndex = 0;
    let colPosition = 0;

    // Determine max columns needed (account for existing cells + active rowspans)
    const maxCols = Math.max(cells.length + rowspanTracker.size, headers.length || 0);

    // Process each column position
    while (colPosition < maxCols || cellIndex < cells.length) {
      // Check for active rowspan at this column
      if (rowspanTracker.has(colPosition)) {
        const tracker = rowspanTracker.get(colPosition)!;
        rowData.push(tracker.value);
        tracker.remaining--;

        if (tracker.remaining <= 0) {
          rowspanTracker.delete(colPosition);
        }
        colPosition++;
        continue;
      }

      // Get actual cell if available
      if (cellIndex >= cells.length) {
        colPosition++;
        continue;
      }

      const cell = cells[cellIndex];
      const cellValue = cleanCellValue(cell.textContent || '');
      const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);

      // Handle colspan - same value across multiple columns
      for (let c = 0; c < colspan; c++) {
        rowData.push(cellValue);

        // Track rowspan for future rows
        if (rowspan > 1) {
          rowspanTracker.set(colPosition, {
            value: cellValue,
            remaining: rowspan - 1,
          });
        }
        colPosition++;
      }

      cellIndex++;
    }

    // First row with th = headers
    const isHeaderRow = row.querySelector('th') !== null && rowIndex === 0;
    if (isHeaderRow) {
      headers.push(...rowData);
      // Identify column types
      rowData.forEach((header, idx) => {
        const fieldType = identifyColumnType(header);
        if (fieldType) {
          columnTypes.set(idx, fieldType);
        }
      });
    } else if (rowData.length > 0 && rowData.some((v) => v.trim() !== '')) {
      dataRows.push(rowData);
    }
  });

  return { headers, rows: dataRows, columnTypes };
};

/**
 * Replace original table element with normalized version
 */
const replaceTableWithNormalized = (
  originalTable: Element,
  normalized: NormalizedTable
): void => {
  const { headers, rows } = normalized;

  // Build new table HTML without rowspan/colspan
  let newTableHtml = '<table>';

  // Header row
  if (headers.length > 0) {
    newTableHtml += '<thead><tr>';
    headers.forEach((h) => {
      newTableHtml += `<th>${escapeHtml(h)}</th>`;
    });
    newTableHtml += '</tr></thead>';
  }

  // Data rows
  newTableHtml += '<tbody>';
  rows.forEach((row) => {
    newTableHtml += '<tr>';
    row.forEach((cell) => {
      newTableHtml += `<td>${escapeHtml(cell)}</td>`;
    });
    newTableHtml += '</tr>';
  });
  newTableHtml += '</tbody></table>';

  // Replace in DOM
  originalTable.outerHTML = newTableHtml;
};

/**
 * Identify column type from header text
 */
const identifyColumnType = (header: string): string | null => {
  const normalized = header.toLowerCase().trim();

  for (const [fieldType, patterns] of Object.entries(HEADER_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return fieldType;
      }
    }
  }

  return null;
};

/**
 * Clean cell value
 */
const cleanCellValue = (value: string): string => {
  return value.replace(/\s+/g, ' ').replace(/\n/g, ' ').trim();
};

/**
 * Escape HTML special characters
 */
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Check if HTML contains tables with rowspan
 */
export const hasRowspanTables = (html: string): boolean => {
  return /rowspan\s*=\s*["']?\d+/i.test(html);
};

/**
 * Check if HTML contains tables with colspan
 */
export const hasColspanTables = (html: string): boolean => {
  return /colspan\s*=\s*["']?\d+/i.test(html);
};

/**
 * Check if HTML needs normalization (has rowspan or colspan)
 */
export const needsNormalization = (html: string): boolean => {
  return hasRowspanTables(html) || hasColspanTables(html);
};
