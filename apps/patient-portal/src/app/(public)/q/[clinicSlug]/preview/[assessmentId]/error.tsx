"use client";

export default function PreviewError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Report preview is temporarily unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">Your assessment has not been lost. Please retry loading the report.</p>
        <button onClick={reset} className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Retry
        </button>
      </div>
    </main>
  );
}
