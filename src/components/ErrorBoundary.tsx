import { Component, type ErrorInfo, type ReactNode } from "react";

import { reportClientError } from "../api";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    void reportClientError({
      source: "error-boundary",
      message: error.message,
      stack: `${error.stack ?? ""}\n${errorInfo.componentStack}`,
      url: window.location.href,
      userAgent: window.navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="shell">
          <section className="surface">
            <h1>Something went wrong.</h1>
            <p className="muted">Please refresh the page. The issue has been logged.</p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
