import { useState, useEffect } from 'react';
import { 
  User, 
  MessageSquare, 
  Clock, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Search,
  Phone,
  Mail,
  MoreVertical,
  Zap,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';

interface SupportRequest {
  id: string;
  patientName: string;
  patientId: string;
  status: 'pending' | 'active' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  lastMessage: string;
  timeAgo: string;
  reason: string;
}

export default function HumanHandoff() {
  const { profile } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'resolved'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  const [ticketList, setTicketList] = useState<SupportRequest[]>([
    {
      id: '1',
      patientName: 'Alex Rivera',
      patientId: 'PAT-001',
      status: 'pending',
      priority: 'high',
      lastMessage: "The AI didn't recognize my scalp redness symptoms correctly.",
      timeAgo: '4m ago',
      reason: 'AI Misinterpretation'
    },
    {
      id: '2',
      patientName: 'Sarah Jenkins',
      patientId: 'PAT-092',
      status: 'active',
      priority: 'medium',
      lastMessage: "Thank you, Dr. Smith is now looking into your file.",
      timeAgo: '12m ago',
      reason: 'Treatment Clarification'
    },
    {
      id: '3',
      patientName: 'Michael Chen',
      patientId: 'PAT-118',
      status: 'pending',
      priority: 'low',
      lastMessage: "Can I reschedule my clinical photos appointment?",
      timeAgo: '45m ago',
      reason: 'Administrative'
    },
    {
      id: '4',
      patientName: 'Elena Rostova',
      patientId: 'PAT-142',
      status: 'resolved',
      priority: 'low',
      lastMessage: "Verified new photo submissions. Prescribed serum modified.",
      timeAgo: '2h ago',
      reason: 'Image Resubmission'
    },
    {
      id: '5',
      patientName: 'Marcus Aurelius',
      patientId: 'PAT-088',
      status: 'resolved',
      priority: 'medium',
      lastMessage: "Adjusted formulation with 2% Ketoconazole.",
      timeAgo: '1d ago',
      reason: 'Allergy Reaction'
    }
  ]);

  const handleApproveHandoff = (id: string) => {
    setTicketList(prev => prev.map(t => t.id === id ? { ...t, status: 'active' } : t));
  };

  const handleResolveTicket = (id: string) => {
    setTicketList(prev => prev.map(t => t.id === id ? { ...t, status: 'resolved' } : t));
  };

  const filteredRequests = ticketList.filter(req => {
    const matchesFilter = filter === 'all' || req.status === filter;
    const matchesSearch = req.patientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          req.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          req.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          req.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const selectedRequest = ticketList.find(r => r.id === selectedId);

  const pendingCount = ticketList.filter(t => t.status === 'pending').length;
  const activeCount = ticketList.filter(t => t.status === 'active').length;
  const resolvedCount = ticketList.filter(t => t.status === 'resolved').length;

  return (
    <div className="flex h-[calc(100vh-160px)] gap-6">
      {/* Sidebar Queue */}
      <div className="w-[400px] flex flex-col gap-6">
        <div className="p-8 glass-card rounded-[40px] flex flex-col h-full overflow-hidden border-white/5">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white font-display">Service Queue</h2>
            <div className="flex gap-2">
              <span className="px-2.5 py-1 bg-amber-500/10 rounded-full border border-amber-500/20 text-[9px] font-bold text-amber-400 uppercase tracking-widest">
                {pendingCount} Pending
              </span>
              <span className="px-2.5 py-1 bg-blue-500/10 rounded-full border border-blue-500/20 text-[9px] font-bold text-blue-400 uppercase tracking-widest">
                {activeCount} Active
              </span>
            </div>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..." 
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>

          <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5 mb-6 gap-1 overflow-x-auto scrollbar-none">
            {(['pending', 'active', 'resolved', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                  filter === f ? 'bg-emerald-600 text-zinc-950 shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
            {filteredRequests.map((req) => (
              <motion.div
                key={req.id}
                layout
                onClick={() => setSelectedId(req.id)}
                className={`p-5 rounded-3xl cursor-pointer border transition-all relative group ${
                  selectedId === req.id 
                    ? 'bg-white/10 border-emerald-500/30' 
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-bold text-zinc-400">
                      {req.patientName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-100">{req.patientName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{req.patientId}</p>
                        <div className="w-1 h-1 rounded-full bg-zinc-800" />
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest border flex items-center gap-1 ${
                          req.status === 'active' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          req.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${
                            req.status === 'active' ? 'bg-blue-400 animate-pulse' :
                            req.status === 'pending' ? 'bg-amber-400' :
                            'bg-emerald-400'
                          }`} />
                          {req.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-widest border ${
                    req.priority === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                    req.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                    'bg-zinc-500/10 text-zinc-400 border-white/10'
                  }`}>
                    {req.priority}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 line-clamp-2 leading-relaxed mb-3 italic">
                  "{req.lastMessage}"
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-zinc-600" />
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{req.timeAgo}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${selectedId === req.id ? 'text-emerald-500 translate-x-1' : 'text-zinc-700'}`} />
                </div>
              </motion.div>
            ))}
            {filteredRequests.length === 0 && (
              <div className="py-12 text-center text-zinc-500 text-sm italic">
                No tickets matching filters found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Conversation Canvas */}
      <div className="flex-1 flex flex-col gap-6">
        <AnimatePresence mode="wait">
          {selectedRequest ? (
            <motion.div 
              key={selectedRequest.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 glass-card rounded-[48px] border-white/5 overflow-hidden flex flex-col"
            >
              {/* Profile Header */}
              <div className="p-8 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-600 flex items-center justify-center text-zinc-950 font-bold text-2xl shadow-lg shadow-emerald-500/20">
                    {selectedRequest.patientName[0]}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white font-display">{selectedRequest.patientName}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Reason: <span className="text-emerald-400">{selectedRequest.reason}</span></span>
                      <div className="w-1 h-1 rounded-full bg-zinc-800" />
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">ID: {selectedRequest.patientId}</span>
                      <div className="w-1 h-1 rounded-full bg-zinc-800" />
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border flex items-center gap-1.5 ${
                        selectedRequest.status === 'active' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        selectedRequest.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          selectedRequest.status === 'active' ? 'bg-blue-400 animate-pulse' :
                          selectedRequest.status === 'pending' ? 'bg-amber-400' :
                          'bg-emerald-400'
                        }`} />
                        {selectedRequest.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-zinc-400 transition-all border border-white/5">
                    <Phone className="w-5 h-5" />
                  </button>
                  
                  {selectedRequest.status === 'pending' && (
                    <button 
                      onClick={() => handleApproveHandoff(selectedRequest.id)}
                      className="p-4 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 rounded-2xl font-bold transition-all flex items-center gap-3 shadow-lg shadow-emerald-500/20"
                    >
                      <Zap className="w-5 h-5" />
                      APPROVE HANDOFF
                    </button>
                  )}

                  {selectedRequest.status === 'active' && (
                    <button 
                      onClick={() => handleResolveTicket(selectedRequest.id)}
                      className="p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all flex items-center gap-3 shadow-lg shadow-blue-500/20"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      RESOLVE TICKET
                    </button>
                  )}

                  {selectedRequest.status === 'resolved' && (
                    <div className="px-5 py-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 font-bold text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      RESOLVED
                    </div>
                  )}

                  <button className="p-4 bg-white/5 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-2xl transition-all border border-white/5">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Conversation Area */}
              <div className="flex-1 p-10 overflow-y-auto custom-scrollbar flex flex-col justify-end gap-6 bg-gradient-to-b from-transparent to-white/[0.01]">
                <div className="flex flex-col gap-2 max-w-[80%]">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">HairOS AI</span>
                  </div>
                  <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-[24px] rounded-tl-none">
                    <p className="text-zinc-200 text-sm leading-relaxed">Based on your upload, I detect moderate follicular miniaturization. Would you like to see recommended clinical kits?</p>
                  </div>
                  <span className="text-[10px] text-zinc-600 ml-1">10:12 AM</span>
                </div>

                <div className="flex flex-col gap-2 max-w-[80%] self-end">
                  <div className="p-5 bg-white/5 border border-white/10 rounded-[24px] rounded-tr-none">
                    <p className="text-zinc-200 text-sm leading-relaxed">{selectedRequest.lastMessage}</p>
                  </div>
                  <span className="text-[10px] text-zinc-600 self-end mr-1">10:14 AM</span>
                </div>

                <div className="flex justify-center my-6">
                  <div className="px-4 py-2 bg-red-400/10 border border-red-400/20 rounded-full flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Potential AI hallucination detected • Handoff Requested</span>
                  </div>
                </div>
              </div>

              {/* Input Area */}
              <div className="p-8 pt-0">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Take over conversation..." 
                    className="w-full bg-white/5 border border-white/10 rounded-[28px] py-6 pl-8 pr-32 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button className="p-3 hover:bg-white/5 rounded-xl transition-all">
                      <Zap className="w-5 h-5 text-zinc-600" />
                    </button>
                    <button className="p-4 bg-emerald-600 text-zinc-950 rounded-2xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition-all">
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 glass-card rounded-[48px] border-white/5 flex flex-col items-center justify-center text-center p-10"
            >
              <div className="w-32 h-32 rounded-[40px] bg-white/5 border border-white/10 flex items-center justify-center text-zinc-700 mb-8">
                <MessageSquare className="w-16 h-16" />
              </div>
              <h3 className="text-3xl font-bold text-white font-display mb-4">Awaiting Signal</h3>
              <p className="text-zinc-500 max-w-sm mx-auto leading-relaxed">
                Select a high-priority handoff request from the queue to take manual clinical control.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Quick Stats */}
        <div className="grid grid-cols-3 gap-6">
          <div className="p-6 glass-card rounded-[32px] border-emerald-500/10 flex flex-col justify-between h-32">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Avg Response</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">1.4m</span>
              <span className="text-emerald-500 text-[10px] font-bold">↓ 12%</span>
            </div>
          </div>
          <div className="p-6 glass-card rounded-[32px] border-white/5 flex flex-col justify-between h-32">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">AI Success Rate</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">96.2%</span>
              <span className="text-blue-500 text-[10px] font-bold">High Stability</span>
            </div>
          </div>
          <div className="p-6 glass-card rounded-[32px] border-red-500/10 flex flex-col justify-between h-32">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Urgent Handover</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-red-500">{pendingCount} Cases</span>
              <span className="text-red-500/50 text-[10px] font-bold animate-pulse">ATTN REQUIRED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
