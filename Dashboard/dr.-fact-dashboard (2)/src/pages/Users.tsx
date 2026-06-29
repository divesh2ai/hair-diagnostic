import { useState, useEffect } from 'react';
import { 
  Users as UsersIcon, 
  Search, 
  Shield, 
  UserCheck, 
  UserMinus,
  MoreVertical,
  Mail,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, doc, updateDoc, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, UserRole, Clinic } from '../types';
import { Building2 } from 'lucide-react';
import { useAuth } from '../App';
import { createAuditLog } from '../lib/audit';

export default function Users() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as UserProfile));
      setUsers(usersData);
      setLoading(false);
    });

    // Fetch clinics for assignment
    const fetchClinics = async () => {
      const clinicsSnap = await getDocs(collection(db, 'clinics'));
      setClinics(clinicsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Clinic)));
    };
    fetchClinics();

    return () => unsubscribe();
  }, []);

  const updateUserRole = async (uid: string, newRole: UserRole) => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { role: newRole });
      if (profile) {
        await createAuditLog(profile, 'Update User Role', 'User', uid, `Changed role of user ${selectedUser?.displayName} to ${newRole}`);
      }
      setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
    } catch (error) {
      console.error("Error updating user role:", error);
    }
  };

  const updateUserClinic = async (uid: string, clinicId: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { clinicId });
      const clinicName = clinics.find(c => c.id === clinicId)?.name || 'Unknown';
      if (profile) {
        await createAuditLog(profile, 'Update User Clinic', 'User', uid, `Assigned user ${selectedUser?.displayName} to clinic: ${clinicName}`);
      }
      setSelectedUser(prev => prev ? { ...prev, clinicId } : null);
    } catch (error) {
      console.error("Error updating user clinic:", error);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <span className="px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest">Platform Admin</span>;
      case 'clinic_admin':
        return <span className="px-3 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest">Clinic Admin</span>;
      case 'doctor':
        return <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest">Doctor</span>;
      default:
        return <span className="px-3 py-1 bg-white/10 text-white/40 border border-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest">{role}</span>;
    }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-white font-display">User Management</h2>
          <p className="text-zinc-400 mt-2 text-lg">Control access and roles across the platform.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="glass-card rounded-2xl px-6 py-3 flex items-center gap-3 shadow-[0_0_20px_rgba(0,0,0,0.1)]">
            <UsersIcon className="w-5 h-5 text-emerald-500" />
            <span className="text-white font-semibold">{users.length} Total Users</span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.02] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.04] transition-all"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'admin', 'clinic_admin', 'doctor'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setFilterRole(role)}
              className={`px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all border ${
                filterRole === role 
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' 
                  : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {role.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-card rounded-[48px] overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.2)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-bold border-b border-white/5 bg-white/[0.02]">
                <th className="px-8 py-6">User Details</th>
                <th className="px-8 py-6">Role</th>
                <th className="px-8 py-6">Clinic</th>
                <th className="px-8 py-6">Joined Date</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                      <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Loading Users...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <p className="text-zinc-500 text-lg italic">No users found matching your criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.uid} className="group hover:bg-white/[0.02] transition-all">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-bold shadow-sm group-hover:scale-110 group-hover:bg-emerald-600 group-hover:border-emerald-500 transition-all">
                          {user.displayName?.[0] || 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-100 text-lg">{user.displayName}</p>
                          <div className="flex items-center gap-2 text-zinc-500 text-sm mt-0.5">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-8 py-6">
                      {user.role === 'admin' ? (
                        <span className="text-zinc-500 italic text-xs">Global Access</span>
                      ) : (
                        <div className="flex items-center gap-2 text-zinc-400 font-medium">
                          <Building2 className="w-4 h-4 text-zinc-500" />
                          {clinics.find(c => c.id === user.clinicId)?.name || 'Unassigned'}
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-zinc-400 font-medium">
                        <Calendar className="w-4 h-4 text-zinc-500" />
                        {user.createdAt instanceof Date ? user.createdAt.toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => setSelectedUser(user)}
                        className="p-3 bg-white/5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <Shield className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Update Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-[48px] p-10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-10 opacity-5">
                <Shield className="w-32 h-32 text-emerald-500" />
              </div>

              <div className="relative z-10 space-y-8">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-emerald-600/20 rounded-[32px] flex items-center justify-center mx-auto text-emerald-500">
                    <Shield className="w-10 h-10" />
                  </div>
                  <h3 className="text-3xl font-bold text-white italic serif">Update Permissions</h3>
                  <p className="text-white/40">Change the access level for <span className="text-white font-bold">{selectedUser.displayName}</span></p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] px-2">Access Level</p>
                    {(['admin', 'clinic_admin', 'doctor'] as const).map((role) => (
                      <button
                        key={role}
                        onClick={() => updateUserRole(selectedUser.uid, role)}
                        className={`w-full p-4 rounded-[24px] border transition-all flex items-center justify-between group ${
                          selectedUser.role === role
                            ? 'bg-emerald-600/10 border-emerald-500/50 text-white'
                            : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2.5 rounded-xl ${
                            selectedUser.role === role ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white/40 group-hover:text-white'
                          }`}>
                            {role === 'admin' ? <Shield className="w-4 h-4" /> : role === 'clinic_admin' ? <Shield className="w-4 h-4 opacity-50" /> : <UsersIcon className="w-4 h-4" />}
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-sm capitalize">{role.replace('_', ' ')}</p>
                          </div>
                        </div>
                        {selectedUser.role === role && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      </button>
                    ))}
                  </div>

                  {selectedUser.role !== 'admin' && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] px-2">Assigned Clinic</p>
                      <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                        {clinics.map((clinic) => (
                          <button
                            key={clinic.id}
                            onClick={() => updateUserClinic(selectedUser.uid, clinic.id)}
                            className={`w-full p-4 rounded-[20px] border transition-all flex items-center justify-between group ${
                              selectedUser.clinicId === clinic.id
                                ? 'bg-blue-600/10 border-blue-500/50 text-white'
                                : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                selectedUser.clinicId === clinic.id ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/40 group-hover:text-white'
                              }`}>
                                <Building2 className="w-4 h-4" />
                              </div>
                              <p className="font-bold text-sm truncate max-w-[180px]">{clinic.name}</p>
                            </div>
                            {selectedUser.clinicId === clinic.id && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => setSelectedUser(null)}
                  className="w-full py-4 text-white/40 hover:text-white font-bold transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
