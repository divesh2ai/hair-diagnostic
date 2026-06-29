import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { AuditLog } from '../types';
import { useAuth } from '../App';
import { useLanguage } from '../lib/i18n';
import { 
  History, 
  Search, 
  Filter,
  User,
  Activity,
  Calendar,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AuditLogs() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEntity, setFilterEntity] = useState('all');

  useEffect(() => {
    if (!profile) return;

    const logsRef = collection(db, 'audit_logs');
    let q = query(logsRef, orderBy('createdAt', 'desc'));

    if (profile.role !== 'admin') {
      q = query(logsRef, where('clinicId', '==', profile.clinicId), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesEntity = filterEntity === 'all' || log.entity === filterEntity;

    return matchesSearch && matchesEntity;
  });

  const entities = ['all', ...Array.from(new Set(logs.map(l => l.entity)))];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <History className="w-6 h-6 text-emerald-500" />
          </div>
          <h2 className="text-3xl font-bold text-white font-display">{t('auditLogs')}</h2>
        </div>
        <p className="text-zinc-400 font-medium tracking-tight">Monitor user activity and system events across the platform.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search by user, action or details..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all shadow-lg"
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl">
            <Filter className="w-4 h-4 text-zinc-500" />
            <select 
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="bg-transparent text-sm text-zinc-300 focus:outline-none capitalize"
            >
              {entities.map(e => (
                <option key={e} value={e} className="bg-[#0a0a0a] text-zinc-300">{e}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-[40px] overflow-hidden border border-white/5 shadow-2xl relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-8 py-6 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Timestamp</th>
                <th className="px-8 py-6 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">User</th>
                <th className="px-8 py-6 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Action</th>
                <th className="px-8 py-6 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Entity</th>
                <th className="px-8 py-6 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Details</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-40">
                        <AlertCircle className="w-12 h-12 text-zinc-600" />
                        <p className="text-zinc-500 font-medium italic">No audit logs found matching your search.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <motion.tr 
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group hover:bg-white/[0.02] transition-all border-b border-white/5 last:border-0"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                            <Calendar className="w-4 h-4 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-zinc-100">
                              {log.createdAt?.toDate().toLocaleDateString()}
                            </p>
                            <p className="text-[10px] text-zinc-500 font-mono">
                              {log.createdAt?.toDate().toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                            <User className="w-4 h-4 text-zinc-400" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-zinc-100 uppercase tracking-tight">{log.userName}</p>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{log.userRole?.replace('_', ' ')}</p>
                            <p className="text-[8px] text-zinc-600 font-mono mt-0.5 break-all opacity-0 group-hover:opacity-100 transition-opacity">UID: {log.userId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-zinc-500" />
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                            log.action.includes('Create') ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                            log.action.includes('Update') ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                            log.action.includes('Delete') ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                          }`}>
                            {log.action}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.1em] px-2 py-1 bg-white/5 rounded-md border border-white/5">
                          {log.entity}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs text-zinc-400 font-medium leading-relaxed max-w-md line-clamp-2 italic group-hover:line-clamp-none transition-all">
                          {log.details}
                        </p>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        <div className="p-6 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
          <p className="text-xs text-zinc-500 font-medium">
            Showing <span className="text-zinc-300 font-bold">{filteredLogs.length}</span> of <span className="text-zinc-300 font-bold">{logs.length}</span> events
          </p>
          <div className="flex gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Audit logs are maintained for <span className="text-emerald-500">90 days</span>
          </div>
        </div>
      </div>
    </div>
  );
}
