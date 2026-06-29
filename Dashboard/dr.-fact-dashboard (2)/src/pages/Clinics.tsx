import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Clinic } from '../types';
import { 
  Building2, 
  Plus, 
  Search, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  Activity,
  Users,
  TrendingUp,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ClinicModal from '../components/ClinicModal';

export default function Clinics() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({});
  const [expandedCities, setExpandedCities] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const clinicsRef = collection(db, 'clinics');
    const q = query(clinicsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClinics(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Clinic)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredClinics = clinics.filter(c => {
    if (!searchQuery.trim()) return true;
    
    // Split query into multiple terms (e.g. "Maharashtra Mumbai" -> ["maharashtra", "mumbai"])
    const terms = searchQuery.toLowerCase().split(' ').filter(t => t.trim() !== '');
    
    // Create a compiled searchable string to match against
    const searchableText = [
      c.name,
      c.address,
      c.state,
      c.city,
      c.area,
      c.phone
    ].filter(Boolean).join(' ').toLowerCase();

    // Check if every term in the search query is found in the clinic's data
    return terms.every(term => searchableText.includes(term));
  });

  const toggleState = (state: string) => {
    setExpandedStates(prev => ({ ...prev, [state]: !prev[state] }));
  };

  const toggleCity = (cityKey: string) => {
    setExpandedCities(prev => ({ ...prev, [cityKey]: !prev[cityKey] }));
  };

  const groupedClinics = filteredClinics.reduce((acc, clinic) => {
    const state = clinic.state || 'Unspecified State';
    const city = clinic.city || 'Unspecified City';
    const area = clinic.area || 'Unspecified Area';
    
    if (!acc[state]) acc[state] = {};
    if (!acc[state][city]) acc[state][city] = {};
    if (!acc[state][city][area]) acc[state][city][area] = [];
    
    acc[state][city][area].push(clinic);
    return acc;
  }, {} as Record<string, Record<string, Record<string, Clinic[]>>>);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white font-display">Clinics</h2>
          <p className="text-zinc-400 mt-1">Control tower for all hair clinics in the HairOS network.</p>
        </div>
        <button 
          onClick={() => {
            setEditingClinic(null);
            setShowModal(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-5 h-5" />
          Add New Clinic
        </button>
      </div>

      {showModal && (
        <ClinicModal 
          clinic={editingClinic}
          onClose={() => setShowModal(false)}
          onSuccess={() => {}}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { name: 'Total Clinics', value: clinics.length, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          { name: 'Total Patients', value: '4,284', icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          { name: 'System Health', value: '99.9%', icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
        ].map((stat) => (
          <div key={stat.name} className="p-6 glass-card rounded-3xl space-y-4 shadow-[0_0_20px_rgba(0,0,0,0.1)]">
            <div className={`p-3 rounded-2xl w-fit border ${stat.bg} ${stat.color} ${stat.border}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-zinc-400 font-medium">{stat.name}</p>
              <p className="text-3xl font-bold text-white mt-1 font-display">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-[32px] overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.2)]">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white font-display">Clinic Performance</h3>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clinics..." 
              className="bg-white/[0.02] border border-white/10 rounded-2xl py-2.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm w-64 text-white placeholder:text-zinc-600"
            />
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="py-20 text-center"><Activity className="w-8 h-8 animate-spin text-emerald-500 mx-auto" /></div>
          ) : Object.keys(groupedClinics).length === 0 ? (
            <div className="py-20 text-center text-zinc-600 italic">No clinics found.</div>
          ) : (
            Object.entries(groupedClinics).map(([state, cities]) => {
              const isStateExpanded = searchQuery.trim().length > 0 || expandedStates[state];
              return (
                <div key={state} className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02]">
                  <button 
                    onClick={() => toggleState(state)}
                    className="w-full flex items-center justify-between p-6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white/5 rounded-xl border border-white/10">
                        <MapPin className="w-5 h-5 text-emerald-500" />
                      </div>
                      <h4 className="text-xl font-display font-semibold text-zinc-100">{state}</h4>
                      <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-zinc-400">
                        {Object.values(cities).reduce((acc, areas) => acc + Object.values(areas).reduce((a, clinics) => a + clinics.length, 0), 0)} Clinics
                      </span>
                    </div>
                    {isStateExpanded ? <ChevronUp className="w-5 h-5 text-zinc-500" /> : <ChevronDown className="w-5 h-5 text-zinc-500" />}
                  </button>

                  <AnimatePresence>
                    {isStateExpanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/5 bg-black/20"
                      >
                        {Object.entries(cities).map(([city, areas]) => {
                          const cityKey = `${state}|${city}`;
                          const isCityExpanded = searchQuery.trim().length > 0 || expandedCities[cityKey];
                          
                          return (
                            <div key={city} className="border-b border-white/5 last:border-b-0">
                              <button 
                                onClick={() => toggleCity(cityKey)}
                                className="w-full flex items-center justify-between p-5 pl-12 hover:bg-white/[0.02] transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <h5 className="text-lg font-medium text-zinc-200">{city}</h5>
                                  <span className="text-xs text-zinc-500 font-medium px-2 py-0.5 bg-white/5 rounded-lg">
                                    {Object.values(areas).reduce((a, c) => a + c.length, 0)} Clinics
                                  </span>
                                </div>
                                {isCityExpanded ? <ChevronUp className="w-4 h-4 text-zinc-600" /> : <ChevronDown className="w-4 h-4 text-zinc-600" />}
                              </button>

                              <AnimatePresence>
                                {isCityExpanded && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="bg-black/40"
                                  >
                                    {Object.entries(areas).map(([area, areaClinics]) => (
                                      <div key={area} className="p-4 pl-20">
                                        <h6 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider">{area}</h6>
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                          {areaClinics.map(clinic => (
                                            <div key={clinic.id} className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 hover:bg-white/[0.05] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group cursor-pointer shadow-sm">
                                              <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-bold group-hover:bg-emerald-600 group-hover:border-emerald-500 transition-all shadow-sm shrink-0">
                                                  {clinic.name[0]}
                                                </div>
                                                <div>
                                                  <p className="font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">{clinic.name}</p>
                                                  <p className="text-xs text-zinc-500 font-mono mt-1">ID: {clinic.id.slice(0, 8)}</p>
                                                </div>
                                              </div>
                                              
                                              <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full">
                                                <div className="text-xs text-zinc-400 text-left sm:text-right hidden sm:block">
                                                  <p className="max-w-[150px] truncate" title={clinic.address}>{clinic.address || 'No address'}</p>
                                                  <p className="mt-1">{clinic.phone || 'No phone'}</p>
                                                </div>
                                                <button 
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingClinic(clinic);
                                                    setShowModal(true);
                                                  }}
                                                  className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl transition-all text-zinc-400 hover:text-white"
                                                >
                                                  <Edit2 className="w-4 h-4" />
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
