import { useState, useRef } from 'react';
import { getApiKey } from '../utils/claudeApi';

export default function SetupScreen({ onAnalyze }) {
  const [csvFile, setCsvFile] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [productInfo, setProductInfo] = useState('');
  const [acosThreshold, setAcosThreshold] = useState(40);
  const [spendThreshold, setSpendThreshold] = useState(3);
  const [apiKey, setApiKey] = useState(getApiKey() || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setCsvFile(e.dataTransfer.files[0]);
      setCsvText('');
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0]);
      setCsvText('');
    }
  };

  const handleAnalyze = () => {
    if (!csvFile && !csvText.trim()) return;
    if (!productInfo.trim()) return;
    onAnalyze({
      csvInput: csvFile || csvText,
      productInfo,
      acosThreshold,
      spendThreshold,
      apiKey: apiKey.trim(),
    });
  };

  const hasCSV = csvFile || csvText.trim();
  const hasProduct = productInfo.trim();
  const canAnalyze = hasCSV && hasProduct;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header with DMoose Logo */}
      <div className="border-b border-dm-dark-gray pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-dm-crimson flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-2xl font-mono">D</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold font-mono tracking-tight">
              <span className="text-dm-crimson">DMoose</span> Search Term Classifier
            </h1>
            <p className="text-dm-gray mt-1 text-sm">
              Upload your Amazon SP Search Term Report, paste your product info, and classify every term.
            </p>
          </div>
        </div>
      </div>

      {/* CSV Upload */}
      <div className="bg-dm-charcoal p-6 border border-dm-dark-gray">
        <h2 className="text-sm font-bold uppercase tracking-wider text-dm-gray mb-4">
          01 — Search Term Report
        </h2>

        <div
          className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-dm-crimson bg-dm-crimson/10'
              : csvFile
              ? 'border-green-600 bg-green-600/5'
              : 'border-dm-dark-gray hover:border-dm-gray'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.xlsx,.xls,.xlsm"
            className="hidden"
            onChange={handleFileSelect}
          />
          {csvFile ? (
            <div>
              <div className="text-green-500 text-lg font-mono">{csvFile.name}</div>
              <div className="text-dm-gray text-sm mt-1">
                {(csvFile.size / 1024).toFixed(1)} KB — Click or drop to replace
              </div>
            </div>
          ) : (
            <div>
              <div className="text-dm-gray text-lg">Drop CSV or XLSX file here or click to browse</div>
              <div className="text-dm-gray/50 text-sm mt-1">Accepts .csv and .xlsx files from Amazon Advertising</div>
            </div>
          )}
        </div>

        <div className="my-4 flex items-center gap-4">
          <div className="flex-1 h-px bg-dm-dark-gray"></div>
          <span className="text-dm-gray text-xs uppercase tracking-wider">or paste CSV text</span>
          <div className="flex-1 h-px bg-dm-dark-gray"></div>
        </div>

        <textarea
          className="w-full bg-dm-black border border-dm-dark-gray p-4 text-sm font-mono text-white placeholder-dm-gray/40 resize-vertical focus:outline-none focus:border-dm-crimson"
          rows={4}
          placeholder="Paste your CSV data here..."
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            if (e.target.value.trim()) setCsvFile(null);
          }}
        />
      </div>

      {/* Product Info */}
      <div className="bg-dm-charcoal p-6 border border-dm-dark-gray">
        <h2 className="text-sm font-bold uppercase tracking-wider text-dm-gray mb-4">
          02 — Product Information
        </h2>
        <textarea
          className="w-full bg-dm-black border border-dm-dark-gray p-4 text-sm font-mono text-white placeholder-dm-gray/40 resize-vertical focus:outline-none focus:border-dm-crimson"
          rows={8}
          placeholder={"Paste your Product Title, Bullet Points, and Target Keywords here...\n\nExample:\nTitle: DMoose Knee Sleeves for Weightlifting\nBullets: Neoprene knee support, 7mm thickness, powerlifting...\nKeywords: knee sleeves, weightlifting knee support, gym knee wraps"}
          value={productInfo}
          onChange={(e) => setProductInfo(e.target.value)}
        />
      </div>

      {/* Thresholds */}
      <div className="bg-dm-charcoal p-6 border border-dm-dark-gray">
        <h2 className="text-sm font-bold uppercase tracking-wider text-dm-gray mb-4">
          03 — Thresholds
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm text-white">ACOS Threshold</label>
              <span className="text-dm-crimson font-mono font-bold text-lg">{acosThreshold}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={acosThreshold}
              onChange={(e) => setAcosThreshold(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-dm-gray mt-1">
              <span>5%</span>
              <span>100%</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm text-white">Min Spend for Wasted Flag</label>
              <span className="text-dm-crimson font-mono font-bold text-lg">${spendThreshold}</span>
            </div>
            <input
              type="number"
              min={0}
              step={0.5}
              value={spendThreshold}
              onChange={(e) => setSpendThreshold(Number(e.target.value))}
              className="w-24 bg-dm-black border border-dm-dark-gray px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-dm-crimson"
            />
          </div>
        </div>
      </div>

      {/* API Key */}
      <div className="bg-dm-charcoal p-6 border border-dm-dark-gray">
        <h2 className="text-sm font-bold uppercase tracking-wider text-dm-gray mb-4">
          04 — Claude AI Layer <span className="text-dm-gray/50 font-normal normal-case">(optional — improves accuracy)</span>
        </h2>
        <p className="text-dm-gray/60 text-xs mb-3">
          Enter your Anthropic API key to enable AI-powered classification. Without it, the tool uses keyword + fuzzy matching only.
          Your key stays in your browser — never sent anywhere except Anthropic's API.
        </p>
        <div className="flex gap-2">
          <input
            type={showApiKey ? 'text' : 'password'}
            className="flex-1 bg-dm-black border border-dm-dark-gray px-4 py-2 text-sm font-mono text-white placeholder-dm-gray/40 focus:outline-none focus:border-dm-crimson"
            placeholder="sk-ant-api03-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            className="px-3 py-2 bg-dm-dark-gray text-dm-gray text-xs uppercase tracking-wider hover:text-white transition-colors border border-dm-dark-gray"
          >
            {showApiKey ? 'Hide' : 'Show'}
          </button>
        </div>
        {apiKey.trim() && apiKey.trim().length > 10 && (
          <div className="mt-2 text-green-500 text-xs font-mono">AI layer enabled</div>
        )}
        {!apiKey.trim() && (
          <div className="mt-2 text-dm-gray/40 text-xs font-mono">AI layer disabled — using keyword + fuzzy matching</div>
        )}
      </div>

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={!canAnalyze}
        className={`w-full py-4 text-lg font-bold uppercase tracking-wider transition-all ${
          canAnalyze
            ? 'bg-dm-crimson text-white hover:bg-red-700 active:bg-red-800'
            : 'bg-dm-dark-gray text-dm-gray cursor-not-allowed'
        }`}
      >
        {canAnalyze ? 'ANALYZE SEARCH TERMS' : 'Upload CSV + Add Product Info to Continue'}
      </button>
    </div>
  );
}
