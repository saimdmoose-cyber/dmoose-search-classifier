import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dm-black flex items-center justify-center p-6">
          <div className="bg-dm-charcoal border border-dm-dark-gray p-8 max-w-lg w-full">
            <h2 className="text-2xl font-bold font-mono mb-4">
              <span className="text-dm-crimson">Crash</span> Recovered
            </h2>
            <p className="text-dm-gray mb-4 text-sm">
              Something unexpected happened. Your data is safe — just reload.
            </p>
            <div className="bg-dm-black border border-dm-dark-gray p-3 mb-6 max-h-32 overflow-y-auto">
              <code className="text-red-400 text-xs font-mono break-all">
                {this.state.error?.message || 'Unknown error'}
              </code>
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-3 bg-dm-crimson text-white font-bold uppercase tracking-wider hover:bg-red-700 transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
