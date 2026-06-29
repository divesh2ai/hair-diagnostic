import { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  Library, 
  FileText, 
  ChevronRight, 
  Sparkles,
  Zap,
  ShieldCheck,
  Globe,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { motion } from 'motion/react';

export default function KnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = ['All', 'Protocols', 'Clinical Studies', 'Patient Guides', 'Scalp Health', 'Treatments'];

  const resources = [
    { 
      title: 'Androgenetic Alopecia Management Protocols 2024', 
      category: 'Protocols', 
      duration: '8 min read', 
      icon: BookOpen, 
      color: 'blue',
      desc: 'Standardized clinical approach for early to mid-stage hair loss detection and treatment escalation.'
    },
    { 
      title: 'Minoxidil vs Finasteride: Comprehensive 2024 Comparative Study', 
      category: 'Clinical Studies', 
      duration: '15 min read', 
      icon: FileText, 
      color: 'purple',
      desc: 'Analysis of efficacy and side-effect profiles across 5,000 global clinical cases.'
    },
    { 
      title: 'Scalp Microneedling & PRP: Combined Therapy Guidelines', 
      category: 'Protocols', 
      duration: '10 min read', 
      icon: Zap, 
      color: 'emerald',
      desc: 'Best practices for implementing regenerative treatments in a clinical setting.'
    },
    { 
      title: 'Post-Assessment Patient Education Kit', 
      category: 'Patient Guides', 
      duration: '5 min read', 
      icon: Library, 
      color: 'orange',
      desc: 'Educational materials to help patients understand their AI Analysis Score and Risk Level.'
    },
    { 
      title: 'Follicular Miniaturization: AI Detection Patterns', 
      category: 'Scalp Health', 
      duration: '12 min read', 
      icon: Sparkles, 
      color: 'blue',
      desc: 'Deep dive into how our AI identifies early signs of thinning through trichoscopy imagery.'
    },
    { 
      title: 'Ethics and Data Privacy in AI Hair Diagnostics', 
      category: 'Clinical Studies', 
      duration: '7 min read', 
      icon: ShieldCheck, 
      color: 'zinc',
      desc: 'Compliance and data security protocols for managing patient biometric data.'
    }
  ];

  const filteredResources = resources.filter(res => 
    (activeCategory === 'All' || res.category === activeCategory) &&
    res.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-10">
      {/* Header Section */}
      <div className="p-10 glass-card rounded-[48px] bg-gradient-to-br from-blue-500/10 via-transparent to-emerald-500/10 border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-16 opacity-5 rotate-12 group-hover:rotate-45 transition-transform duration-1000">
          <BookOpen className="w-64 h-64 text-white" />
        </div>
        
        <div className="max-w-3xl relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.3em]">Clinical Intelligence</span>
          </div>
          <h2 className="text-5xl font-bold text-white mb-6 font-display leading-tight italic serif">Clinical <span className="text-blue-400">Knowledge</span> Base</h2>
          <p className="text-xl text-zinc-400 leading-relaxed font-medium">
            Access the world's most advanced repository of hair health research, clinical protocols, and AI-driven diagnostic insights.
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap border ${
                activeCategory === cat 
                  ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' 
                  : 'bg-white/5 text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search protocols..." 
            className="bg-white/[0.02] border border-white/10 rounded-[20px] py-3 pl-12 pr-6 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.04] transition-all text-sm w-72 text-white placeholder:text-zinc-600"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredResources.map((res, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-8 glass-card rounded-[32px] border border-white/5 hover:border-blue-500/30 hover:bg-white/[0.03] transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className={`p-4 rounded-2xl bg-white/5 text-blue-400 group-hover:scale-110 transition-transform`}>
                  <res.icon className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  <Clock className="w-3 h-3" />
                  {res.duration}
                </div>
              </div>
              <h3 className="text-xl font-bold text-zinc-100 mb-4 leading-tight group-hover:text-blue-400 transition-colors font-display">{res.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed line-clamp-3 mb-6">
                {res.desc}
              </p>
            </div>
            
            <div className="pt-6 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">{res.category}</span>
              <div className="p-2 bg-white/5 rounded-lg text-zinc-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Featured Research Banner */}
      <div className="p-1 glass-card rounded-[48px] bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-emerald-600/20 mt-12">
        <div className="p-12 glass-card rounded-[44px] bg-zinc-950/40 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="space-y-6 max-w-xl relative z-10 text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <Globe className="w-5 h-5 text-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-[0.3em]">Global Clinical Network</span>
            </div>
            <h3 className="text-3xl font-bold text-white font-display">Contribute to the Global Knowledge Base</h3>
            <p className="text-zinc-400 leading-relaxed">
              Have you observed a unique clinical pattern? Share your insights with the global HairOS community and help improve AI diagnostic precision.
            </p>
            <button className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 rounded-[20px] font-bold uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              Submit Clinical Case
            </button>
          </div>
          <div className="w-full md:w-auto flex-1 h-64 bg-white/5 rounded-[32px] border border-white/5 flex items-center justify-center p-10 relative group">
             <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
             <div className="text-center text-zinc-600 group-hover:text-zinc-400 transition-colors">
               <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                 <Globe className="w-8 h-8" />
               </div>
               <p className="text-xs font-bold uppercase tracking-widest">Connect Research Portal</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
