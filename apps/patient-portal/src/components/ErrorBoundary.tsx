"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-semibold">{this.props.title ?? "This section could not be displayed"}</p>
          <p className="mt-1 text-amber-700">The rest of your report is still available.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
