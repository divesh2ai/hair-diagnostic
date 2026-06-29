import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, UserRole } from './types';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Settings as SettingsIcon, 
  LogOut, 
  Search, 
  Bell, 
  Stethoscope, 
  Building2,
  MessageCircle,
  Headphones,
  PlusCircle,
  BookOpen,
  PlayCircle,
  Settings2,
  History,
  Calendar,
  Pill,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Activity
} from 'lucide-react';
import { motion } from 'motion/react';

// Pages
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientProfile from './pages/PatientProfile';
import Reports from './pages/Reports';
import Clinics from './pages/Clinics';
import Settings from './pages/Settings';
import UsersPage from './pages/Users';
import AuditLogs from './pages/AuditLogs';
import ValidationDashboard from './pages/ValidationDashboard';
import KnowledgeBase from './pages/KnowledgeBase';
import HumanHandoff from './pages/HumanHandoff';

import { LanguageProvider, useLanguage } from './lib/i18n';

// --- Auth Context ---
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Filter Context ---
interface FilterContextType {
  clinicId: string;
  doctorId: string;
  dateRange: { start: Date | null, end: Date | null };
  setClinicId: (id: string) => void;
  setDoctorId: (id: string) => void;
  setDateRange: (range: { start: Date | null, end: Date | null }) => void;
}

const FilterContext = createContext<FilterContextType | null>(null);

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (!context) throw new Error('useFilters must be used within FilterProvider');
  return context;
};

export const FilterProvider = ({ children }: { children: React.ReactNode }) => {
  const { profile } = useAuth();
  const [clinicId, setClinicId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [dateRange, setDateRange] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });

  useEffect(() => {
    if (profile?.clinicId) setClinicId(profile.clinicId);
    if (profile?.role === 'doctor') setDoctorId(profile.uid);
  }, [profile]);

  return (
    <FilterContext.Provider value={{ clinicId, doctorId, dateRange, setClinicId, setDoctorId, setDateRange }}>
      {children}
    </FilterContext.Provider>
  );
};

