import { useState, useMemo } from 'react';
import { exportToCSV, exportNegativesForAmazon } from '../utils/csvParser';

const TABLE_COLUMNS = [
  { key: 'searchTerm', label: 'Search Term', mono: true },
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

function SortableTable({ rows, bucket }) {
  const [sortKey, setSortKey] = useState('spend');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

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

  const handleDownloadNegatives = () => {
    const csv = exportNegativesForAmazon(rows);
    downloadFile(csv, 'amazon-negative-keywords-bulk-upload.csv');
  };

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <button
          onClick={handleDownloadCSV}
          className="px-4 py-2 bg-dm-dark-gray text-white text-sm font-bold uppercase tracking-wider hover:bg-dm-gray/30 transition-colors border border-dm-dark-gray"
        >
          Download CSV
        </button>
        {bucket === 'irrelevant' && (
          <button
            onClick={handleDownloadNegatives}
            className="px-4 py-2 bg-dm-crimson text-white text-sm font-bold uppercase tracking-wider hover:bg-red-700 transition-colors"
          >
            Export Negatives for Amazon Bulk Upload
          </button>
        )}
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
                    className={`px-3 py-2 ${col.mono ? 'font-mono' : ''} ${col.numeric ? 'text-right font-mono' : ''} ${col.wide ? 'max-w-xs text-dm-gray text-xs' : ''} whitespace-nowrap`}
                  >
                    {col.dollar && typeof row[col.key] === 'number'
                      ? `$${row[col.key].toFixed(2)}`
                      : col.pct && typeof row[col.key] === 'number'
                      ? `${row[col.key].toFixed(1)}%`
                      : row[col.key] ?? '—'}
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
      <div className="text-xs text-dm-gray mt-2 font-mono">{sorted.length} terms</div>
    </div>
  );
}

export default function ResultsScreen({ results, onReset }) {
  const [activeTab, setActiveTab] = useState('relevant');

  const relevant = useMemo(() => results.filter(r => r.bucket === 'relevant'), [results]);
  const wasting = useMemo(() => results.filter(r => r.bucket === 'wasting'), [results]);
  const semi = useMemo(() => results.filter(r => r.bucket === 'semi'), [results]);
  const irrelevant = useMemo(() => results.filter(r => r.bucket === 'irrelevant'), [results]);

  const totalSpend = results.reduce((s, r) => s + (r.spend || 0), 0);
  const wastedSpend = wasting.reduce((s, r) => s + (r.spend || 0), 0)
    + irrelevant.reduce((s, r) => s + (r.spend || 0), 0);

  const tabs = [
    { id: 'relevant', label: '✅ Relevant', count: relevant.length },
    { id: 'wasting', label: '⚠️ Wasting', count: wasting.length },
    { id: 'semi', label: '🔶 Semi-Relevant', count: semi.length },
    { id: 'irrelevant', label: '❌ Irrelevant', count: irrelevant.length },
  ];

  const tabData = { relevant, wasting, semi, irrelevant };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dm-dark-gray pb-4">
        <div>
          <h1 className="text-2xl font-bold font-mono">
            <span className="text-dm-crimson">Results</span> Dashboard
          </h1>
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
          { label: 'Wasted Spend', value: `$${wastedSpend.toFixed(2)}`, color: 'text-yellow-500' },
          { label: 'Semi-Relevant', value: semi.length, color: 'text-orange-400' },
          { label: 'Irrelevant', value: irrelevant.length, color: 'text-red-500' },
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
            className={`px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-dm-crimson bg-dm-charcoal'
                : 'text-dm-gray hover:text-white'
            }`}
          >
            {tab.label}
            <span className="ml-2 text-xs bg-dm-dark-gray px-2 py-0.5">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Tab Description */}
      <div className="text-xs text-dm-gray/60 px-1">
        {activeTab === 'relevant' && '✅ Search terms that match your product AND have orders with acceptable ACOS'}
        {activeTab === 'wasting' && '⚠️ Relevant terms but with zero orders or ACOS above your threshold — optimize bids or pause'}
        {activeTab === 'semi' && '🔶 Partially related terms (some product words match) with zero orders — review manually before negating'}
        {activeTab === 'irrelevant' && '❌ Completely unrelated terms with zero orders — safe to add as negative keywords'}
      </div>

      {/* Table */}
      <div className="bg-dm-charcoal p-4 border border-dm-dark-gray">
        <SortableTable rows={tabData[activeTab]} bucket={activeTab} />
      </div>
    </div>
  );
}
