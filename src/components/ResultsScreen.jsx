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
          <div className="flex items-center gap-4">
            <span className="text-xs text-dm-gray w-28">Negative Level:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="level" value="campaign" checked={level === 'campaign'} onChange={() => setLevel('campaign')} className="accent-dm-crimson" />
              <span className="text-sm text-white">Campaign Level</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="level" value="adgroup" checked={level === 'adgroup'} onChange={() => setLevel('adgroup')} className="accent-dm-crimson" />
              <span className="text-sm text-white">Ad Group Level</span>
            </label>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-dm-gray w-28">Match Type:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="matchType" value="negativeExact" checked={matchType === 'negativeExact'} onChange={() => setMatchType('negativeExact')} className="accent-dm-crimson" />
              <span className="text-sm text-white">Negative Exact</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="matchType" value="negativePhrase" checked={matchType === 'negativePhrase'} onChange={() => setMatchType('negativePhrase')} className="accent-dm-crimson" />
              <span className="text-sm text-white">Negative Phrase</span>
            </label>
          </div>
          <div className="text-xs space-y-1 border-t border-dm-dark-gray pt-2">
            {hasCampaignId ? (
              <p className="text-green-400">Campaign IDs detected - file is ready for direct Amazon upload.</p>
            ) : hasCampaignName ? (
              <p className="text-yellow-400">Campaign Names detected (no IDs). You may need to add Campaign Id column before uploading to Amazon.</p>
            ) : (
              <p className="text-red-400">No Campaign data found. You will need to add Campaign Id manually before uploading.</p>
            )}
            <p className="text-dm-gray">Format: Amazon Sponsored Products Bulk Upload</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleExportXLSX} disabled={exporting} className="flex-1 px-4 py-2 bg-dm-crimson text-white text-sm font-bold uppercase tracking-wider hover:bg-red-700 transition-colors disabled:opacity-50">
              {exporting ? 'Generating...' : `Download XLSX (${rows.length} negatives)`}
            </button>
            <button onClick={handleExportCSV} className="px-4 py-2 bg-dm-dark-gray text-dm-gray text-sm font-bold uppercase tracking-wider hover:bg-dm-gray/30 hover:text-white transition-colors border border-dm-dark-gray">
              CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Advanced Filter Bar ─── */