// --- Components ---
const Sidebar = ({ role, profile }: { role: UserRole, profile: UserProfile | null }) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useLanguage();
  
  const sections = [
    {
      title: null,
      links: [
        { name: t('dashboard'), path: '/', icon: LayoutDashboard, roles: ['admin', 'clinic_admin', 'doctor'] },
        { name: 'Validation', path: '/validation', icon: Activity, roles: ['admin', 'clinic_admin', 'doctor'] },
        { name: t('patients'), path: '/patients', icon: Users, roles: ['admin', 'clinic_admin', 'doctor'] },
        { name: t('reports'), path: '/reports', icon: FileText, roles: ['admin', 'clinic_admin', 'doctor'] },
        { name: 'Clinics', path: '/clinics', icon: Building2, roles: ['admin'] },
        { name: 'Users', path: '/users', icon: Users, roles: ['admin'] },
      ]
    },
    {
      title: 'Communication',
      links: [
        { name: 'WhatsApp Chatbot', path: '/chatbot', icon: MessageCircle, roles: ['admin', 'clinic_admin', 'doctor'] },
        { name: 'Human Handoff', path: '/handoff', icon: Headphones, roles: ['admin', 'clinic_admin', 'doctor'] },
      ]
    },
    {
      title: 'AI Knowledge Base',
      links: [
        { name: 'Create Agent', path: '/create-agent', icon: PlusCircle, roles: ['admin', 'clinic_admin', 'doctor'] },
        { name: 'Knowledge Base', path: '/knowledge-base', icon: BookOpen, roles: ['admin', 'clinic_admin', 'doctor'] },
        { name: 'Test Agent', path: '/test-agent', icon: PlayCircle, roles: ['admin', 'clinic_admin', 'doctor'] },
        { name: 'Agent Settings', path: '/agent-settings', icon: Settings2, roles: ['admin', 'clinic_admin', 'doctor'] },
      ]
    },
    {
      title: 'System',
      links: [
        { name: 'Clinic Schedule', path: '/schedule', icon: Calendar, roles: ['admin', 'clinic_admin', 'doctor'] },
        { name: 'Saved Prescriptions', path: '/prescriptions', icon: Pill, roles: ['admin', 'clinic_admin', 'doctor'] },
        { name: t('auditLogs'), path: '/audit-logs', icon: History, roles: ['admin', 'clinic_admin', 'doctor'] },
        { name: t('settings'), path: '/settings', icon: SettingsIcon, roles: ['admin', 'clinic_admin', 'doctor'] },
      ]
    }
  ];

  return (
    <aside className={`${collapsed ? 'w-20' : 'w-72'} bg-zinc-950/80 backdrop-blur-3xl border-r border-white/5 flex flex-col h-screen sticky top-0 transition-all duration-300 z-30`}>
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3 text-white">
          <div className="p-2 bg-emerald-500 rounded-xl shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Stethoscope className="w-6 h-6 text-zinc-950" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden whitespace-nowrap">
              <span className="text-xl font-bold tracking-tight block font-display">HairOS</span>
              <span className="text-[10px] text-emerald-400/80 uppercase font-bold tracking-[0.2em]">Platform FACT</span>
            </div>
          )}
        </div>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/20 hover:text-white"
        >
          <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>
      
      <nav className="flex-1 px-4 space-y-10 mt-6 overflow-y-auto custom-scrollbar pb-10">
        {sections.map((section, idx) => {
          const visibleLinks = section.links.filter(link => link.roles.includes(role));
          if (visibleLinks.length === 0) return null;

          return (
            <div key={idx} className="space-y-4">
              {!collapsed && section.title && (
                <p className="px-4 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-3">
                  {section.title}
                </p>
              )}
              <div className="space-y-1.5">
                {visibleLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group relative ${
                      location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path))
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03]'
                    }`}
                  >
                    {location.pathname === link.path && (
                      <motion.div 
                        layoutId="active-nav"
                        className="absolute left-0 w-1 h-6 bg-emerald-400 rounded-r-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                      />
                    )}
                    <link.icon className={`w-5 h-5 shrink-0 transition-colors ${
                      location.pathname === link.path ? 'text-emerald-400' : 'group-hover:text-zinc-100'
                    }`} />
                    {!collapsed && <span className="font-medium text-sm truncate tracking-tight">{link.name}</span>}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5 space-y-2">
        {!collapsed && profile && (
          <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-white/5 rounded-2xl border border-white/5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-0.5 shadow-lg shadow-emerald-500/10">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full rounded-lg object-cover" />
              ) : (
                <div className="w-full h-full bg-emerald-500 rounded-lg flex items-center justify-center text-zinc-950 font-bold shrink-0">
                  {profile.displayName?.[0] || 'D'}
                </div>
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-zinc-100 truncate">{profile.displayName}</p>
              <p className="text-[10px] text-zinc-400 truncate">{profile.email}</p>
            </div>
          </div>
        )}
        
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-4 py-3 w-full text-white/30 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span className="font-medium text-sm">Collapse</span>}
        </button>

        <button 
          onClick={() => signOut(auth)}
          className="flex items-center gap-3 px-4 py-3 w-full text-white/30 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all"
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="font-medium text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
};

const Header = ({ profile }: { profile: UserProfile | null }) => {
  const { clinicId, setClinicId, doctorId, setDoctorId } = useFilters();
  const { t } = useLanguage();
  
  return (
    <header className="h-20 border-b border-white/10 bg-[#050505]/80 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-20">
      <div className="flex items-center gap-4 flex-1 max-w-2xl">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-emerald-500 transition-colors" />
          <input 
            type="text" 
            placeholder={t('welcome') + "..."} 
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 pl-12 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all"
          />
        </div>
        
        {/* Global Filters */}
        <div className="flex items-center gap-2">
          {profile?.role === 'admin' && (
            <select 
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all min-w-[120px]"
            >
              <option value="">All Clinics</option>
              <option value="clinic_1">Downtown Clinic</option>
              <option value="clinic_2">Westside Medical</option>
            </select>
          )}
          {(profile?.role === 'admin' || profile?.role === 'clinic_admin') && (
            <select 
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all min-w-[120px]"
            >
              <option value="">All Doctors</option>
              <option value="dr_1">Dr. Sarah Smith</option>
              <option value="dr_2">Dr. John Doe</option>
            </select>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <button className="p-2.5 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-[#050505]"></span>
          </button>
        </div>
        
        <div className="h-8 w-px bg-white/10"></div>
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-white tracking-tight">{profile?.displayName || 'User'}</p>
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">{profile?.role?.replace('_', ' ') || 'Doctor'}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-0.5 shadow-lg shadow-emerald-500/10 transition-transform hover:scale-105">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full rounded-lg object-cover" />
            ) : (
              <div className="w-full h-full bg-emerald-500 rounded-lg flex items-center justify-center text-zinc-950 font-bold">
                {profile?.displayName?.[0] || 'U'}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

// --- Auth Provider ---
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProfile({ uid: firebaseUser.uid, ...docSnap.data() } as UserProfile);
        } else {
          // New user - check if it's Devesh
          const isAdmin = firebaseUser.email === 'divesh2ai@gmail.com';
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email!,
            role: isAdmin ? 'admin' : 'doctor',
            displayName: firebaseUser.displayName || (isAdmin ? 'Devesh' : 'Doctor'),
            createdAt: new Date()
          };
          
          // Persist to Firestore
          try {
            const { setDoc } = await import('firebase/firestore');
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          } catch (error) {
            console.error("Error creating user profile:", error);
            // Fallback to state only if Firestore fails
            setProfile(newProfile);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// --- Main App ---
// --- Placeholder Page for new features ---
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="p-8">
    <div className="p-12 bg-white/5 border border-white/10 rounded-[40px] text-center space-y-4">
      <div className="w-20 h-20 bg-emerald-600/20 rounded-3xl flex items-center justify-center mx-auto text-emerald-500">
        <Sparkles className="w-10 h-10" />
      </div>
      <h2 className="text-3xl font-bold text-white italic serif">{title}</h2>
      <p className="text-white/40 max-w-md mx-auto">
        This feature is currently under development. We're working hard to bring you the best AI-powered clinic management experience.
      </p>
      <Link to="/" className="inline-block px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all">
        Back to Dashboard
      </Link>
    </div>
  </div>
);

const AppContent = () => {
  const { user, profile, signIn } = useAuth();
  const { setLanguage } = useLanguage();

  useEffect(() => {
    if (profile?.language) {
      setLanguage(profile.language);
    }
  }, [profile, setLanguage]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full p-12 bg-white/5 border border-white/10 rounded-[48px] text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="p-4 bg-emerald-600 rounded-3xl shadow-2xl shadow-emerald-500/40">
              <Stethoscope className="w-12 h-12 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-white">HairOS</h1>
            <p className="text-white/40">Premium Hair Clinic Management</p>
          </div>
          <button 
            onClick={signIn}
            className="w-full bg-white text-black py-4 rounded-2xl font-bold hover:bg-white/90 transition-all flex items-center justify-center gap-3"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#050505]">
      <Sidebar role={profile?.role || 'doctor'} profile={profile} />
      <div className="flex-1 flex flex-col">
        <Header profile={profile} />
        <main className="p-8 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientProfile />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/clinics" element={<Clinics />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/validation" element={<ValidationDashboard />} />
            <Route path="/settings" element={<Settings />} />
            
            {/* New Routes */}
            <Route path="/chatbot" element={<PlaceholderPage title="WhatsApp Chatbot" />} />
            <Route path="/handoff" element={<HumanHandoff />} />
            <Route path="/create-agent" element={<PlaceholderPage title="Create AI Agent" />} />
            <Route path="/knowledge-base" element={<KnowledgeBase />} />
            <Route path="/test-agent" element={<PlaceholderPage title="Test Agent" />} />
            <Route path="/agent-settings" element={<PlaceholderPage title="Agent Settings" />} />
            <Route path="/schedule" element={<PlaceholderPage title="Clinic Schedule" />} />
            <Route path="/prescriptions" element={<PlaceholderPage title="Saved Prescriptions" />} />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <FilterProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </FilterProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
