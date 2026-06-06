"use client";

export default function AssessmentError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">We could not load this assessment</h1>
        <p className="mt-2 text-sm text-gray-600">
          The report data may still be processing. Try again in a moment.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
