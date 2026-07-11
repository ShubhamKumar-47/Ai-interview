import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-800">
            <h2 className="text-2xl font-bold text-rose-500 mb-4">Something went wrong</h2>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              An unexpected runtime error occurred. Please try reloading the page to resume your session.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-semibold shadow-md transition-all cursor-pointer"
              >
                Reload Page
              </button>
              <button
                onClick={() => window.location.href = "/"}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-2.5 rounded-xl font-semibold shadow transition-all cursor-pointer"
              >
                Back Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
