import { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  FileText, 
  TrendingUp, 
  Activity, 
  ArrowUpRight, 
  ArrowDownRight,
  Search,
  ChevronRight,
  Stethoscope,
  BarChart3,
  Globe,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Clinic, Patient, Report, Doctor, UserProfile } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

import { useLanguage } from '../lib/i18n';

interface Props {
  profile: UserProfile;
}

export default function AdminDashboard({ profile }: Props) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClinics: 0,
    activeDoctors: 0,
    patientsToday: 0,
    totalReports: 0
  });
  const [clinics, setClinics] = useState<any[]>([]);
  const [recentReports, setRecentReports] = useState<Report[]>([]);

  const trendData = [
    { name: 'Mon', reports: 12 },
    { name: 'Tue', reports: 19 },
    { name: 'Wed', reports: 15 },
    { name: 'Thu', reports: 22 },
    { name: 'Fri', reports: 28 },
    { name: 'Sat', reports: 14 },
    { name: 'Sun', reports: 18 },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Total Clinics
        const clinicsSnap = await getDocs(collection(db, 'clinics'));
        const totalClinics = clinicsSnap.size;

        // 2. Active Doctors
        const doctorsSnap = await getDocs(query(collection(db, 'doctors'), where('active', '==', true)));
        const activeDoctors = doctorsSnap.size;

        // 3. Patients Today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const patientsTodaySnap = await getDocs(query(
          collection(db, 'patients'), 
          where('createdAt', '>=', Timestamp.fromDate(today))
        ));
        const patientsToday = patientsTodaySnap.size;

        // 4. Total Reports
        const reportsSnap = await getDocs(collection(db, 'reports'));
        const totalReports = reportsSnap.size;

        setStats({
          totalClinics,
          activeDoctors,
          patientsToday,
          totalReports
        });

        // Clinic Performance Data (Simplified for now)
        const clinicsData = clinicsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Mocking some performance data for the table
          growth: Math.floor(Math.random() * 30) + 5,
          activePatients: Math.floor(Math.random() * 200) + 50,
          revenue: ((Math.random() * 10000 + 2000) * 80).toLocaleString('en-IN')
        }));
        setClinics(clinicsData);

        // Recent Reports
        const recentReportsQuery = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(5));
        const unsubscribeReports = onSnapshot(recentReportsQuery, (snapshot) => {
          setRecentReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report)));
        });

        setLoading(false);
        return () => unsubscribeReports();
      } catch (error) {
        console.error("Error fetching admin dashboard data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const metrics = [
    { name: t('totalClinics'), value: stats.totalClinics, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-400/10', trend: '+2' },
    { name: t('activeDoctors'), value: stats.activeDoctors, icon: Stethoscope, color: 'text-purple-400', bg: 'bg-purple-400/10', trend: '+5' },
    { name: t('patientsToday'), value: stats.patientsToday, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-400/10', trend: '+12%' },
    { name: t('aiReports'), value: stats.totalReports, icon: FileText, color: 'text-orange-400', bg: 'bg-orange-400/10', trend: '+18%' },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-white font-display">Platform FACT</h2>
          <p className="text-zinc-400 mt-2 text-lg">Global performance metrics and clinic insights.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button className="glass-card text-white px-8 py-4 rounded-3xl font-medium transition-all flex items-center gap-3 group">
            <Globe className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
            Network Map
          </button>
          <Link to="/clinics" className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-8 py-4 rounded-3xl font-bold transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.3)] group">
            <Activity className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            Manage Clinics
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <motion.div 
            key={metric.name}
            whileHover={{ y: -4, scale: 1.01 }}
            className="p-8 glass-card rounded-3xl space-y-6 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <metric.icon className="w-24 h-24" />
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div className={`p-4 rounded-2xl ${metric.bg} ${metric.color}`}>
                <metric.icon className="w-7 h-7" />
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                <ArrowUpRight className="w-3 h-3" />
                {metric.trend}
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-sm text-zinc-400 font-medium uppercase tracking-widest">{metric.name}</p>
              <p className="text-4xl font-bold text-white mt-2 tracking-tight font-display">{metric.value.toLocaleString()}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          {/* Trend Charts */}
          <div className="p-10 glass-card rounded-3xl shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400 border border-emerald-500/20">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white font-display">Platform Usage Trends</h3>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="name" stroke="#ffffff40" tick={{fill: '#ffffff40', fontSize: 12}} axisLine={false} tickLine={false} />
                  <YAxis stroke="#ffffff40" tick={{fill: '#ffffff40', fontSize: 12}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '16px' }}
                    itemStyle={{ color: '#10b981' }}
                  />
                  <Area type="monotone" dataKey="reports" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorReports)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Clinic Performance Table */}
          <div className="p-10 glass-card rounded-3xl shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400 border border-blue-500/20">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white font-display">Clinic Performance</h3>
            </div>
            <button className="text-emerald-400 text-sm font-medium hover:text-emerald-300 transition-colors tracking-tight">View Detailed Analytics</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-4">
              <thead>
                <tr className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-bold">
                  <th className="px-6 py-2 font-medium">Clinic Name</th>
                  <th className="px-6 py-2 font-medium">Patients</th>
                  <th className="px-6 py-2 font-medium">Growth</th>
                  <th className="px-6 py-2 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {clinics.map((clinic) => (
                  <tr key={clinic.id} className="group cursor-pointer">
                    <td className="px-6 py-5 rounded-l-2xl bg-white/[0.02] border-y border-l border-white/5 group-hover:bg-white/[0.04] transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center text-white font-bold shadow-lg">
                          {clinic.name[0]}
                        </div>
                        <span className="font-semibold text-zinc-100 text-lg">{clinic.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 bg-white/[0.02] border-y border-white/5 group-hover:bg-white/[0.04] transition-all text-zinc-400 font-medium">
                      {clinic.activePatients}
                    </td>
                    <td className="px-6 py-5 bg-white/[0.02] border-y border-white/5 group-hover:bg-white/[0.04] transition-all">
                      <div className="flex items-center gap-1 text-emerald-400 font-medium bg-emerald-500/10 w-fit px-2 py-1 rounded-lg border border-emerald-500/20">
                        <ArrowUpRight className="w-4 h-4" />
                        {clinic.growth}%
                      </div>
                    </td>
                    <td className="px-6 py-5 rounded-r-2xl bg-white/[0.02] border-y border-r border-white/5 group-hover:bg-white/[0.04] transition-all text-right text-zinc-100 font-bold text-lg font-mono">
                      ₹{clinic.revenue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>

        {/* AI Insights & Recent Reports */}
        <div className="space-y-10">
          <div className="p-10 bg-emerald-900/20 border border-emerald-500/20 rounded-3xl relative overflow-hidden group shadow-[0_0_30px_rgba(16,185,129,0.05)]">
            <div className="absolute -top-10 -right-10 p-10 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sparkles className="w-40 h-40 text-emerald-500" />
            </div>
            <div className="flex items-center gap-4 mb-8 relative z-10">
              <div className="p-4 bg-emerald-500 rounded-2xl text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                <TrendingUp className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-white font-display">AI Insights</h3>
            </div>
            <div className="space-y-4 relative z-10">
              <div className="p-6 bg-zinc-950/50 rounded-2xl border border-emerald-500/10 hover:border-emerald-500/30 transition-all">
                <p className="text-[10px] text-emerald-400/60 font-bold uppercase tracking-[0.2em]">Diagnosis Accuracy</p>
                <div className="flex items-end gap-3 mt-2">
                  <p className="text-4xl font-bold text-white tracking-tight font-display">94.8%</p>
                  <p className="text-sm text-emerald-400 mb-1.5 font-medium flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    <ArrowUpRight className="w-3 h-3" />
                    1.2%
                  </p>
                </div>
              </div>
              <div className="p-6 bg-zinc-950/50 rounded-2xl border border-emerald-500/10 hover:border-emerald-500/30 transition-all">
                <p className="text-[10px] text-emerald-400/60 font-bold uppercase tracking-[0.2em]">Avg. Hair Score</p>
                <div className="flex items-end gap-3 mt-2">
                  <p className="text-4xl font-bold text-white tracking-tight font-display">68.4</p>
                  <p className="text-sm text-red-400 mb-1.5 font-medium flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20">
                    <ArrowDownRight className="w-3 h-3" />
                    0.5
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 p-5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 relative z-10">
              <p className="text-sm text-emerald-100/80 leading-relaxed italic">
                "AI models are showing increased detection sensitivity for early-stage thinning in the crown area."
              </p>
            </div>
          </div>

          <div className="p-8 glass-card rounded-3xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-white font-display">Latest Reports</h3>
              <Link to="/reports" className="p-2 bg-white/5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-all">
                <ArrowUpRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="space-y-3">
              {recentReports.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-300 text-sm font-bold group-hover:scale-110 transition-transform">
                      {report.patientName?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{report.patientName}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-0.5">{report.riskLevel} Risk</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold font-display ${
                      report.riskLevel === 'high' ? 'text-red-400' : report.riskLevel === 'medium' ? 'text-yellow-400' : 'text-emerald-400'
                    }`}>{report.hairScore}</p>
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
