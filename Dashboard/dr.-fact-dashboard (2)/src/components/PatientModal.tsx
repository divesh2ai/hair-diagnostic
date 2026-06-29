import { useState, useEffect } from 'react';
import { X, User, Loader2, Save, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc, query, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Patient, RiskLevel, Clinic } from '../types';
import { useAuth } from '../App';
import { createAuditLog } from '../lib/audit';

interface Props {
  patient: Patient | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PatientModal({ patient, onClose, onSuccess }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    clinicId: profile?.clinicId || '',
    riskLevel: 'low' as RiskLevel
  });

  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name || '',
        email: patient.email || '',
        phone: patient.phone || '',
        clinicId: patient.clinicId || '',
        riskLevel: patient.riskLevel || 'low'
      });
    } else if (profile?.clinicId) {
      setFormData(prev => ({ ...prev, clinicId: profile.clinicId! }));
    }
  }, [patient, profile]);

  useEffect(() => {
    if (profile?.role === 'admin') {
      const fetchClinics = async () => {
        const q = query(collection(db, 'clinics'));
        const snap = await getDocs(q);
        setClinics(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Clinic)));
      };
      fetchClinics();
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...formData,
        createdAt: patient?.createdAt || serverTimestamp()
      };

      if (patient) {
        await setDoc(doc(db, 'patients', patient.id), data, { merge: true });
        if (profile) {
          await createAuditLog(profile, 'Update Patient', 'Patient', patient.id, `Updated patient profile for ${formData.name}`);
        }
      } else {
        const docRef = await addDoc(collection(db, 'patients'), data);
        if (profile) {
          await createAuditLog(profile, 'Create Patient', 'Patient', docRef.id, `Registered new patient: ${formData.name}`);
        }
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      handleFirestoreError(error, patient ? OperationType.UPDATE : OperationType.CREATE, patient ? `patients/${patient.id}` : 'patients');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!patient) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'patients', patient.id));
      if (profile) {
        await createAuditLog(profile, 'Delete Patient', 'Patient', patient.id, `Deleted patient record for ${patient.name}`);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      handleFirestoreError(error, OperationType.DELETE, `patients/${patient.id}`);
    } finally {
      setLoading(false);
      setShowConfirmDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full bg-[#0a0a0a] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl">
              <User className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">{patient ? 'Edit Patient' : 'Add New Patient'}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Full Name</label>
            <input 
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="John Doe"
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Email</label>
              <input 
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="john@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Phone</label>
              <input 
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="+1 (555) 000-0000"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          {profile?.role === 'admin' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Clinic</label>
              <select 
                required
                value={formData.clinicId}
                onChange={(e) => setFormData({...formData, clinicId: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">Select Clinic...</option>
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Risk Level</label>
            <div className="flex gap-4">
              {(['low', 'medium', 'high'] as RiskLevel[]).map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormData({...formData, riskLevel: level})}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                    formData.riskLevel === level 
                      ? level === 'low' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' 
                        : level === 'medium' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500'
                        : 'bg-red-500/10 border-red-500 text-red-500'
                      : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            {patient && (
              <button 
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                disabled={loading}
                className="flex-1 py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Delete
              </button>
            )}
            <button 
              type="submit"
              disabled={loading}
              className="flex-2 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {patient ? 'Update Patient' : 'Register Patient'}
            </button>
          </div>
        </form>

        <AnimatePresence>
          {showConfirmDelete && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-[#0a0a0a]/95 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center space-y-6 max-w-xs"
              >
                <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-500">
                  <Trash2 className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-white">Are you sure?</h4>
                  <p className="text-sm text-white/40 leading-relaxed">This will permanently delete the patient record. This action cannot be undone.</p>
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleDelete}
                    disabled={loading}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Yes, Delete Patient'}
                  </button>
                  <button 
                    onClick={() => setShowConfirmDelete(false)}
                    disabled={loading}
                    className="w-full py-4 text-white/40 hover:text-white font-bold transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
