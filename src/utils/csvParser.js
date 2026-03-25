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
  'total cost': 'spend',                     // Campaign-level "Total cost (USD)"
  'total cost (usd)': 'spend',
  'amount spent': 'spend',
  // Sales
  '7 day total sales': 'sales',
  '7 day total sales ': 'sales',
  '14 day total sales': 'sales',
  'sales': 'sales',
  'total sales': 'sales',
  '7 day total sales(?)': 'sales',
  'sales (usd)': 'sales',                    // Campaign-level "Sales (USD)"
  // Orders / Purchases
  '7 day total orders (#)': 'orders',
  '7 day total orders': 'orders',
  '14 day total orders (#)': 'orders',
  '14 day total orders': 'orders',
  'orders': 'orders',
  'total orders': 'orders',
  'purchases': 'orders',                     // Campaign-level "Purchases"
  // Units
  '7 day total units (#)': 'units',
  '7 day total units': 'units',
  '14 day total units (#)': 'units',
  'units': 'units',
  // ACOS / ROAS
  'total advertising cost of sales (acos)': 'acos',
  'total advertising cost of sales(acos)': 'acos',
  'acos': 'acos',
  'roas': 'roas',                            // Campaign-level ROAS
  // Campaign / Ad Group
  'campaign name': 'campaign',
  'campaign': 'campaign',
  'ad group name': 'adGroup',
  'ad group': 'adGroup',
  // Targeting / Match Type / Product Targets
  'targeting': 'targeting',
  'match type': 'matchType',
  'keyword': 'keyword',
  'product targets': 'targeting',            // Campaign-level "Product targets"
  'added as': 'addedAs',                     // Campaign-level "Added as"
  // CTR / CPC
  'click-thru rate (ctr)': 'ctr',
  'ctr': 'ctr',
  'cost per click (cpc)': 'cpc',
  'cpc': 'cpc',
  'cpc (usd)': 'cpc',                        // Campaign-level "CPC (USD)"
  // Purchase rate / CVR
  'purchase rate': 'purchaseRate',            // Campaign-level
  // Target bid
  'target bid (usd)': 'targetBid',           // Campaign-level
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
    // Strip BOM, quotes, leading/trailing whitespace
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
 * This avoids needing npm install for xlsx support.
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
 * Parse an XLSX file into an array of row objects (like CSV rows).
 * Finds the header row automatically within the first 10 rows.
 */
async function parseXLSXFile(file) {
  const XLSX = await loadXLSX();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Use first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        if (!sheet) {
          reject(new Error('No sheets found in the Excel file.'));
          return;
        }

        // Get raw data as array of arrays
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (rawData.length === 0) {
          reject(new Error('Excel sheet is empty.'));
          return;
        }

        // Find the header row (search for row containing search term column)
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
          // Fallback: assume first row is headers
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
  // by checking if the report has ACOS values all < 1 (decimal format)
  const hasAcos = Object.values(headerMap).includes('acos');
  let acosIsDecimal = false;
  if (hasAcos) {
    const sampleAcos = rawRows.slice(0, 20)
      .map(row => {
        const acosKey = Object.keys(headerMap).find(k => headerMap[k] === 'acos');
        return parseFloat(String(row[acosKey] || '0').replace(/[$,%\s"']/g, ''));
      })
      .filter(v => v > 0);
    // If all non-zero ACOS values are < 2, they're decimals (e.g., 0.2683 = 26.83%)
    if (sampleAcos.length > 0 && sampleAcos.every(v => v < 2)) {
      acosIsDecimal = true;
      console.log('Detected ACOS values in decimal format (e.g., 0.27 = 27%), converting to percentage');
    }
  }

  // Also detect if CTR / Purchase Rate are decimals
  const hasCtr = Object.values(headerMap).includes('ctr');
  const hasPurchaseRate = Object.values(headerMap).includes('purchaseRate');

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
      campaign: row.campaign ? String(row.campaign).trim() : '',
      adGroup: row.adGroup ? String(row.adGroup).trim() : '',
      matchType: row.matchType ? String(row.matchType).trim() : 'Negative exact',
    }));

  // Compute / normalize ACOS and CVR
  for (const row of rows) {
    // Convert decimal ACOS to percentage (0.2683 → 26.83)
    if (acosIsDecimal && row.acos > 0) {
      row.acos = parseFloat((row.acos * 100).toFixed(2));
    }

    // If ACOS is still 0 but we have spend & sales, compute it
    if (row.acos === 0 && row.sales > 0 && row.spend > 0) {
      row.acos = parseFloat(((row.spend / row.sales) * 100).toFixed(2));
    }

    // CVR: use purchaseRate if available (campaign-level report), else compute
    if (row.purchaseRate && cleanCurrency(row.purchaseRate) > 0) {
      const pr = cleanCurrency(row.purchaseRate);
      // Purchase rate could be decimal (0.5 = 50%) or already percentage
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
  // XLSX file
  if (input instanceof File && isExcelFile(input)) {
    console.log('Detected Excel file, loading XLSX parser...');
    const { headers, rows } = await parseXLSXFile(input);
    return processRows(headers, rows);
  }

  // CSV file or text
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

export function exportNegativesForAmazon(rows) {
  const amazonRows = rows.map(row => ({
    'Campaign': row.campaign || 'YOUR_CAMPAIGN',
    'Ad Group': row.adGroup || 'YOUR_AD_GROUP',
    'Keyword': row.searchTerm,
    'Match Type': 'Negative exact',
    'Operation': 'create',
  }));
  return Papa.unparse(amazonRows);
}
