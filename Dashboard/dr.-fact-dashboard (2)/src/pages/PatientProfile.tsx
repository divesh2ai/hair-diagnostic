import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Patient, Report, RiskLevel, Outcome, DoctorReview } from '../types';
import { 
  ArrowLeft, 
  Calendar, 
  Phone, 
  Mail, 
  Activity, 
  Plus, 
  Clock, 
  ChevronRight,
  Stethoscope,
  Pill,
  TrendingUp,
  CheckCircle2,
  ClipboardCheck,
  LineChart,
  User,
  Sparkles
} from 'lucide-react';
import AIDiagnosisModal from '../components/AIDiagnosisModal';
import ReviewDiagnosisModal from '../components/ReviewDiagnosisModal';
import OutcomeModal from '../components/OutcomeModal';
import ReportViewModal from '../components/ReportViewModal';

const RiskBadge = ({ level }: { level?: RiskLevel }) => {
  const colors = {
    low: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    medium: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    high: 'bg-red-400/10 text-red-400 border-red-400/20',
  };
  return (
    <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${colors[level || 'low']}`}>
      {level || 'Low'} Risk
    </span>
  );
};

export default function PatientProfile() {
  const { id } = useParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [doctorReviews, setDoctorReviews] = useState<DoctorReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAIModal, setShowAIModal] = useState(false);
  const [reviewingReport, setReviewingReport] = useState<Report | null>(null);
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'history' | 'notes'>('overview');

  useEffect(() => {
    if (!id) return;

    const patientRef = doc(db, 'patients', id);
    const unsubscribePatient = onSnapshot(patientRef, (docSnap) => {
      if (docSnap.exists()) {
        setPatient({ id: docSnap.id, ...docSnap.data() } as Patient);
      }
      setLoading(false);
    });

    const reportsRef = collection(db, 'reports');
    const qReports = query(reportsRef, where('patientId', '==', id), orderBy('createdAt', 'desc'));
    const unsubscribeReports = onSnapshot(qReports, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report)));
    });

    const outcomesRef = collection(db, 'outcomes');
    const qOutcomes = query(outcomesRef, where('patientId', '==', id), orderBy('createdAt', 'desc'));
    const unsubscribeOutcomes = onSnapshot(qOutcomes, (snapshot) => {
      setOutcomes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Outcome)));
    });

    const reviewsRef = collection(db, 'doctor_reviews');
    const qReviews = query(reviewsRef, where('patientId', '==', id), orderBy('createdAt', 'desc'));
    const unsubscribeReviews = onSnapshot(qReviews, (snapshot) => {
      setDoctorReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DoctorReview)));
    });

    return () => {
      unsubscribePatient();
      unsubscribeReports();
      unsubscribeOutcomes();
      unsubscribeReviews();
    };
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-96"><Activity className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  if (!patient) return <div className="text-center py-20 text-white/40">Patient not found</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <Link to="/patients" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group">
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Patients</span>
        </Link>
        <div className="flex gap-3">
          <button className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-white font-semibold hover:bg-white/10 transition-all">
            Edit Profile
          </button>
          <button 
            onClick={() => setShowAIModal(true)}
            className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-semibold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New AI Diagnosis
          </button>
        </div>
      </div>

      {showAIModal && (
        <AIDiagnosisModal 
          patientId={patient.id} 
          patientName={patient.name}
          clinicId={patient.clinicId} 
          onClose={() => setShowAIModal(false)}
          onSuccess={() => {}}
        />
      )}

      {reviewingReport && (
        <ReviewDiagnosisModal
          report={reviewingReport}
          onClose={() => setReviewingReport(null)}
          onSuccess={() => {}}
        />
      )}

      {showOutcomeModal && (
        <OutcomeModal
          patientId={patient.id}
          onClose={() => setShowOutcomeModal(false)}
          onSuccess={() => {}}
        />
      )}

      {viewingReport && (
        <ReportViewModal
          report={viewingReport}
          onClose={() => setViewingReport(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 p-10 glass-card rounded-[40px] flex flex-col md:flex-row gap-10 items-start md:items-center shadow-[0_0_30px_rgba(0,0,0,0.2)]">
          <div className="w-32 h-32 rounded-[32px] bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-4xl font-bold text-white shadow-2xl shadow-emerald-500/40 border border-emerald-400/20">
            {patient.name[0]}
          </div>
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="text-4xl font-bold tracking-tight text-white font-display">{patient.name}</h1>
              <RiskBadge level={patient.riskLevel} />
              <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-zinc-400">
                {patient.age || 'N/A'} YRS • {patient.gender?.toUpperCase() || 'UNKNOWN'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
              <div className="flex items-center gap-3 text-zinc-400">
                <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-sm font-medium">{patient.phone || 'No phone'}</span>
              </div>
              <div className="flex items-center gap-3 text-zinc-400">
                <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-sm font-medium">{patient.email || 'No email'}</span>
              </div>
              <div className="flex items-center gap-3 text-zinc-400">
                <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-sm font-medium">Last Visit: {patient.lastVisit?.seconds ? new Date(patient.lastVisit.seconds * 1000).toLocaleDateString() : 'None'}</span>
              </div>
              <div className="flex items-center gap-3 text-zinc-400">
                <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                  <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-sm font-medium">Status: Under Active Treatment</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-10 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-[40px] text-white flex flex-col justify-between shadow-2xl shadow-emerald-500/20 border border-emerald-500/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Activity className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <p className="text-emerald-200/80 font-bold uppercase tracking-widest text-xs">Current Hair Score</p>
            <div className="flex items-baseline gap-2 mt-2">
              <h2 className="text-7xl font-bold tracking-tighter font-display">{patient.hairScore || 0}</h2>
              <span className="text-emerald-200 text-xl font-medium">/100</span>
            </div>
          </div>
          <div className="relative z-10 flex items-center gap-3 bg-black/20 backdrop-blur-md p-4 rounded-3xl mt-8 border border-white/10">
            <div className="p-2 bg-white/10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <p className="text-xs text-emerald-100/80 font-medium">Trend Analysis</p>
              <p className="text-sm font-bold text-white">+12% from last month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/10">
        {(['overview', 'reports', 'history', 'notes'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 rounded-t-2xl font-semibold text-sm capitalize transition-all whitespace-nowrap ${
              activeTab === tab 
                ? 'bg-white/10 text-zinc-100 border-b-2 border-emerald-500' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
          >
            {tab === 'history' ? 'Assessment History' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="p-8 glass-card rounded-[40px] shadow-[0_0_30px_rgba(0,0,0,0.2)]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-white font-display">Treatment Progress</h3>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">3 Month Timeline</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-2">
                {[1, 2, 3].map(month => {
                   const hasOutcome = outcomes.find(o => {
                      const d = new Date(o.followUpDate);
                      const regDate = patient.createdAt?.seconds ? new Date(patient.createdAt.seconds * 1000) : new Date();
                      const diffMonths = (d.getFullYear() - regDate.getFullYear()) * 12 + (d.getMonth() - regDate.getMonth());
                      return diffMonths === month;
                   });
                   return (
                     <div key={month} className={`p-4 rounded-2xl border transition-all ${
                       hasOutcome ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/5 opacity-40'
                     }`}>
                       <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Month {month}</p>
                       <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden mb-3">
                         {hasOutcome && <div className={`h-full ${hasOutcome.improvement ? 'bg-emerald-500' : 'bg-red-500'} w-full`} />}
                       </div>
                       <p className="text-[10px] text-zinc-400 font-medium">
                         {hasOutcome ? (hasOutcome.improvement ? 'Regrowth Noted' : 'Stable Condition') : 'Pending Visit'}
                       </p>
                     </div>
                   );
                })}
              </div>
            </div>

            <div className="p-8 glass-card rounded-[40px] shadow-[0_0_30px_rgba(0,0,0,0.2)]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-white font-display">Diagnosis History</h3>
                <button onClick={() => setActiveTab('reports')} className="text-emerald-400 text-sm font-semibold hover:text-emerald-300 transition-colors">View All Reports</button>
              </div>
              
              <div className="space-y-8 relative">
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-white/5 rounded-full"></div>
              
              {reports.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 italic">No reports generated yet.</div>
              ) : (
                reports.map((report, idx) => (
                  <div key={report.id} className="flex gap-8 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 border-4 border-[#0a0a0a] ${
                      idx === 0 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-white/10'
                    }`}>
                      {idx === 0 ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Clock className="w-3 h-3 text-zinc-500" />}
                    </div>
                    <div className="flex-1 p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer group" onClick={() => setViewingReport(report)}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-zinc-100">AI Analysis #{report.id.slice(0, 6)}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                            report.riskLevel === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                            : report.riskLevel === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}>
                            {report.riskLevel} Risk
                          </span>
                        </div>
                        <span className="text-xs text-zinc-500 font-mono">{report.createdAt?.seconds ? new Date(report.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}</span>
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2">{report.diagnosis}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {report.recommendedProducts.slice(0, 3).map((p, i) => (
                            <div key={i} className="w-8 h-8 rounded-lg bg-white/5 border-2 border-[#0a0a0a] flex items-center justify-center text-[10px] font-bold text-zinc-500">
                              {p[0]}
                            </div>
                          ))}
                        </div>
                        <button 
                          onClick={() => setReviewingReport(report)}
                          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-medium text-zinc-300 hover:text-white transition-colors border border-white/5"
                        >
                          <ClipboardCheck className="w-4 h-4" />
                          Review AI
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="p-8 glass-card rounded-[40px] shadow-[0_0_30px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white font-display">Treatment Plan</h3>
              <Pill className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Active Prescription</p>
                <p className="text-sm font-semibold text-zinc-100 mt-1">Minoxidil 5% Solution</p>
                <p className="text-xs text-zinc-400 mt-1">Apply twice daily to affected areas.</p>
              </div>
              <button className="w-full py-4 border border-dashed border-white/10 rounded-2xl text-xs font-medium text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition-all hover:bg-white/[0.02]">
                + Add Treatment
              </button>
            </div>
          </div>

          <div className="p-8 glass-card rounded-[40px] shadow-[0_0_30px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white font-display">Clinical Outcomes</h3>
              <LineChart className="w-5 h-5 text-emerald-400" />
            </div>
            
            <div className="space-y-4 mb-6">
              {outcomes.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 italic text-sm">No outcomes recorded yet.</div>
              ) : (
                outcomes.map(outcome => (
                  <div key={outcome.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider font-mono">
                        {new Date(outcome.followUpDate).toLocaleDateString()}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                        outcome.improvement 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {outcome.improvement ? 'Improved' : 'No Improvement'}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400">{outcome.notes}</p>
                  </div>
                ))
              )}
            </div>

            <button 
              onClick={() => setShowOutcomeModal(true)}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-medium text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Track New Outcome
            </button>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white font-display">All Reports</h3>
            <button 
              onClick={() => setShowAIModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-500 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              New Report
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((report) => (
              <div key={report.id} className="p-6 glass-card rounded-3xl hover:border-white/20 transition-all group shadow-[0_0_20px_rgba(0,0,0,0.1)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest font-mono">
                    {report.createdAt?.seconds ? new Date(report.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}
                  </span>
                  <RiskBadge level={report.riskLevel} />
                </div>
                <p className="text-sm text-zinc-400 line-clamp-3 mb-4">{report.diagnosis}</p>
                <button 
                  onClick={() => setReviewingReport(report)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-medium text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2 border border-white/5"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Review Report
                </button>
              </div>
            ))}
            {reports.length === 0 && (
              <div className="col-span-full text-center py-10 text-zinc-500 italic">No reports found.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="p-10 glass-card rounded-[40px] shadow-[0_0_40px_rgba(0,0,0,0.3)] border border-white/5">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-bold text-white font-display">Patient Medical History</h3>
              <p className="text-zinc-500 text-sm mt-1 font-medium">A chronological history of all clinical events, AI analyses, and doctor interactions.</p>
            </div>
            <div className="flex gap-2">
              <span className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                AI Generated
              </span>
              <span className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Doctor Reviewed
              </span>
            </div>
          </div>

          <div className="space-y-0 relative">
            <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gradient-to-b from-emerald-500/30 via-white/5 to-white/5 rounded-full"></div>
            
            {[
              { id: 'joined', type: 'joined', date: patient.createdAt?.seconds ? new Date(patient.createdAt.seconds * 1000) : new Date(0), title: 'Patient Registration', description: `Patient ${patient.name} joined the clinic records.`, icon: User, color: 'bg-zinc-700' },
              ...reports.map(r => ({ ...r, type: 'report', date: r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000) : new Date(), title: 'AI Diagnosis Generated', description: r.diagnosis, icon: Sparkles, color: 'bg-emerald-500' })),
              ...outcomes.map(o => ({ ...o, type: 'outcome', date: o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000) : new Date(o.followUpDate), title: 'Clinical Outcome Recorded', description: o.notes, icon: TrendingUp, color: 'bg-purple-500' })),
              ...doctorReviews.map(dr => ({ ...dr, type: 'review', date: dr.createdAt?.seconds ? new Date(dr.createdAt.seconds * 1000) : new Date(), title: 'Doctor Clinical Review', description: dr.notes, icon: ClipboardCheck, color: 'bg-blue-500' }))
            ].sort((a, b) => b.date.getTime() - a.date.getTime()).map((item, idx) => (
              <div key={`${item.type}-${(item as any).id || idx}`} className="flex gap-8 relative group pb-10 last:pb-0">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 border-4 border-[#0a0a0a] transition-transform duration-300 group-hover:scale-110 shadow-lg ${item.color}`}>
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-3xl p-6 group-hover:bg-white/[0.04] transition-all group-hover:border-white/10 group-hover:-translate-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="text-lg font-bold text-zinc-100">{item.title}</h4>
                      {item.type === 'report' && (
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20 rounded-md">AI Agent</span>
                      )}
                      {item.type === 'review' && (
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-widest border border-blue-500/20 rounded-md">Verified</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {(item as any).stateMonitorStatus && (
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${
                          (item as any).stateMonitorStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          (item as any).stateMonitorStatus === 'flagged' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                        }`}>
                          Monitor: {(item as any).stateMonitorStatus}
                        </span>
                      )}
                      <time className="text-xs text-zinc-500 font-bold uppercase tracking-wider bg-white/5 px-3 py-1 rounded-full border border-white/5">
                        {item.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </time>
                    </div>
                  </div>
                  <p className="text-zinc-400 text-sm leading-relaxed font-medium">
                    {item.description}
                  </p>
                  
                  {item.type === 'report' && (
                    <div className="mt-4 flex flex-wrap gap-2">
                       {(item as any).recommendedProducts?.slice(0, 4).map((p: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-medium text-zinc-500">{p}</span>
                       ))}
                    </div>
                  )}

                  {item.type === 'outcome' && (
                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                      <div className={`w-2 h-2 rounded-full ${(item as any).improvement ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="text-[10px] font-bold uppercase text-purple-300">
                        {(item as any).improvement ? 'Patient Improvement Noted' : 'Stable / No Significant Change'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {reports.length === 0 && outcomes.length === 0 && doctorReviews.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                  <Clock className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="text-zinc-500 font-medium italic">The patient medical history will populate as clinical events are recorded.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-8">
          <div className="p-8 glass-card rounded-[40px] shadow-[0_0_30px_rgba(0,0,0,0.2)]">
            <h3 className="text-2xl font-bold text-zinc-100 font-display mb-6">Patient Medical Observations</h3>
            <div className="space-y-6">
              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">Diagnostic Summary</h4>
                <p className="text-zinc-400 text-sm leading-relaxed">{patient.notes || 'No clinical observations recorded yet. Use the assessment flow to generate AI-driven notes.'}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Medical Constraints</h4>
                  <ul className="space-y-2">
                    {patient.medicalHistory && patient.medicalHistory.length > 0 ? (
                      patient.medicalHistory.map((item, i) => (
                        <li key={i} className="text-sm text-zinc-400 flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-blue-500" />
                          {item}
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-zinc-500 italic">No medical constraints specified.</li>
                    )}
                  </ul>
                </div>
                <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-3">Lifestyle Context</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {reports[0]?.lifestyleImpact || 'No lifestyle data available. Assessment pending.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
