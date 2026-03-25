import { useState, useMemo } from 'react';
import { exportToCSV, exportNegativesForAmazon, exportNegativesAsXLSX } from '../utils/csvParser';

const TABLE_COLUMNS = [
  { key: 'searchTerm', label: 'Search Term', mono: true },
  { key: 'matchPct', label: 'Match %', numeric: true, pct: true },
  { key: 'impressions', label: 'Impr', numeric: true },
  { key: 'clicks', label: 'Clicks', numeric: true },
  { key: 'spend', label: 'Spend', numeric: true, dollar: true },
  { key: 'sales', label: 'Sales', numeric: true, dollar: true },
  { key: 'orders', label: 'Orders', numeric: true },
  { key: 'acos', label: 'ACOS', numeric: true, pct: true },
  { key: 'cvr', label: 'CVR', numeric: true, pct: true },
  { key: 'reason', label: 'Reason', wide: true },
];

function downloadFile(content, filename, type = 'text/csv') {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download failed:', err);
    alert('Download failed: ' + err.message);
  }
}

function NegativeExportPanel({ rows }) {
  const [level, setLevel] = useState('campaign');
  const [matchType, setMatchType] = useState('negativeExact');
  const [showPanel, setShowPanel] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportXLSX = async () => {
    try {
      setExporting(true);
      const blob = await exportNegativesAsXLSX(rows, level, matchType);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `amazon-${level}-negative-keywords-bulk-upload.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('XLSX export failed:', err);
      alert('XLSX export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = () => {
    const csv = exportNegativesForAmazon(rows, level, matchType);
    downloadFile(csv, `amazon-${level}-negative-keywords-bulk-upload.csv`);
  };

  const hasCampaignId = rows.some(r => r.campaignId && r.campaignId !== '');
  const hasCampaignName = rows.some(r => r.campaign && r.campaign !== '');

  return (
    <div>
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="px-4 py-2 bg-dm-crimson text-white text-sm font-bold uppercase tracking-wider hover:bg-red-700 transition-colors"
      >
        Export Negatives for Amazon Bulk Upload
      </button>

      {showPanel && (
        <div className="mt-3 p-4 bg-dm-black border border-dm-dark-gray space-y-3">
          <div className="text-xs text-dm-gray uppercase tracking-wider font-bold mb-2">Export Settings</div>

          {/* Negative Level */}
          <div className="flex items-center gap-4">
            <span className="text-xs text-dm-gray w-28">Negative Level:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="level"
                value="campaign"
                checked={level === 'campaign'}
                onChange={() => setLevel('campaign')}
                className="accent-dm-crimson"
              />
              <span className="text-sm text-white">Campaign Level</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="level"
                value="adgroup"
                checked={level === 'adgroup'}
                onChange={() => setLevel('adgroup')}
                className="accent-dm-crimson"
              />
              <span className="text-sm text-white">Ad Group Level</span>
            </label>
          </div>

          {/* Match Type */}
          <div className="flex items-center gap-4">
            <span className="text-xs text-dm-gray w-28">Match Type:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="matchType"
                value="negativeExact"
                checked={matchType === 'negativeExact'}
                onChange={() => setMatchType('negativeExact')}
                className="accent-dm-crimson"
              />
              <span className="text-sm text-white">Negative Exact</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="matchType"
                value="negativePhrase"
                checked={matchType === 'negativePhrase'}
                onChange={() => setMatchType('negativePhrase')}
                className="accent-dm-crimson"
              />
              <span className="text-sm text-white">Negative Phrase</span>
            </label>
          </div>

          {/* Data detection info */}
          <div className="text-xs space-y-1 border-t border-dm-dark-gray pt-2">
            {hasCampaignId ? (
              <p className="text-green-400">Campaign IDs detected - file is ready for direct Amazon upload.</p>
            ) : hasCampaignName ? (
              <p className="text-yellow-400">Campaign Names detected (no IDs). You may need to add Campaign Id column before uploading to Amazon.</p>
            ) : (
              <p className="text-red-400">No Campaign data found. You will need to add Campaign Id manually before uploading.</p>
            )}
            <p className="text-dm-gray">Format: Amazon Sponsored Products Bulk Upload (matches your bulk file exactly)</p>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleExportXLSX}
              disabled={exporting}
              className="flex-1 px-4 py-2 bg-dm-crimson text-white text-sm font-bold uppercase tracking-wider hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {exporting ? 'Generating...' : `Download XLSX (${rows.length} negatives)`}
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-dm-dark-gray text-dm-gray text-sm font-bold uppercase tracking-wider hover:bg-dm-gray/30 hover:text-white transition-colors border border-dm-dark-gray"
            >
              CSV
            </button>
          </div>
          <p className="text-xs text-dm-gray/50">XLSX recommended - matches Amazon bulk upload format exactly</p>
        </div>
      )}
    </div>
  );
}

function SortableTable({ rows, bucket }) {
  const [sortKey, setSortKey] = useState('spend');
  const [sortDir, setSortDir] = useState('desc');
  const [searchFilter, setSearchFilter] = useState('');

  const filtered = useMemo(() => {
    if (!searchFilter.trim()) return rows;
    const q = searchFilter.toLowerCase();
    return rows.filter(r =>
      r.searchTerm.toLowerCase().includes(q) ||
      (r.reason && r.reason.toLowerCase().includes(q))
    );
  }, [rows, searchFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleDownloadCSV = () => {
    const csv = exportToCSV(rows, TABLE_COLUMNS);
    downloadFile(csv, `dmoose-${bucket}-terms.csv`);
  };

  // Color the match % based on value
  const getMatchColor = (pct) => {
    if (pct >= 70) return 'text-green-400';
    if (pct >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <button
          onClick={handleDownloadCSV}
          className="px-4 py-2 bg-dm-dark-gray text-white text-sm font-bold uppercase tracking-wider hover:bg-dm-gray/30 transition-colors border border-dm-dark-gray"
        >
          Download CSV
        </button>
        {bucket === 'irrelevant' && (
          <NegativeExportPanel rows={rows} />
        )}
        <div className="ml-auto">
          <input
            type="text"
            placeholder="Filter terms..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="bg-dm-black border border-dm-dark-gray px-3 py-2 text-sm text-white placeholder-dm-gray/50 focus:border-dm-crimson focus:outline-none w-56 font-mono"
          />
        </div>
      </div>

      <div className="overflow-x-auto border border-dm-dark-gray">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-dm-black">
              {TABLE_COLUMNS.map(col => (
                <th
                  key={col.key}
                  className="px-3 py-3 text-left text-xs uppercase tracking-wider text-dm-gray cursor-pointer hover:text-white transition-colors select-none whitespace-nowrap"
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1 text-dm-crimson">
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={i}
                className="border-t border-dm-dark-gray/50 hover:bg-dm-black/50 transition-colors"
              >
                {TABLE_COLUMNS.map(col => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 ${col.mono ? 'font-mono' : ''} ${col.numeric ? 'text-right font-mono' : ''} ${col.wide ? 'max-w-xs text-dm-gray text-xs' : ''} ${col.key === 'matchPct' ? getMatchColor(row.matchPct || 0) : ''} whitespace-nowrap`}
                  >
                    {col.dollar && typeof row[col.key] === 'number'
                      ? `$${row[col.key].toFixed(2)}`
                      : col.pct && typeof row[col.key] === 'number'
                      ? `${row[col.key].toFixed(1)}%`
                      : row[col.key] ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={TABLE_COLUMNS.length} className="px-3 py-8 text-center text-dm-gray">
                  No terms in this bucket
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-dm-gray mt-2 font-mono">
        {filtered.length !== rows.length
          ? `${filtered.length} of ${rows.length} terms (filtered)`
          : `${rows.length} terms`}
      </div>
    </div>
  );
}

export default function ResultsScreen({ results, onReset }) {
  const [activeTab, setActiveTab] = useState('relevant');

  const relevant = useMemo(() => results.filter(r => r.bucket === 'relevant'), [results]);
  const wasting = useMemo(() => results.filter(r => r.bucket === 'wasting'), [results]);
  const irrelevant = useMemo(() => results.filter(r => r.bucket === 'irrelevant'), [results]);

  const totalSpend = results.reduce((s, r) => s + (r.spend || 0), 0);
  const wastedSpend = wasting.reduce((s, r) => s + (r.spend || 0), 0)
    + irrelevant.reduce((s, r) => s + (r.spend || 0), 0);
  const relevantSpend = relevant.reduce((s, r) => s + (r.spend || 0), 0);

  const tabs = [
    { id: 'relevant', label: 'Relevant + Converting', icon: '✅', count: relevant.length, color: 'text-green-400' },
    { id: 'wasting', label: 'Wasting', icon: '⚠️', count: wasting.length, color: 'text-yellow-400' },
    { id: 'irrelevant', label: 'Irrelevant', icon: '❌', count: irrelevant.length, color: 'text-red-400' },
  ];

  const tabData = { relevant, wasting, irrelevant };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dm-dark-gray pb-4">
        <div>
          <h1 className="text-2xl font-bold font-mono">
            <span className="text-dm-crimson">Results</span> Dashboard
          </h1>
          <p className="text-xs text-dm-gray mt-1">
            Relevancy threshold: 70% keyword match | 3 buckets
          </p>
        </div>
        <button
          onClick={onReset}
          className="px-4 py-2 border border-dm-dark-gray text-dm-gray text-sm uppercase tracking-wider hover:border-dm-crimson hover:text-white transition-colors"
        >
          New Analysis
        </button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total Terms', value: results.length, color: 'text-white' },
          { label: 'Total Ad Spend', value: `$${totalSpend.toFixed(2)}`, color: 'text-white' },
          { label: 'Relevant Spend', value: `$${relevantSpend.toFixed(2)}`, color: 'text-green-400' },
          { label: 'Wasted Spend', value: `$${wastedSpend.toFixed(2)}`, color: 'text-yellow-500' },
          { label: 'Irrelevant Terms', value: irrelevant.length, color: 'text-red-500' },
          { label: 'Rec. Negatives', value: irrelevant.length, color: 'text-dm-crimson' },
        ].map((stat, i) => (
          <div key={i} className="bg-dm-charcoal border border-dm-dark-gray p-4">
            <div className="text-xs uppercase tracking-wider text-dm-gray mb-1">{stat.label}</div>
            <div className={`text-xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-dm-dark-gray">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-dm-crimson bg-dm-charcoal'
                : 'text-dm-gray hover:text-white'
            }`}
          >
            {tab.icon} {tab.label}
            <span className={`ml-2 text-xs px-2 py-0.5 ${activeTab === tab.id ? 'bg-dm-crimson/20 ' + tab.color : 'bg-dm-dark-gray'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Description */}
      <div className="text-xs text-dm-gray/60 px-1">
        {activeTab === 'relevant' && '✅ Search terms with >=70% keyword match AND at least 1 order with acceptable ACOS'}
        {activeTab === 'wasting' && '⚠️ Search terms with >=70% keyword match BUT zero orders or ACOS above threshold - optimize bids or pause'}
        {activeTab === 'irrelevant' && '❌ Search terms with <70% keyword match - not related to your product, safe to add as negative keywords'}
      </div>

      {/* Table */}
      <div className="bg-dm-charcoal p-4 border border-dm-dark-gray">
        <SortableTable rows={tabData[activeTab]} bucket={activeTab} />
      </div>
    </div>
  );
}
