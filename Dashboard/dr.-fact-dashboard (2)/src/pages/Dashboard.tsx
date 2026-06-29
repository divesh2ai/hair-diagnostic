import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { 
  Users, 
  FileText, 
  AlertCircle, 
  Activity, 
  Plus,
  TrendingUp,
  ArrowRight,
  Stethoscope,
  Building2,
  Loader2,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Patient, Report, Clinic } from '../types';
import DoctorDashboard from '../components/DoctorDashboard';
import AdminDashboard from '../components/AdminDashboard';

import { useLanguage } from '../lib/i18n';

export default function Dashboard() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'admin' | 'doctor'>('admin');
  const [counts, setCounts] = useState({
    patients: 0,
    reports: 0,
    highRisk: 0,
    clinics: 0
  });
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  
  const isAdmin = profile?.role === 'admin';
  const isClinicAdmin = profile?.role === 'clinic_admin';
  const isDoctor = profile?.role === 'doctor';

  useEffect(() => {
    if (!profile) return;
    if (isDoctor || isAdmin) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Patients count
        const patientsRef = collection(db, 'patients');
        const patientsQuery = query(patientsRef, where('clinicId', '==', profile.clinicId));
        const patientsSnap = await getDocs(patientsQuery);
        
        // High risk patients
        const highRiskPatients = patientsSnap.docs.filter(doc => doc.data().riskLevel === 'high').length;

        // Reports count
        const reportsRef = collection(db, 'reports');
        const reportsQuery = query(reportsRef, where('clinicId', '==', profile.clinicId));
        const reportsSnap = await getDocs(reportsQuery);

        setCounts({
          patients: patientsSnap.size,
          reports: reportsSnap.size,
          highRisk: highRiskPatients,
          clinics: 0
        });

        // Recent Reports
        const recentReportsQuery = query(reportsRef, where('clinicId', '==', profile.clinicId), orderBy('createdAt', 'desc'), limit(3));
        
        const unsubscribeReports = onSnapshot(recentReportsQuery, (snapshot) => {
          setRecentReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report)));
        });

        setLoading(false);
        return () => unsubscribeReports();
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [profile, isAdmin, isDoctor]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  if ((isDoctor || isClinicAdmin) && !profile?.clinicId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-20 h-20 bg-yellow-500/20 rounded-[32px] flex items-center justify-center text-yellow-500">
          <Building2 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-white italic serif">Clinic Assignment Pending</h2>
          <p className="text-white/40 max-w-md mx-auto">
            Your account is active, but you haven't been assigned to a clinic yet. 
            Please contact your platform administrator to complete your setup.
          </p>
        </div>
      </div>
    );
  }

  if (counts.patients === 0 && counts.reports === 0 && !isAdmin) {
    return (
      <div className="space-y-10">
        <div className="p-12 glass-card rounded-[40px] border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.1)] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-16 opacity-5 rotate-12">
            <Sparkles className="w-64 h-64 text-emerald-400" />
          </div>
          
          <div className="max-w-2xl relative z-10">
            <h2 className="text-5xl font-bold text-white mb-6 font-display leading-tight italic serif">Get Started with <span className="text-emerald-500">HairOS</span></h2>
            <p className="text-xl text-zinc-400 mb-10 leading-relaxed font-medium">
              Welcome to your new clinical command center. Follow these steps to set up your practice and start generating AI hair health reports.
            </p>
            
            <div className="space-y-6">
              {[
                { step: 1, title: 'Assign Doctors', desc: 'Add medical professionals to your clinic directory.', icon: Stethoscope, link: '/users', cta: 'Add Doctor' },
                { step: 2, title: 'Register Patients', desc: 'Securely onboard your first patient to the platform.', icon: Users, link: '/patients', cta: 'Add Patient' },
                { step: 3, title: 'Generate AI Report', desc: 'Run your first scalp analysis and get AI insights.', icon: Sparkles, link: '/patients', cta: 'Run Diagnosis' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-6 group">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-500 font-bold shrink-0 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-all font-display">
                    {item.step}
                  </div>
                  <div className="flex-1 pb-6 border-b border-white/5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-bold text-white">{item.title}</h4>
                      <Link to={item.link} className="text-sm font-bold text-emerald-500 hover:underline px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                        {item.cta}
                      </Link>
                    </div>
                    <p className="text-zinc-500 mt-1 font-medium">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAdmin && profile) {
    return (
      <div className="space-y-6">
        <div className="flex justify-start">
          <div className="bg-white/5 p-1 rounded-2xl border border-white/10 inline-flex">
            <button 
              onClick={() => setView('admin')}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                view === 'admin' ? 'bg-emerald-600 text-zinc-950 shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              System Overview
            </button>
            <button 
              onClick={() => setView('doctor')}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                view === 'doctor' ? 'bg-emerald-600 text-zinc-950 shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Clinical View
            </button>
          </div>
        </div>
        
        {view === 'admin' ? (
          <AdminDashboard profile={profile} />
        ) : (
          <DoctorDashboard profile={profile} />
        )}
      </div>
    );
  }

  if (isDoctor && profile) {
    return <DoctorDashboard profile={profile} />;
  }

  const stats = [
    { 
      name: 'Total Patients', 
      value: counts.patients.toLocaleString(), 
      change: '+12%', 
      icon: Users, 
      color: 'text-blue-400' 
    },
    { 
      name: 'AI Reports', 
      value: counts.reports.toLocaleString(), 
      change: '+18%', 
      icon: FileText, 
      color: 'text-emerald-400' 
    },
    { 
      name: 'High Risk', 
      value: counts.highRisk.toString(), 
      change: '-4%', 
      icon: AlertCircle, 
      color: 'text-red-400' 
    },
    { 
      name: 'Active Doctors', 
      value: '12', 
      change: '+8%', 
      icon: Activity, 
      color: 'text-purple-400' 
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white font-display">{t('dashboard')}</h2>
          <p className="text-zinc-400 mt-1">{t('welcome')}, {profile?.displayName}. Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          {(isClinicAdmin || profile?.role === 'doctor') && (
            <Link to="/patients" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20">
              <Plus className="w-5 h-5" />
              New Patient
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <motion.div 
            key={stat.name}
            whileHover={{ y: -4 }}
            className="p-6 glass-card rounded-3xl space-y-4 shadow-[0_0_20px_rgba(0,0,0,0.1)]"
          >
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 shadow-sm ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                stat.change.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {stat.change}
              </span>
            </div>
            <div>
              <p className="text-sm text-zinc-500 font-medium">{stat.name}</p>
              <p className="text-3xl font-bold text-zinc-100 mt-1 font-display">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-8 glass-card rounded-[32px] shadow-[0_0_30px_rgba(0,0,0,0.15)]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-zinc-100 font-display">Recent AI Reports</h3>
              <Link to="/reports" className="text-emerald-500 text-sm font-semibold hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="space-y-4">
              {recentReports.length === 0 ? (
                <div className="text-center py-10 text-zinc-600 italic">No reports generated yet.</div>
              ) : (
                recentReports.map((report, i) => (
                  <Link to={`/reports/${report.id}`} key={report.id} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-bold group-hover:bg-emerald-600 group-hover:border-emerald-500 transition-all shadow-sm">
                        {report.patientName?.[0] || 'P'}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-200">{report.patientName}</p>
                        <p className="text-xs text-zinc-500">Diagnosis: {report.diagnosis}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold font-display ${
                        report.riskLevel === 'high' ? 'text-red-400' : report.riskLevel === 'medium' ? 'text-yellow-400' : 'text-emerald-400'
                      }`}>Score: {report.hairScore}</p>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1 font-mono">
                        {report.createdAt?.seconds ? new Date(report.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-8 glass-card rounded-[32px] shadow-[0_0_30px_rgba(0,0,0,0.15)]">
            <h3 className="text-xl font-bold text-zinc-100 mb-6 font-display">Priority Follow-ups</h3>
            <div className="space-y-6">
              {[
                { name: 'Sarah Jenkins', risk: 'high', msg: 'High risk detected in last report. Immediate review required.' },
                { name: 'Robert Wilson', risk: 'medium', msg: 'Patient reported increased shedding after 2 weeks of treatment.' },
                { name: 'Emma Thompson', risk: 'high', msg: 'Hair score dropped by 15 points in 3 months.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="relative">
                    <div className={`w-1 h-full absolute left-1/2 -translate-x-1/2 rounded-full ${
                      item.risk === 'high' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                    }`}></div>
                    <div className={`w-3 h-3 rounded-full relative z-10 border-4 border-[#0a0a0a] ${
                      item.risk === 'high' ? 'bg-red-500' : 'bg-yellow-500'
                    }`}></div>
                  </div>
                  <div className="pb-6">
                    <p className="text-sm font-semibold text-zinc-200">{item.name}</p>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{item.msg}</p>
                    <button className="mt-3 text-xs font-semibold text-emerald-500 hover:text-emerald-400 transition-colors">Review Case</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