function FilterBar({ filters, setFilters, rows }) {
  const maxSpend = useMemo(() => Math.max(...rows.map(r => r.spend || 0), 0), [rows]);
  const maxClicks = useMemo(() => Math.max(...rows.map(r => r.clicks || 0), 0), [rows]);

  return (
    <div className="bg-dm-black border border-dm-dark-gray p-3 mb-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-dm-gray uppercase tracking-wider font-bold">Filters</span>
        <button
          onClick={() => setFilters({ search: '', ordersFilter: 'all', spendMin: '', spendMax: '', clicksMin: '', acosMin: '', acosMax: '', matchMin: '', matchMax: '' })}
          className="text-xs text-dm-crimson hover:text-red-400 cursor-pointer"
        >
          Reset All
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-dm-gray uppercase">Search Term</label>
          <input
            type="text"
            placeholder="Search..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="bg-dm-charcoal border border-dm-dark-gray px-2 py-1.5 text-xs text-white placeholder-dm-gray/50 focus:border-dm-crimson focus:outline-none w-40 font-mono"
          />
        </div>

        {/* Orders Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-dm-gray uppercase">Orders</label>
          <select
            value={filters.ordersFilter}
            onChange={e => setFilters(f => ({ ...f, ordersFilter: e.target.value }))}
            className="bg-dm-charcoal border border-dm-dark-gray px-2 py-1.5 text-xs text-white focus:border-dm-crimson focus:outline-none cursor-pointer"
          >
            <option value="all">All</option>
            <option value="zero">0 Orders Only</option>
            <option value="has">Has Orders (&gt;0)</option>
            <option value="1plus">1+ Orders</option>
            <option value="5plus">5+ Orders</option>
          </select>
        </div>

        {/* Spend Range */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-dm-gray uppercase">Spend Min ($)</label>
          <input
            type="number"
            placeholder="0"
            value={filters.spendMin}
            onChange={e => setFilters(f => ({ ...f, spendMin: e.target.value }))}
            className="bg-dm-charcoal border border-dm-dark-gray px-2 py-1.5 text-xs text-white placeholder-dm-gray/50 focus:border-dm-crimson focus:outline-none w-20 font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-dm-gray uppercase">Spend Max ($)</label>
          <input
            type="number"
            placeholder="any"
            value={filters.spendMax}
            onChange={e => setFilters(f => ({ ...f, spendMax: e.target.value }))}
            className="bg-dm-charcoal border border-dm-dark-gray px-2 py-1.5 text-xs text-white placeholder-dm-gray/50 focus:border-dm-crimson focus:outline-none w-20 font-mono"
          />
        </div>

        {/* Clicks Min */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-dm-gray uppercase">Clicks Min</label>
          <input
            type="number"
            placeholder="0"
            value={filters.clicksMin}
            onChange={e => setFilters(f => ({ ...f, clicksMin: e.target.value }))}
            className="bg-dm-charcoal border border-dm-dark-gray px-2 py-1.5 text-xs text-white placeholder-dm-gray/50 focus:border-dm-crimson focus:outline-none w-20 font-mono"
          />
        </div>

        {/* ACOS Range */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-dm-gray uppercase">ACOS Min %</label>
          <input
            type="number"
            placeholder="0"
            value={filters.acosMin}
            onChange={e => setFilters(f => ({ ...f, acosMin: e.target.value }))}
            className="bg-dm-charcoal border border-dm-dark-gray px-2 py-1.5 text-xs text-white placeholder-dm-gray/50 focus:border-dm-crimson focus:outline-none w-20 font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-dm-gray uppercase">ACOS Max %</label>
          <input
            type="number"
            placeholder="any"
            value={filters.acosMax}
            onChange={e => setFilters(f => ({ ...f, acosMax: e.target.value }))}
            className="bg-dm-charcoal border border-dm-dark-gray px-2 py-1.5 text-xs text-white placeholder-dm-gray/50 focus:border-dm-crimson focus:outline-none w-20 font-mono"
          />
        </div>

        {/* Match % Range */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-dm-gray uppercase">Match Min %</label>
          <input
            type="number"
            placeholder="0"
            value={filters.matchMin}
            onChange={e => setFilters(f => ({ ...f, matchMin: e.target.value }))}
            className="bg-dm-charcoal border border-dm-dark-gray px-2 py-1.5 text-xs text-white placeholder-dm-gray/50 focus:border-dm-crimson focus:outline-none w-20 font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-dm-gray uppercase">Match Max %</label>
          <input
            type="number"
            placeholder="any"
            value={filters.matchMax}
            onChange={e => setFilters(f => ({ ...f, matchMax: e.target.value }))}
            className="bg-dm-charcoal border border-dm-dark-gray px-2 py-1.5 text-xs text-white placeholder-dm-gray/50 focus:border-dm-crimson focus:outline-none w-20 font-mono"
          />
        </div>
      </div>
    </div>
  );
}

function applyFilters(rows, filters) {
  let result = rows;

  // Text search
  if (filters.search.trim()) {
    const q = filters.search.toLowerCase();
    result = result.filter(r =>
      r.searchTerm.toLowerCase().includes(q) ||
      (r.reason && r.reason.toLowerCase().includes(q))
    );
  }

  // Orders filter
  if (filters.ordersFilter === 'zero') {
    result = result.filter(r => r.orders === 0);
  } else if (filters.ordersFilter === 'has') {
    result = result.filter(r => r.orders > 0);
  } else if (filters.ordersFilter === '1plus') {
    result = result.filter(r => r.orders >= 1);
  } else if (filters.ordersFilter === '5plus') {
    result = result.filter(r => r.orders >= 5);
  }

  // Spend range
  if (filters.spendMin !== '') {
    result = result.filter(r => (r.spend || 0) >= parseFloat(filters.spendMin));
  }
  if (filters.spendMax !== '') {
    result = result.filter(r => (r.spend || 0) <= parseFloat(filters.spendMax));
  }

  // Clicks min
  if (filters.clicksMin !== '') {
    result = result.filter(r => (r.clicks || 0) >= parseInt(filters.clicksMin));
  }

  // ACOS range
  if (filters.acosMin !== '') {
    result = result.filter(r => (r.acos || 0) >= parseFloat(filters.acosMin));
  }
  if (filters.acosMax !== '') {
    result = result.filter(r => (r.acos || 0) <= parseFloat(filters.acosMax));
  }

  // Match % range
  if (filters.matchMin !== '') {
    result = result.filter(r => (r.matchPct || 0) >= parseFloat(filters.matchMin));
  }
  if (filters.matchMax !== '') {
    result = result.filter(r => (r.matchPct || 0) <= parseFloat(filters.matchMax));
  }

  return result;
}

const DEFAULT_FILTERS = { search: '', ordersFilter: 'all', spendMin: '', spendMax: '', clicksMin: '', acosMin: '', acosMax: '', matchMin: '', matchMax: '' };

function SortableTable({ rows, bucket }) {
  const [sortKey, setSortKey] = useState('spend');
  const [sortDir, setSortDir] = useState('desc');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);

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
    const csv = exportToCSV(filtered, TABLE_COLUMNS);
    downloadFile(csv, `dmoose-${bucket}-terms.csv`);
  };

  const getMatchColor = (pct) => {
    if (pct > 80) return 'text-green-400';
    if (pct >= 51) return 'text-orange-400';
    return 'text-red-400';
  };

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'ordersFilter') return v !== 'all';
    return v !== '';
  }).length;

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
          <NegativeExportPanel rows={filtered} />
        )}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors border ${
            showFilters || activeFilterCount > 0
              ? 'bg-dm-crimson/20 border-dm-crimson text-dm-crimson'
              : 'bg-dm-dark-gray border-dm-dark-gray text-dm-gray hover:text-white'
          }`}
        >
          Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>
        <div className="ml-auto text-xs text-dm-gray font-mono">
          {filtered.length !== rows.length
            ? `${filtered.length} of ${rows.length} shown`
            : `${rows.length} terms`}
        </div>
      </div>

      {showFilters && <FilterBar filters={filters} setFilters={setFilters} rows={rows} />}

      {/* Quick filter chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {[
          { label: '0 Orders', fn: () => setFilters(f => ({ ...f, ordersFilter: f.ordersFilter === 'zero' ? 'all' : 'zero' })), active: filters.ordersFilter === 'zero' },
          { label: 'Has Orders', fn: () => setFilters(f => ({ ...f, ordersFilter: f.ordersFilter === 'has' ? 'all' : 'has' })), active: filters.ordersFilter === 'has' },
          { label: 'Spend > $5', fn: () => setFilters(f => ({ ...f, spendMin: f.spendMin === '5' ? '' : '5' })), active: filters.spendMin === '5' },
          { label: 'Spend > $10', fn: () => setFilters(f => ({ ...f, spendMin: f.spendMin === '10' ? '' : '10' })), active: filters.spendMin === '10' },
          { label: 'High ACOS (>50%)', fn: () => setFilters(f => ({ ...f, acosMin: f.acosMin === '50' ? '' : '50' })), active: filters.acosMin === '50' },
        ].map((chip, i) => (
          <button
            key={i}
            onClick={chip.fn}
            className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors border ${
              chip.active
                ? 'bg-dm-crimson/20 border-dm-crimson text-white'
                : 'bg-dm-black border-dm-dark-gray text-dm-gray hover:text-white hover:border-dm-gray'
            }`}
          >
            {chip.label}
          </button>
        ))}
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
                  No terms match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── DMoose Logo SVG ─── */
function DmooseLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-dm-crimson flex items-center justify-center">
        <span className="text-white font-black text-lg font-mono">D</span>
      </div>
      <div>
        <h1 className="text-2xl font-bold font-mono leading-none">
          <span className="text-dm-crimson">DMoose</span> <span className="text-white">Search Classifier</span>
        </h1>
        <p className="text-[10px] text-dm-gray uppercase tracking-widest mt-0.5">Results Dashboard</p>
      </div>
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
  const relevantSpend = relevant.reduce((s, r) => s + (r.spend || 0), 0);
  const wastingSpend = wasting.reduce((s, r) => s + (r.spend || 0), 0);
  const irrelevantSpend = irrelevant.reduce((s, r) => s + (r.spend || 0), 0);
  const wastedSpend = wastingSpend + irrelevantSpend;

  const tabs = [
    { id: 'relevant', label: 'Relevant', icon: '✅', count: relevant.length, color: 'text-green-400' },
    { id: 'wasting', label: 'Wasting', icon: '⚠️', count: wasting.length, color: 'text-yellow-400' },
    { id: 'semi', label: 'Semi-Relevant', icon: '◆', count: semi.length, color: 'text-orange-400' },
    { id: 'irrelevant', label: 'Irrelevant', icon: '❌', count: irrelevant.length, color: 'text-red-400' },
  ];

  const tabData = { relevant, wasting, semi, irrelevant };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header with DMoose Logo */}
      <div className="flex items-center justify-between border-b border-dm-dark-gray pb-4">
        <DmooseLogo />
        <button
          onClick={onReset}
          className="px-4 py-2 border border-dm-dark-gray text-dm-gray text-sm uppercase tracking-wider hover:border-dm-crimson hover:text-white transition-colors"
        >
          New Analysis
        </button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Terms', value: results.length, color: 'text-white' },
          { label: 'Total Ad Spend', value: `$${totalSpend.toFixed(2)}`, color: 'text-white' },
          { label: 'Relevant Spend', value: `$${relevantSpend.toFixed(2)}`, color: 'text-green-400' },
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
        {activeTab === 'relevant' && '✅ High relevancy terms with orders and healthy ACOS — your best performers'}
        {activeTab === 'wasting' && '⚠️ Highly relevant but zero orders or ACOS above threshold — optimize bids or pause'}
        {activeTab === 'semi' && '◆ Partially related terms (51-80% match) — review manually before negating'}
        {activeTab === 'irrelevant' && '❌ Low relevancy or zero orders with high ACOS — safe to add as negative keywords'}
      </div>

      {/* Table */}
      <div className="bg-dm-charcoal p-4 border border-dm-dark-gray">
        <SortableTable rows={tabData[activeTab]} bucket={activeTab} />
      </div>
    </div>
  );
}
