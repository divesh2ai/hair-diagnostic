import { useState } from 'react';
import { X, Sparkles, Loader2, CheckCircle2, AlertCircle, Activity, Stethoscope, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addDoc, collection, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { RiskLevel } from '../types';
import { useAuth } from '../App';
import { createAuditLog } from '../lib/audit';

interface Props {
  patientId: string;
  patientName: string;
  clinicId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AIDiagnosisModal({ patientId, patientName, clinicId, onClose, onSuccess }: Props) {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState({
    hairLossDuration: '',
    pattern: '',
    familyHistory: '',
    scalpFlaking: '',
    scalpRedness: '',
    scalpItching: '',
    stressLevel: '',
    dietType: '',
    medicalConditions: '',
    medications: ''
  });

  const STEPS = [
    { title: 'Hair Portfolio', icon: Sparkles },
    { title: 'Scalp Analysis', icon: Activity },
    { title: 'Lifestyle & Meds', icon: Stethoscope },
    { title: 'AI Processing', icon: Zap }
  ];

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // 1. Call AI API
      const response = await fetch('/api/ai-diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          patientId,
          patientName,
          questionnaireAnswers: answers 
        })
      });

      if (!response.ok) throw new Error('Failed to get AI diagnosis');
      const result = await response.json();

      // 2. Save Report to Firestore
      const reportData = {
        patientId,
        patientName,
        clinicId,
        doctorId: auth.currentUser?.uid,
        hairScore: result.hairScore,
        diagnosis: result.diagnosis,
        riskLevel: result.risk as RiskLevel,
        recommendedProducts: result.recommendedProducts,
        questionnaireAnswers: answers,
        aiConfidence: result.aiConfidence || 85,
        aiReasoning: result.aiReasoning || [],
        aiKits: result.aiKits || [],
        scalpSummary: result.scalpSummary || `${answers.scalpFlaking} flaking, ${answers.scalpRedness} redness observed.`,
        lifestyleImpact: result.lifestyleImpact || 'High stress and irregular sleep potentially impacting follicle health.',
        createdAt: serverTimestamp()
      };

      const reportsPath = 'reports';
      try {
        const docRef = await addDoc(collection(db, reportsPath), reportData);
        if (profile) {
          await createAuditLog(profile, 'Generate AI Diagnosis', 'Report', docRef.id, `Generated premium AI hair analysis for ${patientName}`);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, reportsPath);
      }

      // 3. Update Patient's last diagnosis
      const patientPath = `patients/${patientId}`;
      try {
        await updateDoc(doc(db, 'patients', patientId), {
          hairScore: result.hairScore,
          lastDiagnosis: result.diagnosis.slice(0, 100) + '...',
          riskLevel: result.risk,
          lastVisit: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, patientPath);
      }

      setStep(5); // Success step
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (error) {
      console.error(error);
      setStep(6); // Error step
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-2xl w-full bg-[#0a0a0a] border border-white/10 rounded-[48px] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-6 h-6 text-zinc-950" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white font-display">New AI Assessment</h3>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">Patient: {patientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Stepper */}
        {step <= 4 && (
          <div className="px-10 py-6 bg-white/[0.02] border-b border-white/10 flex items-center justify-between gap-4">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-3 flex-1 last:flex-none">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border ${
                  step > i + 1 ? 'bg-emerald-500 border-emerald-500 text-zinc-950' : 
                  step === i + 1 ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' : 
                  'border-white/10 text-zinc-600 bg-white/5'
                }`}>
                  {step > i + 1 ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest hidden sm:block ${
                  step === i + 1 ? 'text-emerald-500' : 'text-zinc-600'
                }`}>{s.title}</span>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-white/5" />}
              </div>
            ))}
          </div>
        )}

        <div className="p-10 overflow-y-auto custom-scrollbar">
          {step === 1 && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Hair Loss Duration</label>
                  <select 
                    value={answers.hairLossDuration}
                    onChange={(e) => setAnswers({...answers, hairLossDuration: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
                  >
                    <option value="" className="bg-[#0a0a0a]">Select duration...</option>
                    <option value="recent" className="bg-[#0a0a0a]">Less than 6 months</option>
                    <option value="intermediate" className="bg-[#0a0a0a]">6 - 12 months</option>
                    <option value="chronic" className="bg-[#0a0a0a]">1 - 2 years</option>
                    <option value="longterm" className="bg-[#0a0a0a]">More than 2 years</option>
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Family History</label>
                  <select 
                    value={answers.familyHistory}
                    onChange={(e) => setAnswers({...answers, familyHistory: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
                  >
                    <option value="" className="bg-[#0a0a0a]">Presence of loss in family...</option>
                    <option value="maternal" className="bg-[#0a0a0a]">Maternal side</option>
                    <option value="paternal" className="bg-[#0a0a0a]">Paternal side</option>
                    <option value="both" className="bg-[#0a0a0a]">Both sides</option>
                    <option value="none" className="bg-[#0a0a0a]">No known history</option>
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Loss Pattern Description</label>
                <textarea 
                  value={answers.pattern}
                  onChange={(e) => setAnswers({...answers, pattern: e.target.value})}
                  placeholder="Describe thinning areas, density changes, or specific pattern (e.g. Norwood III vertex)..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all min-h-[120px] resize-none font-medium text-sm leading-relaxed"
                />
              </div>
              <button 
                onClick={() => setStep(2)}
                disabled={!answers.hairLossDuration || !answers.pattern}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-zinc-950 py-5 rounded-2xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                Continue Assessment
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8">
              <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-3xl mb-4">
                <p className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-2">Instructions</p>
                <p className="text-zinc-400 text-sm italic">Analyze the patient's scalp health. This determines the type of topicals required.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Scalp Flaking</label>
                  <select 
                    value={answers.scalpFlaking}
                    onChange={(e) => setAnswers({...answers, scalpFlaking: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="" className="bg-[#0a0a0a]">Select flaking intensity...</option>
                    <option value="none" className="bg-[#0a0a0a]">None</option>
                    <option value="mild" className="bg-[#0a0a0a]">Mild / Occasional</option>
                    <option value="moderate" className="bg-[#0a0a0a]">Moderate / Dandruff</option>
                    <option value="severe" className="bg-[#0a0a0a]">Severe / Psoriatic</option>
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Scalp Inflammation</label>
                  <select 
                    value={answers.scalpRedness}
                    onChange={(e) => setAnswers({...answers, scalpRedness: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="" className="bg-[#0a0a0a]">Select redness/swelling...</option>
                    <option value="absent" className="bg-[#0a0a0a]">Completely Absent</option>
                    <option value="patchy" className="bg-[#0a0a0a]">Patchy Redness</option>
                    <option value="diffuse" className="bg-[#0a0a0a]">Diffuse Inflammation</option>
                    <option value="sensitive" className="bg-[#0a0a0a]">High Sensitivity/Pain</option>
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Additional Scalp Notes</label>
                <textarea 
                  value={answers.scalpItching}
                  onChange={(e) => setAnswers({...answers, scalpItching: e.target.value})}
                  placeholder="Itching levels, oily vs dry scalp, presence of pustules..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[100px] resize-none font-medium text-sm"
                />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setStep(1)} className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all">Back</button>
                <button onClick={() => setStep(3)} className="flex-2 py-5 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 rounded-2xl font-bold transition-all">Next: Lifestyle</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Stress Intensity</label>
                  <select 
                    value={answers.stressLevel}
                    onChange={(e) => setAnswers({...answers, stressLevel: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="" className="bg-[#0a0a0a]">Select level...</option>
                    <option value="low" className="bg-[#0a0a0a]">Low / Managed</option>
                    <option value="moderate" className="bg-[#0a0a0a]">Moderate / High Workload</option>
                    <option value="extreme" className="bg-[#0a0a0a]">Extreme / Burnout</option>
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Dietary Habits</label>
                  <select 
                    value={answers.dietType}
                    onChange={(e) => setAnswers({...answers, dietType: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="" className="bg-[#0a0a0a]">Select diet...</option>
                    <option value="balanced" className="bg-[#0a0a0a]">Balanced / Protein Rich</option>
                    <option value="deficient" className="bg-[#0a0a0a]">Likely Nutritional Gaps</option>
                    <option value="vegetarian" className="bg-[#0a0a0a]">Vegetarian / Vegan</option>
                    <option value="keto" className="bg-[#0a0a0a]">Keto / Restricted</option>
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Existing Medical Conditions & Meds</label>
                <textarea 
                  value={answers.medications}
                  onChange={(e) => setAnswers({...answers, medications: e.target.value})}
                  placeholder="Thyroid issues, PCOS, current blood thinners, etc..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[100px] resize-none font-medium text-sm"
                />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setStep(2)} className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all">Back</button>
                <button onClick={() => setStep(4)} className="flex-2 py-5 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 rounded-2xl font-bold transition-all">Review & Analyze</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-10 text-center py-6">
              <div className="p-10 bg-white/[0.01] rounded-[40px] border border-white/5 space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Sparkles className="w-48 h-48 text-emerald-500" />
                </div>
                <div className="flex justify-center">
                  <div className="p-6 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                    <Zap className="w-16 h-16 text-emerald-500 animate-pulse" />
                  </div>
                </div>
                <div>
                  <h4 className="text-3xl font-bold text-white font-display">Neural Compute Ready</h4>
                  <p className="text-zinc-500 mt-3 text-lg">HairOS AI will cross-reference 10k+ patterns to diagnose hair health and recommend kits.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setStep(3)} className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all">Adjust Inputs</button>
                <button 
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-[2] py-5 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 rounded-2xl font-bold transition-all flex items-center justify-center gap-4 text-lg shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                  {loading ? 'Synthesizing...' : 'Finalize Analysis'}
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="text-center space-y-8 py-20">
              <div className="flex justify-center">
                <div className="p-8 bg-emerald-500 rounded-full shadow-[0_0_50px_rgba(16,185,129,0.4)]">
                   <CheckCircle2 className="w-20 h-20 text-zinc-950" />
                </div>
              </div>
              <div>
                <h4 className="text-4xl font-bold text-white font-display">Analysis Deep-Linked</h4>
                <p className="text-zinc-500 text-lg mt-3">The Hair Health Report is now accessible via the patient dashboard.</p>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="text-center space-y-8 py-20">
              <div className="flex justify-center">
                <div className="p-8 bg-red-500 rounded-full shadow-[0_0_50px_rgba(239,68,68,0.4)]">
                  <AlertCircle className="w-20 h-20 text-white" />
                </div>
              </div>
              <div>
                <h4 className="text-3xl font-bold text-white font-display">System Interruption</h4>
                <p className="text-zinc-500 text-lg mt-3">We encountered an error during neural synthesis. Please audit your inputs and retry.</p>
              </div>
              <button onClick={() => setStep(4)} className="bg-white/5 hover:bg-white/10 text-white px-10 py-4 rounded-2xl font-bold transition-all border border-white/10">
                Retry Analysis
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
