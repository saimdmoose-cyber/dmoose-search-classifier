import Papa from 'papaparse';

/**
 * All known column name variations from Amazon SP Search Term Reports.
 * Maps every known variation (lowercase) to our internal field name.
 */
const COLUMN_MAP_LOWER = {
  // Search Term — all known column names across Amazon report types
  'customer search term': 'searchTerm',
  'search term': 'searchTerm',
  'search terms': 'searchTerm',
  'query': 'searchTerm',
  'search query': 'searchTerm',
  'matched product': 'searchTerm',           // Campaign-level SP report
  'matched product (search term)': 'searchTerm',
  // Impressions
  'impressions': 'impressions',
  'impr.': 'impressions',
  'impr': 'impressions',
  // Clicks
  'clicks': 'clicks',
  // Spend / Cost
  'spend': 'spend',
  'cost': 'spend',
  'total spend': 'spend',
  'total cost': 'spend',
  'total cost (usd)': 'spend',
  'amount spent': 'spend',
  // Sales
  '7 day total sales': 'sales',
  '7 day total sales ': 'sales',
  '14 day total sales': 'sales',
  'sales': 'sales',
  'total sales': 'sales',
  '7 day total sales(?)': 'sales',
  'sales (usd)': 'sales',
  // Orders / Purchases
  '7 day total orders (#)': 'orders',
  '7 day total orders': 'orders',
  '14 day total orders (#)': 'orders',
  '14 day total orders': 'orders',
  'orders': 'orders',
  'total orders': 'orders',
  'purchases': 'orders',
  // Units
  '7 day total units (#)': 'units',
  '7 day total units': 'units',
  '14 day total units (#)': 'units',
  'units': 'units',
  // ACOS / ROAS
  'total advertising cost of sales (acos)': 'acos',
  'total advertising cost of sales(acos)': 'acos',
  'acos': 'acos',
  'roas': 'roas',
  // Campaign / Ad Group NAMES
  'campaign name': 'campaign',
  'campaign name (informational only)': 'campaign',
  'ad group name': 'adGroup',
  'ad group name (informational only)': 'adGroup',
  // Campaign / Ad Group IDs (from bulk file)
  'campaign id': 'campaignId',
  'ad group id': 'adGroupId',
  // Keyword / Targeting IDs
  'keyword id': 'keywordId',
  'keyword text': 'keywordText',
  'product targeting id': 'productTargetingId',
  'product targeting expression': 'productTargeting',
  // Targeting / Match Type / Product Targets
  'targeting': 'targeting',
  'match type': 'matchType',
  'keyword': 'keyword',
  'product targets': 'targeting',
  'added as': 'addedAs',
  // CTR / CPC
  'click-thru rate (ctr)': 'ctr',
  'click-through rate': 'ctr',
  'ctr': 'ctr',
  'cost per click (cpc)': 'cpc',
  'cpc': 'cpc',
  'cpc (usd)': 'cpc',
  // Purchase rate / CVR / Conversions
  'purchase rate': 'purchaseRate',
  'conversions': 'conversions',
  // Target bid / Campaign bid
  'target bid (usd)': 'targetBid',
  'campaign bid': 'campaignBid',
  'bid': 'bid',
  // Portfolio / State
  'portfolio name': 'portfolioName',
  'state': 'state',
};

