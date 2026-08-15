import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log silently — never expose to the UI
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[linear-gradient(180deg,#fffdf9_0%,#f5ede1_100%)] px-4 text-center">
          <img
            src="/icons/icon-192.png"
            alt="Rajesh Shopping Center"
            className="h-20 w-20 rounded-2xl object-cover shadow-md"
          />
          <div>
            <h1 className="font-serif text-2xl font-bold text-slate-800">
              केही समस्या आयो — Something went wrong
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Don't worry, your data is safe. Please reload or go back to the home page.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm"
            >
              🔄 Reload App
            </button>
            <a
              href="/"
              className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm"
            >
              🏠 Go to Home
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
