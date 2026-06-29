import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Patient } from '../types';
import { useAuth, useFilters } from '../App';
import { 
  Search, 
  Plus, 
  ChevronRight,
  User,
  Activity,
  Edit2
} from 'lucide-react';
import { motion } from 'motion/react';
import PatientModal from '../components/PatientModal';

export default function Patients() {
  const { profile } = useAuth();
  const { clinicId: filterClinicId, doctorId: filterDoctorId } = useFilters();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!profile) return;

    const patientsRef = collection(db, 'patients');
    
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
    
    const q = query(patientsRef, ...constraints);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, filterClinicId, filterDoctorId]);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-white font-display">Patient Directory</h2>
          <p className="text-zinc-400 mt-2 text-lg">Manage and track your clinic's patient records with precision.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or phone..." 
              className="bg-white/[0.02] border border-white/10 rounded-[20px] py-3.5 pl-12 pr-6 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.04] transition-all text-sm w-72 text-white placeholder:text-zinc-600"
            />
          </div>
          <button 
            onClick={() => {
              setEditingPatient(null);
              setShowModal(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 px-10 py-4 rounded-[24px] font-bold uppercase tracking-widest transition-all flex items-center gap-3 shadow-[0_0_40px_rgba(16,185,129,0.2)] group"
          >
            <div className="w-6 h-6 bg-zinc-950/20 rounded-lg flex items-center justify-center group-hover:bg-zinc-950/40 transition-colors">
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            </div>
            Add New Patient
          </button>
        </div>
      </div>

      {showModal && (
        <PatientModal 
          patient={editingPatient}
          onClose={() => setShowModal(false)}
          onSuccess={() => {}}
        />
      )}

      <div className="glass-card rounded-[48px] overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                <th className="px-10 py-6 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Patient</th>
                <th className="px-10 py-6 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Demographics</th>
                <th className="px-10 py-6 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Condition</th>
                <th className="px-10 py-6 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Score</th>
                <th className="px-10 py-6 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Last Visit</th>
                <th className="px-10 py-6 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] text-right">Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={6} className="px-10 py-32 text-center"><Activity className="w-10 h-10 animate-spin text-emerald-500 mx-auto" /></td></tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-10 py-32 text-center">
                    <div className="max-w-xs mx-auto space-y-6">
                      <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-[32px] flex items-center justify-center mx-auto text-zinc-600">
                        <User className="w-10 h-10" />
                      </div>
                      <div>
                        <p className="text-zinc-400 font-bold uppercase tracking-widest text-sm">Empty Directory</p>
                        <p className="text-zinc-600 text-sm mt-1">Start by registering your first clinic visitor below.</p>
                      </div>
                      <button 
                        onClick={() => {
                          setEditingPatient(null);
                          setShowModal(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 px-8 py-4 rounded-[20px] font-bold uppercase tracking-widest text-xs transition-all shadow-lg shadow-emerald-500/20"
                      >
                        Add New Patient
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-white/[0.02] transition-colors group cursor-pointer">
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 font-bold text-xl group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-500 transition-all shadow-sm">
                          {patient.name[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-100 text-lg">{patient.name}</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1 font-mono">#{patient.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex flex-col gap-1">
                        <span className="text-zinc-300 font-medium">{patient.age || 'N/A'} yrs • <span className="capitalize">{patient.gender || 'Unknown'}</span></span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{patient.phone}</span>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="max-w-[200px]">
                        <p className="text-sm text-zinc-400 line-clamp-1 italic">"{patient.lastDiagnosis || 'No assessment yet'}"</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            patient.riskLevel === 'high' ? 'bg-red-500' : patient.riskLevel === 'medium' ? 'bg-yellow-500' : 'bg-emerald-500'
                          }`} />
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{patient.riskLevel || 'Low'} Risk</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-bold text-white font-display">{patient.hairScore || 0}</div>
                        <div className="w-1.5 h-8 bg-white/5 rounded-full overflow-hidden flex flex-col justify-end">
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${patient.hairScore || 0}%` }}
                            className={`w-full ${
                              (patient.hairScore || 0) > 70 ? 'bg-emerald-500' : (patient.hairScore || 0) > 40 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <p className="text-sm text-zinc-400 font-medium">
                        {patient.lastVisit?.seconds ? new Date(patient.lastVisit.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Never'}
                      </p>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingPatient(patient);
                            setShowModal(true);
                          }}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-xs font-bold text-zinc-400 hover:text-white border border-white/5"
                        >
                          EDIT
                        </button>
                        <Link 
                          to={`/patients/${patient.id}`} 
                          className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-zinc-950 rounded-xl transition-all text-xs font-bold uppercase tracking-widest border border-emerald-500/20 hover:border-emerald-500 shadow-lg shadow-emerald-500/0 hover:shadow-emerald-500/20"
                        >
                          New Assessment
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
