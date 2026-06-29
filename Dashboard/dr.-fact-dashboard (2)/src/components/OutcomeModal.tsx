import { useState } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../App';
import { createAuditLog } from '../lib/audit';

interface Props {
  patientId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OutcomeModal({ patientId, onClose, onSuccess }: Props) {
  const { profile } = useAuth();
  const [followUpDate, setFollowUpDate] = useState('');
  const [improvement, setImprovement] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (improvement === null || !followUpDate) return;

    setLoading(true);
    try {
      const outcomeData = {
        patientId,
        followUpDate,
        improvement,
        notes,
        doctorId: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'outcomes'), outcomeData);
      if (profile) {
        await createAuditLog(profile, 'Track Outcome', 'Outcome', docRef.id, `Recorded treatment outcome for patient ${patientId}`);
      }
      onSuccess();
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'outcomes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-[#0a0a0a] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-white italic serif">Track Outcome</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6 text-white/60" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-white/60">Follow-up Date</label>
            <input
              type="date"
              required
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-white/60">Did the patient show improvement?</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setImprovement(true)}
                className={`flex-1 py-3 rounded-2xl font-bold transition-all ${
                  improvement === true 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setImprovement(false)}
                className={`flex-1 py-3 rounded-2xl font-bold transition-all ${
                  improvement === false 
                    ? 'bg-red-500 text-white' 
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                No
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-white/60">Clinical Notes</label>
            <textarea
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-emerald-500 transition-colors h-32 resize-none"
              placeholder="Describe the patient's progress..."
            />
          </div>

          <button
            type="submit"
            disabled={loading || improvement === null || !followUpDate}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/40 text-white rounded-2xl font-bold transition-all"
          >
            {loading ? 'Saving...' : 'Save Outcome'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
