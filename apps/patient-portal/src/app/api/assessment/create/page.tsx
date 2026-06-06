"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ReportPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(
        `/api/assessment/status?id=${id}`
      );
      const json = await res.json();
      setData(json);
      setLoading(false);
    };

    fetchData();

    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="p-10 text-center">
        Loading report...
      </div>
    );
  }

  const outputs = data?.outputs || {};

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">

      {/* HEADER */}
      <div className="border p-4 rounded-lg">
        <h1 className="text-2xl font-bold">
          Hair Analysis Report
        </h1>
        <p>Status: {data?.status}</p>
        <p>Stage: {data?.stage}</p>
      </div>

      {/* CLINICAL */}
      <div className="border p-4 rounded-lg">
        <h2 className="font-bold text-lg">
          Clinical Analysis
        </h2>
        <pre className="text-sm overflow-auto">
          {JSON.stringify(outputs.clinicalProfile, null, 2)}
        </pre>
      </div>

      {/* RECOMMENDATION */}
      <div className="border p-4 rounded-lg">
        <h2 className="font-bold text-lg">
          Kit Recommendation
        </h2>
        <pre className="text-sm overflow-auto">
          {JSON.stringify(outputs.recommendation, null, 2)}
        </pre>
      </div>

      {/* NARRATIVE */}
      <div className="border p-4 rounded-lg">
        <h2 className="font-bold text-lg">
          Doctor Explanation
        </h2>
        <pre className="text-sm overflow-auto">
          {JSON.stringify(outputs.pdf, null, 2)}
        </pre>
      </div>

      {/* PDF DOWNLOAD */}
      <div className="pt-4">
        <DownloadButton assessmentId={id as string} />
      </div>
    </div>
  );
}