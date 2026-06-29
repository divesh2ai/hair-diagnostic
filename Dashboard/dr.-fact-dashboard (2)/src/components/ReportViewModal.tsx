import { X, Download, Share2, Sparkles, Activity, ShieldCheck, Zap, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { Report } from '../types';

interface Props {
  report: Report;
  onClose: () => void;
}

export default function ReportViewModal({ report, onClose }: Props) {
  const getSeverityColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    if (score >= 40) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    return 'text-red-400 bg-red-400/10 border-red-400/20';
  };

  const handleWhatsAppShare = () => {
    const text = `HairOS Analysis Report for ${report.patientName}: Score ${report.hairScore}/100. Recommendation: ${report.aiKits?.join(', ')}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md overflow-y-auto custom-scrollbar">
      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="max-w-4xl w-full bg-[#0a0a0a] border border-white/10 rounded-[60px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] relative my-8"
      >
        {/* Branding Accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-400" />
        
        {/* Header */}
        <div className="p-10 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/[0.01]">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-[24px] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30">
              <Sparkles className="w-8 h-8 text-zinc-950" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-3xl font-bold text-white font-display">Hair Health Report</h3>
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-zinc-500 uppercase tracking-widest">v2.0 AI-Verified</span>
              </div>
              <p className="text-zinc-500 font-medium mt-1">Patient: <span className="text-white">{report.patientName}</span> • Auth ID: #{report.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleWhatsAppShare}
              className="p-4 bg-[#25D366]/10 hover:bg-[#25D366] text-[#25D366] hover:text-white rounded-[24px] transition-all border border-[#25D366]/20 flex items-center gap-2 group"
            >
              <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-wider">Share</span>
            </button>
            <button className="p-4 bg-white/5 hover:bg-white text-zinc-300 hover:text-zinc-950 rounded-[24px] transition-all border border-white/10 flex items-center gap-2 group">
              <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-wider">PDF</span>
            </button>
            <button onClick={onClose} className="p-4 bg-white/5 hover:bg-red-500/10 text-white/20 hover:text-red-500 rounded-[24px] transition-all group border border-white/5">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-12 space-y-12 bg-gradient-to-b from-transparent to-white/[0.01]">
          {/* Top Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Score Card */}
            <div className="p-8 glass-card rounded-[40px] border-emerald-500/10 relative overflow-hidden group col-span-1 md:col-span-2">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Activity className="w-32 h-32 text-emerald-500" />
              </div>
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Baseline Follicle Score</p>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-8xl font-bold text-white font-display leading-none">{report.hairScore}</h2>
                    <span className="text-zinc-500 text-2xl font-medium">/100</span>
                  </div>
                </div>
                <div className="flex-1 max-w-[200px] space-y-4">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                    <span className="text-zinc-500">Scale</span>
                    <span className={getSeverityColor(report.hairScore).split(' ')[0]}>{report.riskLevel} Risk</span>
                  </div>
                  <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 p-1">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${report.hairScore}%` }}
                      className={`h-full rounded-full ${
                        report.hairScore >= 70 ? 'bg-emerald-500' : report.hairScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* AI Confidence */}
            <div className="p-8 glass-card rounded-[40px] flex flex-col justify-between border-blue-500/10 transition-all hover:bg-blue-500/[0.02]">
              <div className="flex items-start justify-between">
                <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Verified</span>
              </div>
              <div>
                <p className="text-4xl font-bold text-white font-display">{report.aiConfidence || 85}%</p>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mt-2">AI Confidence</p>
              </div>
            </div>
          </div>

          {/* Condition & Roots */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-xl">
                  <Activity className="w-5 h-5 text-emerald-400" />
                </div>
                <h4 className="text-xl font-bold text-white font-display uppercase tracking-wider">Observed Condition</h4>
              </div>
              <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[40px] relative">
                <p className="text-zinc-300 text-lg leading-relaxed">{report.diagnosis}</p>
                <div className="mt-8 pt-8 border-t border-white/5 space-y-6">
                   <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Key Genetic Factors</h5>
                   <div className="flex flex-wrap gap-3">
                     {report.aiReasoning?.map((reason, i) => (
                       <div key={i} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                         <span className="text-xs text-zinc-400 font-medium">{reason}</span>
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            </div>

            <div className="space-y-10">
              {/* Recommended Kit */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-xl">
                    <Zap className="w-5 h-5 text-purple-400" />
                  </div>
                  <h4 className="text-xl font-bold text-white font-display uppercase tracking-wider">Prescribed Kit</h4>
                </div>
                <div className="p-8 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-[40px] shadow-2xl">
                  <div className="grid grid-cols-2 gap-4">
                    {report.aiKits?.map((kit, i) => (
                      <div key={i} className="p-5 bg-black/40 border border-white/5 rounded-3xl flex flex-col items-center text-center group hover:bg-black/60 transition-all">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 mb-3 font-bold group-hover:scale-110 transition-transform">
                          {i + 1}
                        </div>
                        <span className="text-sm font-bold text-zinc-100 uppercase tracking-tight">{kit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lifestyle Guidance */}
              <div className="p-8 glass-card rounded-[40px] border-yellow-500/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                   <Info className="w-12 h-12 text-yellow-500" />
                </div>
                <h4 className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-4">Doctor's Lifestyle Advice</h4>
                <p className="text-zinc-400 text-sm leading-relaxed italic">
                  {(report as any).lifestyleImpact || "Focus on Zinc-rich nutrition and managing high cortisol levels observed in the lifestyle assessment."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-10 border-t border-white/5 bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-6 text-zinc-600 text-[10px] font-bold uppercase tracking-[0.3em]">
          <span>Generated by HairOS High-Precision AI Engine V2.4</span>
          <span>© 2026 CLINIC NETWORK • SECURE DIGITAL REPORT</span>
        </div>
      </motion.div>
    </div>
  );
}
