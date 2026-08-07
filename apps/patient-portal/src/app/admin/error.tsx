"use client";

// Diagnostic error boundary. Renders the actual error text so a 500 tells us
// what threw instead of showing Next's generic page.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <pre
      style={{
        padding: 24,
        whiteSpace: "pre-wrap",
        fontFamily: "monospace",
        background: "#fff",
        color: "#111",
        minHeight: "100vh",
      }}
    >
      {"ADMIN ERROR BOUNDARY\n\n" +
        `${error.name}: ${error.message}\n\n` +
        `digest: ${error.digest ?? "(none)"}\n\n` +
        (error.stack ?? "(no stack)")}
      <button onClick={reset} style={{ marginTop: 16 }}>
        Retry
      </button>
    </pre>
  );
}