function cleanCurrency(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/[$,%\s"']/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalize headers using case-insensitive matching.
 * Also strips BOM, quotes, and extra whitespace.
 */
function normalizeHeaders(headers) {
  const mapping = {};
  for (const header of headers) {
    const cleaned = String(header).replace(/^\uFEFF/, '').replace(/^["']+|["']+$/g, '').trim();
    const lower = cleaned.toLowerCase();

    // Direct match
    if (COLUMN_MAP_LOWER[lower]) {
      mapping[header] = COLUMN_MAP_LOWER[lower];
      continue;
    }

    // Fuzzy match: check if any known key is contained in the header or vice versa
    for (const [key, value] of Object.entries(COLUMN_MAP_LOWER)) {
      if (lower.includes(key) || key.includes(lower)) {
        mapping[header] = value;
        break;
      }
    }
  }
  return mapping;
}

/**
 * Try to find the actual header row in the CSV text.
 * Amazon reports often have 1-3 metadata rows before headers.
 */
function findHeaderRow(text) {
  let cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/);
  const searchTermIndicators = ['customer search term', 'search term', 'search query', 'query', 'matched product'];
  const otherIndicators = ['impressions', 'clicks', 'spend', 'cost', 'orders', 'sales', 'purchases', 'total cost'];

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const lineLower = lines[i].toLowerCase();
    const hasSearchTerm = searchTermIndicators.some(ind => lineLower.includes(ind));
    const hasMetric = otherIndicators.some(ind => lineLower.includes(ind));
    if (hasSearchTerm && hasMetric) {
      return { text: lines.slice(i).join('\n'), skippedRows: i };
    }
  }
  return { text: cleaned, skippedRows: 0 };
}

/**
 * Load SheetJS (xlsx) library dynamically from CDN.
 */
let xlsxLib = null;
async function loadXLSX() {
  if (xlsxLib) return xlsxLib;
  return new Promise((resolve, reject) => {
    if (window.XLSX) {
      xlsxLib = window.XLSX;
      resolve(xlsxLib);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    script.onload = () => {
      xlsxLib = window.XLSX;
      resolve(xlsxLib);
    };
    script.onerror = () => reject(new Error('Failed to load XLSX library from CDN'));
    document.head.appendChild(script);
  });
}

/**
 * Parse an XLSX file into an array of row objects.
 * For Amazon BULK files (multi-sheet), finds the "SP Search Term Report" sheet.
 * For single-sheet files, uses the first sheet.
 */
async function parseXLSXFile(file) {
  const XLSX = await loadXLSX();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        console.log('XLSX sheets found:', workbook.SheetNames);

        // For Amazon bulk files: prefer "SP Search Term Report" sheet
        const searchTermSheetNames = [
          'SP Search Term Report',
          'Search Term Report',
          'Sponsored Products Search Term',
        ];

        let targetSheet = null;
        let targetSheetName = '';

        for (const name of searchTermSheetNames) {
          if (workbook.SheetNames.includes(name)) {
            targetSheet = workbook.Sheets[name];
            targetSheetName = name;
            break;
          }
        }

        // If no search term sheet found, use first sheet
        if (!targetSheet) {
          targetSheetName = workbook.SheetNames[0];
          targetSheet = workbook.Sheets[targetSheetName];
        }

        console.log(`Using sheet: "${targetSheetName}"`);

        if (!targetSheet) {
          reject(new Error('No sheets found in the Excel file.'));
          return;
        }

        // Get raw data as array of arrays
        const rawData = XLSX.utils.sheet_to_json(targetSheet, { header: 1, defval: '' });

        if (rawData.length === 0) {
          reject(new Error('Excel sheet is empty.'));
          return;
        }

        // Find the header row
        const searchTermIndicators = ['customer search term', 'search term', 'search query', 'query', 'matched product'];
        const otherIndicators = ['impressions', 'clicks', 'spend', 'cost', 'orders', 'sales', 'purchases', 'total cost'];
        let headerRowIndex = -1;

        for (let i = 0; i < Math.min(rawData.length, 15); i++) {
          const rowLower = rawData[i].map(c => String(c).toLowerCase().trim());
          const hasSearchTerm = searchTermIndicators.some(ind =>
            rowLower.some(cell => cell.includes(ind))
          );
          const hasMetric = otherIndicators.some(ind =>
            rowLower.some(cell => cell.includes(ind))
          );
          if (hasSearchTerm && hasMetric) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          headerRowIndex = 0;
        }

        console.log(`XLSX: Found header row at index ${headerRowIndex}`);

        const headers = rawData[headerRowIndex].map(h => String(h).trim());
        console.log('XLSX headers:', headers);

        // Convert remaining rows to objects
        const rows = [];
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          const rowData = rawData[i];
          if (!rowData || rowData.every(cell => cell === '' || cell === null || cell === undefined)) continue;
          const obj = {};
          for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = rowData[j] !== undefined ? rowData[j] : '';
          }
          rows.push(obj);
        }

        resolve({ headers, rows });
      } catch (err) {
        reject(new Error('Failed to parse Excel file: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read Excel file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Process parsed rows (from CSV or XLSX) into our standard format.
 */
function processRows(headers, rawRows) {
  const headerMap = normalizeHeaders(headers);
  console.log('Mapped headers:', headerMap);

  if (!Object.values(headerMap).includes('searchTerm')) {
    throw new Error(
      `Could not find a Search Term column.\n\n` +
      `Headers found: ${headers.join(', ')}\n\n` +
      `Expected one of: "Customer Search Term", "Search Term", "Matched product", "Query"\n\n` +
      `Tip: Make sure you're uploading an Amazon Sponsored Products Search Term Report.`
    );
  }

  // Detect if ACOS values are decimals (0.2683) vs percentages (26.83)
  const hasAcos = Object.values(headerMap).includes('acos');
  let acosIsDecimal = false;
  if (hasAcos) {
    const sampleAcos = rawRows.slice(0, 20)
      .map(row => {
        const acosKey = Object.keys(headerMap).find(k => headerMap[k] === 'acos');
        return parseFloat(String(row[acosKey] || '0').replace(/[$,%\s"']/g, ''));
      })
      .filter(v => v > 0);
    if (sampleAcos.length > 0 && sampleAcos.every(v => v < 2)) {
      acosIsDecimal = true;
      console.log('Detected ACOS values in decimal format, converting to percentage');
    }
  }

  const rows = rawRows
    .map((row, index) => {
      const mapped = { _raw: row, _index: index };
      for (const [original, normalized] of Object.entries(headerMap)) {
        mapped[normalized] = row[original];
      }
      return mapped;
    })
    .filter(row => {
      if (!row.searchTerm || String(row.searchTerm).trim() === '') return false;
      const term = String(row.searchTerm).trim().toLowerCase();
      if (term === 'total' || term === 'totals' || term.startsWith('total -')) return false;
      return true;
    })
    .map(row => ({
      ...row,
      searchTerm: String(row.searchTerm).replace(/^["']+|["']+$/g, '').trim(),
      impressions: cleanCurrency(row.impressions),
      clicks: cleanCurrency(row.clicks),
      spend: cleanCurrency(row.spend),
      sales: cleanCurrency(row.sales),
      orders: cleanCurrency(row.orders),
      acos: cleanCurrency(row.acos),
      // Preserve IDs as strings (don't clean as currency!)
      campaignId: row.campaignId ? String(row.campaignId).trim() : '',
      adGroupId: row.adGroupId ? String(row.adGroupId).trim() : '',
      campaign: row.campaign ? String(row.campaign).trim() : '',
      adGroup: row.adGroup ? String(row.adGroup).trim() : '',
      matchType: row.matchType ? String(row.matchType).trim() : '',
      portfolioName: row.portfolioName ? String(row.portfolioName).trim() : '',
    }));

  // Compute / normalize ACOS and CVR
  for (const row of rows) {
    if (acosIsDecimal && row.acos > 0) {
      row.acos = parseFloat((row.acos * 100).toFixed(2));
    }

    if (row.acos === 0 && row.sales > 0 && row.spend > 0) {
      row.acos = parseFloat(((row.spend / row.sales) * 100).toFixed(2));
    }

    if (row.purchaseRate && cleanCurrency(row.purchaseRate) > 0) {
      const pr = cleanCurrency(row.purchaseRate);
      row.cvr = pr < 2 ? parseFloat((pr * 100).toFixed(2)) : parseFloat(pr.toFixed(2));
    } else {
      row.cvr = row.clicks > 0
        ? parseFloat(((row.orders / row.clicks) * 100).toFixed(2))
        : 0;
    }
  }

  if (rows.length === 0) {
    throw new Error('File parsed but no valid search term rows found. Check that your file has data rows below the headers.');
  }

  return rows;
}

/**
 * Check if a file is an Excel file based on extension or MIME type.
 */
function isExcelFile(file) {
  const name = file.name.toLowerCase();
  return name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm') ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel';
}

/**
 * Main parse function — handles CSV text, CSV files, and XLSX files.
 */
export async function parseCSV(input) {
  if (input instanceof File && isExcelFile(input)) {
    console.log('Detected Excel file, loading XLSX parser...');
    const { headers, rows } = await parseXLSXFile(input);
    return processRows(headers, rows);
  }

  return new Promise((resolve, reject) => {
    const doParse = (csvText) => {
      const { text: cleanedText, skippedRows } = findHeaderRow(csvText);
      if (skippedRows > 0) {
        console.log(`Skipped ${skippedRows} metadata row(s) at top of CSV`);
      }

      Papa.parse(cleanedText, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
        complete(results) {
          if (results.errors.length > 0 && results.data.length === 0) {
            reject(new Error('Failed to parse CSV: ' + results.errors[0].message));
            return;
          }
          try {
            const headers = results.meta.fields || [];
            console.log('Detected CSV headers:', headers);
            const rows = processRows(headers, results.data);
            resolve(rows);
          } catch (err) {
            reject(err);
          }
        },
        error(err) {
          reject(new Error('CSV parse error: ' + err.message));
        },
      });
    };

    if (input instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => doParse(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(input);
    } else if (typeof input === 'string') {
      doParse(input);
    } else {
      reject(new Error('Invalid input: expected File or string'));
    }
  });
}

export function exportToCSV(rows, columns) {
  const csv = Papa.unparse(rows.map(row => {
    const obj = {};
    for (const col of columns) {
      obj[col.label] = row[col.key] !== undefined ? row[col.key] : '';
    }
    return obj;
  }));
  return csv;
}

/**
 * Export negatives as XLSX matching EXACT Amazon Sponsored Products Bulk Upload format.
 *
 * Amazon bulk file columns (from actual SP Search Term Report / Campaigns sheet):
 *   Product | Campaign ID | Ad Group ID | Keyword Id | Product Targeting ID |
 *   Campaign Name (Informational only) | Ad Group Name (Informational only) |
 *   Portfolio Name | State | Campaign Bid | Bid | Keyword Text | Match Type |
 *   Product Targeting Expression | ... | Customer Search Term | Impressions |
 *   Clicks | Click-through Rate | Spend | Sales | Orders | Units | Conversions
 *
 * For NEGATIVE KEYWORD creation, the Sponsored Products Campaigns sheet format:
 *   Product | Entity | Operation | Campaign Id | Ad Group Id | Portfolio Id |
 *   Campaign Name (Informational only) | Ad Group Name (Informational only) |
 *   Start Date | End Date | Targeting Type | State | Daily Budget | SKU | ASIN |
 *   Ad Group Default Bid | Bid | Keyword or Product Targeting Expression | Match Type
 */
export async function exportNegativesAsXLSX(rows, level = 'campaign', matchType = 'negativeExact') {
  const XLSX = await loadXLSX();

  const entity = level === 'campaign'
    ? 'Campaign Negative Keyword'
    : 'Negative Keyword';

  // Build header row matching Amazon's exact format
  const headers = [
    'Product',
    'Entity',
    'Operation',
    'Campaign Id',
    'Ad Group Id',
    'Portfolio Id',
    'Campaign Name (Informational only)',
    'Ad Group Name (Informational only)',
    'Start Date',
    'End Date',
    'Targeting Type',
    'State',
    'Daily Budget',
    'SKU',
    'ASIN',
    'Ad Group Default Bid',
    'Bid',
    'Keyword or Product Targeting Expression',
    'Match Type',
  ];

  // Build data rows
  const dataRows = rows.map(row => [
    'Sponsored Products',                                    // Product
    entity,                                                   // Entity
    'create',                                                 // Operation
    row.campaignId || '',                                     // Campaign Id
    level === 'adgroup' ? (row.adGroupId || '') : '',        // Ad Group Id
    '',                                                       // Portfolio Id
    row.campaign || '',                                       // Campaign Name
    level === 'adgroup' ? (row.adGroup || '') : '',          // Ad Group Name
    '',                                                       // Start Date
    '',                                                       // End Date
    '',                                                       // Targeting Type
    'enabled',                                                // State
    '',                                                       // Daily Budget
    '',                                                       // SKU
    '',                                                       // ASIN
    '',                                                       // Ad Group Default Bid
    '',                                                       // Bid
    row.searchTerm,                                           // Keyword or Product Targeting Expression
    matchType,                                                // Match Type
  ]);

  // Create workbook with proper sheet name
  const wb = XLSX.utils.book_new();
  const wsData = [headers, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 15) }));

  XLSX.utils.book_append_sheet(wb, ws, 'Sponsored Products Campaigns');

  // Generate binary
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Fallback: Export negatives as CSV (same format, just CSV instead of XLSX)
 */
export function exportNegativesForAmazon(rows, level = 'campaign', matchType = 'negativeExact') {
  const entity = level === 'campaign'
    ? 'Campaign Negative Keyword'
    : 'Negative Keyword';

  const amazonRows = rows.map(row => ({
    'Product': 'Sponsored Products',
    'Entity': entity,
    'Operation': 'create',
    'Campaign Id': row.campaignId || '',
    'Ad Group Id': level === 'adgroup' ? (row.adGroupId || '') : '',
    'Portfolio Id': '',
    'Campaign Name (Informational only)': row.campaign || '',
    'Ad Group Name (Informational only)': level === 'adgroup' ? (row.adGroup || '') : '',
    'Start Date': '',
    'End Date': '',
    'Targeting Type': '',
    'State': 'enabled',
    'Daily Budget': '',
    'SKU': '',
    'ASIN': '',
    'Ad Group Default Bid': '',
    'Bid': '',
    'Keyword or Product Targeting Expression': row.searchTerm,
    'Match Type': matchType,
  }));
  return Papa.unparse(amazonRows);
}
