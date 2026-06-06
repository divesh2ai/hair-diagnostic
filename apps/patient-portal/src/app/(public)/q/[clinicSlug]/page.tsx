'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAssessmentStore } from '@/stores/useAssessmentStore';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Stethoscope, AlertCircle } from 'lucide-react';

interface ClinicData {
  id: string;
  name: string;
  slug: string;
  language: string;
}

export default function ClinicLandingPage() {
  const params = useParams();
  const router = useRouter();
  const { setClinicData, reset } = useAssessmentStore();
  const clinicSlug = String(params.clinicSlug ?? '');

  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicSlug) return;

    // Reset previous assessment state when a new QR code is scanned
    reset();

    async function fetchClinic() {
      try {
        const res = await fetch(`/api/clinics/${clinicSlug}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error ?? 'Clinic not found');
          return;
        }

        setClinic(data.clinic);
        setClinicData({
          id: data.clinic.id,
          name: data.clinic.name,
          slug: data.clinic.slug,
          language: data.clinic.language,
        });
      } catch {
        setError('Could not load clinic. Please check your connection.');
      } finally {
        setLoading(false);
      }
    }

    fetchClinic();
  }, [clinicSlug, setClinicData, reset]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading clinic…</p>
        </div>
      </div>
    );
  }

  if (error || !clinic) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-lg font-semibold">Clinic not found</h2>
          <p className="text-sm text-muted-foreground">
            {error ?? `No clinic found for "${clinicSlug}". Please scan the QR code again.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-md w-full text-center space-y-8"
      >
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <Stethoscope className="w-12 h-12 text-primary" />
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Welcome to {clinic.name}
          </h1>
          <p className="text-lg text-muted-foreground font-medium px-4">
            To provide you with the most accurate clinical recommendations, please complete this
            visual assessment.
          </p>
        </div>

        <div className="pt-8 space-y-4">
          <Button
            size="lg"
            className="w-full text-lg h-14 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
            onClick={() => router.push(`/q/${clinicSlug}/assessment`)}
          >
            Start Assessment
          </Button>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground font-medium">
            <span>⏱ Takes ~3 minutes</span>
            <span>•</span>
            <span>🔒 100% Confidential</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
