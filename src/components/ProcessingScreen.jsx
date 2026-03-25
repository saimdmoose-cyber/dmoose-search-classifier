export default function ProcessingScreen({ progress, total, currentLayer, logs, onBack }) {
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
  const hasError = currentLayer && currentLayer.startsWith('Error:');

  return (
    <div className="max-w-2xl mx-auto p-6 mt-20">
      <div className="bg-dm-charcoal border border-dm-dark-gray p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold font-mono">
            <span className="text-dm-crimson">{hasError ? 'Error' : 'Analyzing'}</span> Search Terms
          </h2>
          <p className="text-dm-gray mt-2 text-sm">
            {hasError ? 'Something went wrong — check the log below' : `Processing ${progress} of ${total} terms...`}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-dm-gray font-mono">{pct}%</span>
            <span className="text-dm-gray font-mono">{progress}/{total}</span>
          </div>
          <div className="w-full h-2 bg-dm-black">
            <div
              className="h-full bg-dm-crimson transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Current Layer */}
        {currentLayer && (
          <div className={`mb-6 p-3 bg-dm-black border-l-2 ${hasError ? 'border-red-500' : 'border-dm-crimson'}`}>
            <span className={`text-xs uppercase tracking-wider font-bold ${hasError ? 'text-red-500' : 'text-dm-crimson'}`}>
              {hasError ? 'Error' : 'Active'}
            </span>
            <p className="text-white text-sm mt-1 font-mono">{currentLayer}</p>
          </div>
        )}

        {/* Log */}
        <div className="bg-dm-black border border-dm-dark-gray p-4 max-h-48 overflow-y-auto">
          <div className="text-xs uppercase tracking-wider text-dm-gray mb-2 font-bold">Processing Log</div>
          {logs.map((log, i) => (
            <div key={i} className={`text-sm font-mono py-1 border-b border-dm-dark-gray/30 last:border-0 ${log.startsWith('ERROR') ? 'text-red-400' : 'text-dm-gray'}`}>
              <span className="text-dm-crimson mr-2">&gt;</span>
              {log}
            </div>
          ))}
        </div>

        {/* Spinner or Back Button */}
        {hasError ? (
          <button
            onClick={onBack}
            className="w-full mt-6 py-3 bg-dm-crimson text-white font-bold uppercase tracking-wider hover:bg-red-700 transition-colors"
          >
            Back to Setup
          </button>
        ) : (
          <div className="flex justify-center mt-8">
            <div className="w-8 h-8 border-2 border-dm-dark-gray border-t-dm-crimson animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
