import { useState, useCallback } from 'react';
import SetupScreen from './components/SetupScreen';
import ProcessingScreen from './components/ProcessingScreen';
import ResultsScreen from './components/ResultsScreen';
import { parseCSV } from './utils/csvParser';
import { classifySearchTerms } from './utils/relevancyEngine';
import { setApiKey } from './utils/claudeApi';

export default function App() {
  const [screen, setScreen] = useState('setup');
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentLayer, setCurrentLayer] = useState('');
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);

  const addLog = useCallback((msg) => {
    setLogs(prev => [...prev, msg]);
  }, []);

  const handleAnalyze = useCallback(async ({ csvInput, productInfo, acosThreshold, spendThreshold, apiKey }) => {
    // Set API key if provided
    if (apiKey) setApiKey(apiKey);

    setScreen('processing');
    setProgress(0);
    setTotal(0);
    setLogs([]);
    setCurrentLayer('');

    try {
      addLog('Parsing file...');
      setCurrentLayer('Parsing file...');
      const rows = await parseCSV(csvInput);
      addLog(`Parsed ${rows.length} search terms`);
      setTotal(rows.length);

      const classified = await classifySearchTerms({
        rows,
        productInfo,
        acosThreshold,
        spendThreshold,
        onLayerUpdate: (layer) => {
          setCurrentLayer(layer);
          addLog(layer);
        },
        onProgress: (done, t) => {
          setProgress(done);
          setTotal(t);
        },
      });

      const relevant = classified.filter(r => r.bucket === 'relevant').length;
      const wasting = classified.filter(r => r.bucket === 'wasting').length;
      const semi = classified.filter(r => r.bucket === 'semi').length;
      const irrelevant = classified.filter(r => r.bucket === 'irrelevant').length;

      addLog(`Done: ${relevant} relevant, ${wasting} wasting, ${semi} semi-relevant, ${irrelevant} irrelevant`);

      setResults(classified);
      setScreen('results');
    } catch (err) {
      addLog(`ERROR: ${err.message}`);
      setCurrentLayer(`Error: ${err.message}`);
    }
  }, [addLog]);

  const handleReset = useCallback(() => {
    setScreen('setup');
    setResults([]);
    setProgress(0);
    setTotal(0);
    setLogs([]);
    setCurrentLayer('');
  }, []);

  return (
    <div className="min-h-screen bg-dm-black">
      {screen === 'setup' && <SetupScreen onAnalyze={handleAnalyze} />}
      {screen === 'processing' && (
        <ProcessingScreen
          progress={progress}
          total={total}
          currentLayer={currentLayer}
          logs={logs}
          onBack={handleReset}
        />
      )}
      {screen === 'results' && (
        <ResultsScreen results={results} onReset={handleReset} />
      )}
    </div>
  );
}
