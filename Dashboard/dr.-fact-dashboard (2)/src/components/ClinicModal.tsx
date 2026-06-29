import { useState, useEffect } from 'react';
import { X, Building2, Loader2, Save, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Clinic } from '../types';
import { useAuth } from '../App';
import { createAuditLog } from '../lib/audit';

interface Props {
  clinic: Clinic | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ClinicModal({ clinic, onClose, onSuccess }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    state: '',
    city: '',
    area: '',
    phone: ''
  });

  useEffect(() => {
    if (clinic) {
      setFormData({
        name: clinic.name || '',
        address: clinic.address || '',
        state: clinic.state || '',
        city: clinic.city || '',
        area: clinic.area || '',
        phone: clinic.phone || ''
      });
    }
  }, [clinic]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (clinic) {
        // Update
        const clinicRef = doc(db, 'clinics', clinic.id);
        await setDoc(clinicRef, {
          ...formData,
          createdAt: clinic.createdAt || serverTimestamp()
        }, { merge: true });
        if (profile) {
          await createAuditLog(profile, 'Update Clinic', 'Clinic', clinic.id, `Updated clinic details for ${formData.name}`);
        }
      } else {
        // Create
        const clinicsRef = collection(db, 'clinics');
        const docRef = await addDoc(clinicsRef, {
          ...formData,
          createdAt: serverTimestamp()
        });
        if (profile) {
          await createAuditLog(profile, 'Create Clinic', 'Clinic', docRef.id, `Created new clinic: ${formData.name}`);
        }
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      handleFirestoreError(error, clinic ? OperationType.UPDATE : OperationType.CREATE, clinic ? `clinics/${clinic.id}` : 'clinics');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!clinic) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'clinics', clinic.id));
      if (profile) {
        await createAuditLog(profile, 'Delete Clinic', 'Clinic', clinic.id, `Deleted clinic: ${clinic.name}`);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      handleFirestoreError(error, OperationType.DELETE, `clinics/${clinic.id}`);
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
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">{clinic ? 'Edit Clinic' : 'Add New Clinic'}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Clinic Name</label>
            <input 
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g., Beverly Hills Hair Restoration"
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium placeholder:text-zinc-700"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">State</label>
              <input 
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({...formData, state: e.target.value})}
                placeholder="Maharashtra"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium placeholder:text-zinc-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">City</label>
              <input 
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                placeholder="Mumbai"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium placeholder:text-zinc-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Area</label>
              <input 
                type="text"
                value={formData.area}
                onChange={(e) => setFormData({...formData, area: e.target.value})}
                placeholder="Andheri West"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium placeholder:text-zinc-700"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Full Address</label>
            <input 
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              placeholder="123 Medical Dr..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium placeholder:text-zinc-700"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Phone Number</label>
            <input 
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="+91 99999 99999"
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium placeholder:text-zinc-700"
            />
          </div>

          <div className="flex gap-4 pt-4">
            {clinic && (
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
              {clinic ? 'Update Clinic' : 'Create Clinic'}
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
                  <p className="text-sm text-white/40 leading-relaxed">This will permanently delete the clinic and all associated data. This action cannot be undone.</p>
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleDelete}
                    disabled={loading}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Yes, Delete Clinic'}
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
