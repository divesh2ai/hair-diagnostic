import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Report } from '../types';
import { useAuth, useFilters } from '../App';
import { 
  FileText, 
  Search, 
  Filter, 
  ChevronRight,
  Activity,
  AlertCircle,
  CheckCircle2,
  Eye
} from 'lucide-react';
import { motion } from 'motion/react';
import ReportViewModal from '../components/ReportViewModal';

export default function Reports() {
  const { profile } = useAuth();
  const { clinicId: filterClinicId, doctorId: filterDoctorId } = useFilters();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    if (!profile) return;

    const reportsRef = collection(db, 'reports');
    
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    
    // Multi-tenant isolation + global filters
    if (profile.role === 'admin') {
      if (filterClinicId) constraints.push(where('clinicId', '==', filterClinicId));
      if (filterDoctorId) constraints.push(where('doctorId', '==', filterDoctorId));
    } else if (profile.role === 'clinic_admin') {
      constraints.push(where('clinicId', '==', profile.clinicId));
      if (filterDoctorId) constraints.push(where('doctorId', '==', filterDoctorId));
    } else { // Doctor
      constraints.push(where('clinicId', '==', profile.clinicId));
      constraints.push(where('doctorId', '==', profile.uid)); 
    }
    
    const q = query(reportsRef, ...constraints);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, filterClinicId, filterDoctorId]);

  const filteredReports = reports.filter(r => 
    r.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.diagnosis?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-white font-display">AI Analysis Reports</h2>
          <p className="text-zinc-400 mt-2 text-lg">Review and manage AI-generated hair health diagnoses across your network.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports by ID or patient..." 
              className="bg-white/[0.02] border border-white/10 rounded-[20px] py-3.5 pl-12 pr-6 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.04] transition-all text-sm w-72 text-white placeholder:text-zinc-600"
            />
          </div>
          <button className="bg-white/5 border border-white/10 text-white px-8 py-3.5 rounded-[20px] font-semibold transition-all flex items-center gap-3 hover:bg-white/10 shadow-sm">
            <Filter className="w-5 h-5" />
            Filter Results
          </button>
        </div>
      </div>

      {selectedReport && (
        <ReportViewModal 
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
            <Activity className="w-6 h-6 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredReports.length === 0 ? (
            <div className="text-center py-32 glass-card rounded-[48px] shadow-[0_0_40px_rgba(0,0,0,0.2)]">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10">
                <FileText className="w-10 h-10 text-zinc-600" />
              </div>
              <p className="text-zinc-500 italic text-xl">No reports found in your database.</p>
              <p className="text-zinc-600 mt-2">Start by running an AI diagnosis for a patient.</p>
            </div>
          ) : (
            filteredReports.map((report, index) => (
              <motion.div 
                key={report.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedReport(report)}
                className="p-8 glass-card rounded-[32px] hover:border-emerald-500/30 transition-all cursor-pointer group relative overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.1)]"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/0 group-hover:bg-emerald-500 transition-all"></div>
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                  <div className="flex items-center gap-8">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 ${
                      report.riskLevel === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                      report.riskLevel === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="flex items-center gap-4">
                        <h4 className="text-2xl font-semibold text-zinc-100 font-display">Analysis #{report.id.slice(0, 8).toUpperCase()}</h4>
                        <span className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] border ${
                          report.riskLevel === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                          : report.riskLevel === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {report.riskLevel} Risk
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-zinc-400 font-medium">Patient: <span className="text-zinc-200">{report.patientName}</span></p>
                        <span className="w-1 h-1 rounded-full bg-white/20"></span>
                        <p className="text-zinc-500 text-sm font-mono">Clinic ID: {report.clinicId}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between lg:justify-end gap-12 lg:gap-20">
                    <div className="text-center">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold">Hair Score</p>
                      <p className={`text-4xl font-bold mt-2 font-display ${
                        (report.hairScore || 0) > 70 ? 'text-emerald-500' : (report.hairScore || 0) > 40 ? 'text-yellow-500' : 'text-red-500'
                      }`}>{report.hairScore}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg text-zinc-300 font-medium">
                        {report.createdAt?.seconds ? new Date(report.createdAt.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                      </p>
                      <p className="text-sm text-zinc-500 mt-1 font-medium font-mono">
                        {report.createdAt?.seconds ? new Date(report.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-emerald-500 group-hover:border-emerald-500 transition-all shadow-sm">
                      <ChevronRight className="w-6 h-6 text-zinc-400 group-hover:text-white group-hover:scale-110 transition-all" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
