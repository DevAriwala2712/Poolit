import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { reportError } from "./errorReporting";

/**
 * Catches a crash while drawing a screen, reports it, and shows a plain message with a Reload
 * button instead of a blank page. Styled with inline rules so it works in either app, even if
 * the crash was in the styling code.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error);
    if (typeof console !== "undefined") console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}
      >
        <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Something went wrong</p>
        <p style={{ fontSize: 14, margin: 0, opacity: 0.7 }}>We've been told about it. Reloading usually fixes it.</p>
        <button
          onClick={() => location.reload()}
          style={{ minHeight: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#111", color: "#fff", fontSize: 15, fontWeight: 600 }}
        >
          Reload
        </button>
      </div>
    );
  }
}
