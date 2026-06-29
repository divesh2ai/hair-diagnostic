import { useState, useEffect } from 'react';
import { 
  Users, 
  AlertCircle, 
  Plus, 
  ArrowRight, 
  Calendar,
  Clock,
  CheckCircle2,
  Search,
  ChevronRight,
  Sparkles,
  MessageSquare,
  ClipboardCheck,
  Zap,
  BookOpen,
  Library,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Patient, UserProfile, Report } from '../types';
import { useLanguage } from '../lib/i18n';
import ReviewDiagnosisModal from './ReviewDiagnosisModal';

interface Props {
  profile: UserProfile;
}

export default function DoctorDashboard({ profile }: Props) {
  const { t } = useLanguage();
  const [highRiskPatients, setHighRiskPatients] = useState<Patient[]>([]);
  const [newPatients, setNewPatients] = useState<Patient[]>([]);
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [todaysPatients, setTodaysPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingReport, setReviewingReport] = useState<Report | null>(null);

  useEffect(() => {
    const isAdmin = profile.role === 'admin';
    if (!profile.clinicId && !isAdmin) return;

    const patientsRef = collection(db, 'patients');
    
    // High Risk Patients
    let highRiskQuery = query(
      patientsRef, 
      where('riskLevel', '==', 'high'),
      limit(5)
    );
    if (!isAdmin) {
      highRiskQuery = query(highRiskQuery, where('doctorId', '==', profile.uid));
    }

    const unsubscribeHighRisk = onSnapshot(highRiskQuery, (snapshot) => {
      setHighRiskPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    });

    // New Patients
    let newPatientsQuery = query(
      patientsRef,
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    if (!isAdmin) {
      newPatientsQuery = query(newPatientsQuery, where('doctorId', '==', profile.uid));
    }

    const unsubscribeNew = onSnapshot(newPatientsQuery, (snapshot) => {
      setNewPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    });

    // Today's Patients
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let todaysPatientsQuery = query(
      patientsRef,
      where('createdAt', '>=', Timestamp.fromDate(today)),
      orderBy('createdAt', 'desc')
    );
    if (!isAdmin) {
      todaysPatientsQuery = query(todaysPatientsQuery, where('doctorId', '==', profile.uid));
    }

    const unsubscribeTodays = onSnapshot(todaysPatientsQuery, (snapshot) => {
      setTodaysPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    });

    // Recent Reports
    const reportsRef = collection(db, 'reports');
    let recentReportsQuery = query(
      reportsRef,
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    if (!isAdmin) {
      recentReportsQuery = query(recentReportsQuery, where('doctorId', '==', profile.uid));
    }

    const unsubscribeReports = onSnapshot(recentReportsQuery, (snapshot) => {
      setRecentReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report)));
      setLoading(false);
    });

    return () => {
      unsubscribeHighRisk();
      unsubscribeNew();
      unsubscribeReports();
      unsubscribeTodays();
    };
  }, [profile.uid]);

  // Command Center Logic: Priority Sorting
  const commandCenterPatients = [...todaysPatients]
    .sort((a, b) => {
      // High risk first
      if (a.riskLevel === 'high' && b.riskLevel !== 'high') return -1;
      if (b.riskLevel === 'high' && a.riskLevel !== 'high') return 1;
      // Then medium risk
      if (a.riskLevel === 'medium' && b.riskLevel === 'low') return -1;
      if (b.riskLevel === 'medium' && a.riskLevel === 'low') return 1;
      // Then by score (lower score = higher priority)
      return (a.hairScore || 100) - (b.hairScore || 100);
    });

  const quickActions = [
    { name: 'New Patient', icon: Plus, link: '/patients', color: 'bg-emerald-600', desc: 'Register a new clinic visitor' },
    { name: 'AI Assessment', icon: Sparkles, link: '/patients', color: 'bg-purple-600', desc: 'Start a new hair analysis' },
    { name: 'Clinical Reports', icon: ClipboardCheck, link: '/reports', color: 'bg-blue-600', desc: 'Review and approve assessments' },
  ];

  const knowledgeBase = [
    { title: 'Androgenetic Alopecia Protocols', type: 'Protocol', duration: '5 min read', icon: BookOpen, color: 'text-blue-400' },
    { title: 'Minoxidil vs Finasteride: 2024 Study', type: 'Clinical Study', duration: '12 min read', icon: FileText, color: 'text-purple-400' },
    { title: 'Scalp Microneedling Best Practices', type: 'Guide', duration: '8 min read', icon: Library, color: 'text-emerald-400' },
  ];

  return (
    <div className="space-y-8">
      {reviewingReport && (
        <ReviewDiagnosisModal
          report={reviewingReport}
          onClose={() => setReviewingReport(null)}
          onSuccess={() => {}}
        />
      )}

      {/* Doctor Command Center */}
      <div className="p-8 glass-card rounded-[40px] border border-emerald-500/10 shadow-[0_0_40px_rgba(0,0,0,0.3)] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5">
          <Zap className="w-48 h-48 text-emerald-400" />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                <Zap className="w-5 h-5 text-zinc-950" />
              </div>
              <h2 className="text-3xl font-bold text-white font-display">Doctor Command Center</h2>
            </div>
            <p className="text-zinc-400 font-medium">Prioritized patient list based on hair health risk and score.</p>
          </div>
          <div className="flex gap-4">
            <div className="px-5 py-3 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center min-w-[100px]">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1.5">Today</span>
              <span className="text-2xl font-bold text-white font-display leading-none">{todaysPatients.length}</span>
            </div>
            <div className="px-5 py-3 bg-red-500/10 rounded-2xl border border-red-500/20 flex flex-col items-center min-w-[100px]">
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest leading-none mb-1.5">Critical</span>
              <span className="text-2xl font-bold text-red-500 font-display leading-none">{highRiskPatients.length}</span>
            </div>
            <div className="px-5 py-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 flex flex-col items-center min-w-[100px]">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none mb-1.5">Pending</span>
              <span className="text-2xl font-bold text-blue-500 font-display leading-none">
                {recentReports.filter(r => !r.aiConfidence || r.aiConfidence < 90).length}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 relative z-10">
          <div className="grid grid-cols-12 px-6 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
            <div className="col-span-4">Patient Name</div>
            <div className="col-span-2 text-center">Latest Score</div>
            <div className="col-span-3 text-center">Risk Level</div>
            <div className="col-span-3 text-right">Action</div>
          </div>
          
          {commandCenterPatients.length === 0 ? (
            <div className="p-10 text-center glass-card border-dashed border-white/10 rounded-3xl">
              <p className="text-zinc-500 italic">No patients registered today. Use the Quick Actions to add a new patient.</p>
            </div>
          ) : (
            commandCenterPatients.map((patient) => (
              <motion.div 
                key={patient.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-12 items-center px-6 py-5 bg-white/[0.02] border border-white/5 rounded-3xl hover:bg-white/[0.04] transition-all group"
              >
                <div className="col-span-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg ${
                    patient.riskLevel === 'high' ? 'bg-red-600' : patient.riskLevel === 'medium' ? 'bg-yellow-600' : 'bg-emerald-600'
                  }`}>
                    {patient.name[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{patient.name}</h4>
                    <p className="text-[10px] text-zinc-500 font-mono">{patient.phone}</p>
                  </div>
                </div>
                <div className="col-span-2 text-center">
                  <span className={`text-xl font-bold font-display ${
                    (patient.hairScore || 0) < 50 ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {patient.hairScore || 'N/A'}
                  </span>
                </div>
                <div className="col-span-3 flex justify-center">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                    patient.riskLevel === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
                    : patient.riskLevel === 'medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  }`}>
                    {patient.riskLevel}
                  </span>
                </div>
                <div className="col-span-3 flex justify-end">
                  <Link 
                    to={`/patients/${patient.id}`}
                    className="p-3 bg-white/5 hover:bg-emerald-500 hover:text-white rounded-xl text-zinc-400 transition-all border border-white/5 hover:border-emerald-500/50"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Top Banner - Next Patient */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 p-8 glass-card rounded-3xl relative overflow-hidden group shadow-[0_0_30px_rgba(0,0,0,0.2)]">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Calendar className="w-32 h-32 text-zinc-100" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] mb-4">Next Patient</p>
            <h2 className="text-3xl font-bold text-white mb-2 font-display">No appointments scheduled</h2>
            <p className="text-zinc-400">Your schedule is clear for today. Take this time to review pending reports.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-8 glass-card rounded-3xl flex flex-col justify-between shadow-[0_0_20px_rgba(0,0,0,0.1)]">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Total Patients</p>
            <p className="text-4xl font-bold text-white mt-4 font-display">{newPatients.length + highRiskPatients.length + 32}</p>
          </div>
          <div className="p-8 glass-card rounded-3xl flex flex-col justify-between shadow-[0_0_20px_rgba(0,0,0,0.1)]">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Remaining Today</p>
            <p className="text-4xl font-bold text-white mt-4 font-display">0</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Recent AI Reports */}
          <div className="p-8 glass-card rounded-3xl shadow-[0_0_30px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-xl text-purple-400 border border-purple-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white font-display">Recent AI Diagnoses</h3>
              </div>
              <Link to="/reports" className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors">View All</Link>
            </div>
            
            <div className="space-y-4">
              {recentReports.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 italic">No recent reports.</div>
              ) : (
                recentReports.map((report) => (
                  <div key={report.id} className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] hover:border-white/10 transition-all group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-zinc-100">{report.patientName || 'Unknown Patient'}</span>
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
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-white/5 border border-white/5 rounded-lg text-xs font-medium text-zinc-400">
                          {report.aiConfidence || 85}% Confidence
                        </span>
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
                ))
              )}
            </div>
          </div>

          {/* Today's Full Schedule */}
          <div className="p-8 glass-card rounded-3xl min-h-[400px] flex flex-col shadow-[0_0_30px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 border border-white/10 rounded-xl text-zinc-300">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white font-display">Today's Full Schedule</h3>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500">
                <Calendar className="w-8 h-8" />
              </div>
              <div>
                <p className="text-zinc-400 font-medium">No appointments for today</p>
                <button className="mt-4 flex items-center gap-2 text-xs font-medium text-zinc-300 hover:text-white bg-white/5 px-4 py-2 rounded-xl transition-all border border-white/5 hover:border-white/10 mx-auto">
                  <Calendar className="w-4 h-4" />
                  View Weekly Calendar
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {quickActions.map((action) => (
              <Link 
                key={action.name} 
                to={action.link}
                className="group p-6 glass-card rounded-3xl hover:border-white/20 transition-all shadow-[0_0_20px_rgba(0,0,0,0.1)]"
              >
                <div className={`w-12 h-12 rounded-2xl ${action.color} flex items-center justify-center text-white mb-4 shadow-lg shadow-black/20 group-hover:scale-110 transition-transform`}>
                  <action.icon className="w-6 h-6" />
                </div>
                <p className="font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{action.name}</p>
                <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-bold">{action.desc}</p>
              </Link>
            ))}
          </div>

          {/* Clinical Knowledge Base */}
          <div className="p-8 glass-card rounded-3xl shadow-[0_0_30px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400 border border-blue-500/20">
                  <Library className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white font-display">Clinical Knowledge Base</h3>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Search protocols..." 
                  className="bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 w-48"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {knowledgeBase.map((item, i) => (
                <div key={i} className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] transition-all cursor-pointer group">
                  <div className={`p-3 bg-white/5 rounded-xl ${item.color} mb-4 w-fit group-hover:scale-110 transition-transform`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-100 mb-2 leading-tight">{item.title}</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{item.type}</span>
                    <span className="text-[10px] text-zinc-600">{item.duration}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="w-full mt-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-all border border-white/5 uppercase tracking-widest">
              Access Full Library
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {/* Critical Attention */}
          <div className="p-8 glass-card rounded-3xl shadow-[0_0_30px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-xl border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white font-display">Critical</h3>
              </div>
              <span className="px-3 py-1 bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-red-500/20">
                {highRiskPatients.length} High Risk
              </span>
            </div>

            <div className="space-y-4">
              {highRiskPatients.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 italic">No high-risk patients.</div>
              ) : (
                highRiskPatients.map((patient) => (
                  <Link 
                    key={patient.id} 
                    to={`/patients/${patient.id}`}
                    className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 font-bold border border-red-500/20">
                        {patient.name[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-100 text-sm">{patient.name}</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono mt-0.5">Score: {patient.hairScore || 'N/A'}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* New Registrations */}
          <div className="p-8 glass-card rounded-3xl shadow-[0_0_30px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/20">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white font-display">New</h3>
              </div>
              <Link to="/patients" className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors">View All</Link>
            </div>

            <div className="space-y-4">
              {newPatients.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 italic text-sm">No new patients.</div>
              ) : (
                newPatients.map((patient) => (
                  <Link 
                    key={patient.id} 
                    to={`/patients/${patient.id}`}
                    className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold border border-blue-500/20">
                        {patient.name[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-100 text-sm">{patient.name}</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">New Patient</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
