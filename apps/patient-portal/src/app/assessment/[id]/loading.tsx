export default function AssessmentLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-gray-500">Loading assessment…</p>
      </div>
    </div>
  );
}
