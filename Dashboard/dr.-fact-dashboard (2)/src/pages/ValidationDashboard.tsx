import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { DoctorReview, Report, Outcome } from '../types';
import { useAuth } from '../App';
import { 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  TrendingUp,
  Download,
  Stethoscope,
  LineChart,
  Users
} from 'lucide-react';

import { Filter } from 'lucide-react';
import { Clinic, Patient } from '../types';

export default function ValidationDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<DoctorReview[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  
  // added for State filter
  const [selectedState, setSelectedState] = useState<string>('All');
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      try {
        let reviewsQuery, reportsQuery, outcomesQuery;

        if (profile.role === 'admin' || profile.role === 'state_monitor') {
          reviewsQuery = query(collection(db, 'doctor_reviews'), orderBy('createdAt', 'desc'));
          reportsQuery = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
          outcomesQuery = query(collection(db, 'outcomes'), orderBy('createdAt', 'desc'));
        } else if (profile.role === 'doctor') {
          reviewsQuery = query(collection(db, 'doctor_reviews'), where('doctorId', '==', profile.uid), orderBy('createdAt', 'desc'));
          reportsQuery = query(collection(db, 'reports'), where('doctorId', '==', profile.uid), orderBy('createdAt', 'desc'));
          outcomesQuery = query(collection(db, 'outcomes'), where('doctorId', '==', profile.uid), orderBy('createdAt', 'desc'));
        } else {
          // Clinic admin could need reports by clinicId
          reviewsQuery = query(collection(db, 'doctor_reviews'), orderBy('createdAt', 'desc')); // Not tracking clinic id on review properly, but keeping simple for now
          reportsQuery = query(collection(db, 'reports'), where('clinicId', '==', profile.clinicId), orderBy('createdAt', 'desc'));
          outcomesQuery = query(collection(db, 'outcomes'), orderBy('createdAt', 'desc')); 
        }

        const [reviewsSnap, reportsSnap, outcomesSnap, clinicsSnap, patientsSnap] = await Promise.all([
          getDocs(reviewsQuery),
          getDocs(reportsQuery),
          getDocs(outcomesQuery),
          getDocs(collection(db, 'clinics')),
          getDocs(collection(db, 'patients'))
        ]);

        setReviews(reviewsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as DoctorReview)));
        setReports(reportsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Report)));
        setOutcomes(outcomesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Outcome)));
        setClinics(clinicsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Clinic)));
        setPatients(patientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Patient)));
      } catch (error) {
        console.error("Error fetching validation data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  const exportCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    
    // Extract headers dynamically
    const headers = Object.keys(data[0]);
    
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          let val = row[header];
          
          if (val && typeof val === 'object' && val.seconds !== undefined && val.nanoseconds !== undefined) {
             // Handle Firestore Timestamp
             val = new Date(val.seconds * 1000).toISOString();
          } else if (val && typeof val === 'object' && !Array.isArray(val)) {
             // Handle nested objects (like questionnaireAnswers)
             val = JSON.stringify(val);
          } else if (Array.isArray(val)) {
             // Handle arrays appropriately
             val = val.join('; ');
          } else if (val === null || val === undefined) {
             val = '';
          }
          
          if (typeof val === 'string') {
             // Escape quotes inside strings and wrap field in quotes 
             val = `"${val.replace(/"/g, '""')}"`;
          }
          
          return val;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  const uniqueStates = Array.from(new Set(clinics.map(c => c.state).filter(Boolean))).sort() as string[];

  const filteredReports = reports.filter(r => {
    if (selectedState === 'All') return true;
    const clinic = clinics.find(c => c.id === r.clinicId);
    return clinic && clinic.state === selectedState;
  });

  const filteredReviews = reviews.filter(r => {
    if (selectedState === 'All') return true;
    const patient = patients.find(p => p.id === r.patientId);
    if (!patient) return false;
    const clinic = clinics.find(c => c.id === patient.clinicId);
    return clinic && clinic.state === selectedState;
  });

  const filteredOutcomes = outcomes.filter(o => {
    if (selectedState === 'All') return true;
    const patient = patients.find(p => p.id === o.patientId);
    if (!patient) return false;
    const clinic = clinics.find(c => c.id === patient.clinicId);
    return clinic && clinic.state === selectedState;
  });

  const totalReviews = filteredReviews.length;
  const correctReviews = filteredReviews.filter(r => r.agreement === 'correct').length;
  const partialReviews = filteredReviews.filter(r => r.agreement === 'partial').length;
  const incorrectReviews = filteredReviews.filter(r => r.agreement === 'incorrect').length;

  const accuracy = totalReviews > 0 ? ((correctReviews + (partialReviews * 0.5)) / totalReviews) * 100 : 0;
  
  const totalOutcomes = filteredOutcomes.length;
  const improvedOutcomes = filteredOutcomes.filter(o => o.improvement).length;
  const improvementRate = totalOutcomes > 0 ? (improvedOutcomes / totalOutcomes) * 100 : 0;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-white font-display">Clinical Validation</h2>
          <p className="text-zinc-400 mt-2 text-lg">AI accuracy tracking and patient outcome analysis.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {(profile?.role === 'admin' || profile?.role === 'state_monitor') && (
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="pl-12 pr-10 py-3 bg-white/5 border border-white/10 rounded-2xl text-white appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="All" className="bg-zinc-900">All States</option>
                {uniqueStates.map(state => (
                  <option key={state} value={state} className="bg-zinc-900">{state}</option>
                ))}
              </select>
            </div>
          )}
          <button 
            onClick={() => exportCSV(filteredReports, 'ai_reports.csv')}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-zinc-300 hover:text-white font-medium transition-all flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Export Reports
          </button>
          <button 
            onClick={() => exportCSV(filteredReviews, 'doctor_reviews.csv')}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-zinc-300 hover:text-white font-medium transition-all flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Export Reviews
          </button>
          <button 
            onClick={() => exportCSV(filteredOutcomes, 'patient_outcomes.csv')}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-zinc-300 hover:text-white font-medium transition-all flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Export Outcomes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="p-8 glass-card rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.1)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-zinc-400 font-medium">Total Patients</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-white tracking-tighter font-display">{totalOutcomes}</span>
          </div>
          <p className="text-sm text-zinc-500 mt-2">With tracked outcomes</p>
        </div>

        <div className="p-8 glass-card rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.1)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <Stethoscope className="w-6 h-6" />
            </div>
            <h3 className="text-zinc-400 font-medium">Diagnosis Accuracy</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-white tracking-tighter font-display">{accuracy.toFixed(1)}%</span>
          </div>
          <p className="text-sm text-zinc-500 mt-2">Based on {totalReviews} reviews</p>
        </div>

        <div className="p-8 glass-card rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.1)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-zinc-400 font-medium">Kit Accuracy</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-white tracking-tighter font-display">{accuracy.toFixed(1)}%</span>
          </div>
          <p className="text-sm text-zinc-500 mt-2">Recommendation match rate</p>
        </div>

        <div className="p-8 glass-card rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.1)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20">
              <LineChart className="w-6 h-6" />
            </div>
            <h3 className="text-zinc-400 font-medium">Treatment Success</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-white tracking-tighter font-display">{improvementRate.toFixed(1)}%</span>
          </div>
          <p className="text-sm text-zinc-500 mt-2">Patient improvement rate</p>
        </div>

        <div className="p-8 glass-card rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.1)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-red-500/10 rounded-xl text-red-400 border border-red-500/20">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-zinc-400 font-medium">Error Breakdown</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-white tracking-tighter font-display">{incorrectReviews}</span>
            <span className="text-xl text-zinc-500">/ {partialReviews}</span>
          </div>
          <p className="text-sm text-zinc-500 mt-2">Incorrect / Partial matches</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-8 glass-card rounded-[40px] shadow-[0_0_30px_rgba(0,0,0,0.2)]">
          <h3 className="text-xl font-bold text-white mb-6 font-display">Recent Doctor Reviews</h3>
          <div className="space-y-4">
            {filteredReviews.slice(0, 5).map(review => (
              <div key={review.id} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-zinc-500 uppercase tracking-widest font-medium font-mono">
                    {review.createdAt?.seconds ? new Date(review.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}
                  </span>
                  <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase border ${
                    review.agreement === 'correct' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    review.agreement === 'partial' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                    'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {review.agreement}
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-zinc-400"><strong className="text-zinc-300">AI:</strong> {review.aiDiagnosis.slice(0, 100)}...</p>
                  {review.agreement !== 'correct' && (
                    <p className="text-sm text-zinc-400"><strong className="text-zinc-300">Doctor:</strong> {review.doctorDiagnosis.slice(0, 100)}...</p>
                  )}
                </div>
              </div>
            ))}
            {filteredReviews.length === 0 && (
              <div className="text-center py-10 text-zinc-500 italic">No reviews submitted yet.</div>
            )}
          </div>
        </div>

        <div className="p-8 glass-card rounded-[40px] shadow-[0_0_30px_rgba(0,0,0,0.2)]">
          <h3 className="text-xl font-bold text-white mb-6 font-display">Recent Patient Outcomes</h3>
          <div className="space-y-4">
            {filteredOutcomes.slice(0, 5).map(outcome => (
              <div key={outcome.id} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-zinc-500 uppercase tracking-widest font-medium font-mono">
                    {new Date(outcome.followUpDate).toLocaleDateString()}
                  </span>
                  <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase border ${
                    outcome.improvement ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {outcome.improvement ? 'Improved' : 'No Improvement'}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">{outcome.notes}</p>
              </div>
            ))}
            {filteredOutcomes.length === 0 && (
              <div className="text-center py-10 text-zinc-500 italic">No outcomes tracked yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
