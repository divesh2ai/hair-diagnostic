import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLanguage, Language } from '../lib/i18n';
import { createAuditLog } from '../lib/audit';
import { 
  User, 
  Shield, 
  Bell, 
  Globe, 
  CreditCard, 
  ChevronRight,
  Building2,
  Check,
  Save,
  Loader2
} from 'lucide-react';

const AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aiden',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Caleb',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucas',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Chloe',
];

const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'hi', name: 'Hindi (हिन्दी)', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi (मराठी)', flag: '🇮🇳' },
  { code: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati (ગુજરાતી)', flag: '🇮🇳' },
];

export default function Settings() {
  const { profile } = useAuth();
  const { language: currentLang, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'profile' | 'language' | 'menu' | 'billing'>('menu');
  const [saving, setSaving] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(profile?.avatarUrl || AVATARS[0]);
  const [name, setName] = useState(profile?.displayName || '');
  const [specialty, setSpecialty] = useState(profile?.specialty || '');

  const PLANS = [
    { name: 'Starter', price: '₹4,999', period: '/month', desc: 'Up to 2 doctors, 100 reports/mo' },
    { name: 'Professional', price: '₹14,999', period: '/month', desc: 'Up to 10 doctors, unlimited reports', popular: true },
    { name: 'Enterprise', price: 'Custom', period: '', desc: 'Unlimited everything, dedicated support' },
  ];

  useEffect(() => {
    if (profile) {
      if (profile.avatarUrl) setSelectedAvatar(profile.avatarUrl);
      if (profile.displayName) setName(profile.displayName);
      if (profile.specialty) setSpecialty(profile.specialty);
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName: name,
        specialty,
        avatarUrl: selectedAvatar,
      });
      await createAuditLog(profile, 'Update Profile', 'User', profile.uid, `Updated user profile and avatar`);
      setActiveTab('menu');
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = async (lang: Language) => {
    if (!profile) return;
    setLanguage(lang);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        language: lang,
      });
      await createAuditLog(profile, 'Change Language', 'User', profile.uid, `Changed preferred language to ${lang}`);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  if (activeTab === 'profile') {
    return (
      <div className="space-y-8 max-w-4xl">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveTab('menu')} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <ChevronRight className="w-6 h-6 rotate-180" />
          </button>
          <h2 className="text-3xl font-bold text-white font-display">Edit Profile</h2>
        </div>

        <div className="p-8 glass-card rounded-[40px] space-y-8">
          <div>
            <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Select Doctor Avatar</h4>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
              {AVATARS.map((avatar) => (
                <button
                  key={avatar}
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all group ${
                    selectedAvatar === avatar ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-white/5 hover:border-white/20'
                  }`}
                >
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  {selectedAvatar === avatar && (
                    <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                      <Check className="w-6 h-6 text-emerald-500" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Name"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Medical Specialty</label>
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Trichologist"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 items-center"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Profile Changes
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'billing') {
    return (
      <div className="space-y-8 max-w-4xl">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveTab('menu')} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-zinc-400 hover:text-white">
            <ChevronRight className="w-6 h-6 rotate-180" />
          </button>
          <h2 className="text-3xl font-bold text-white font-display">Billing & Subscription</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`p-8 glass-card rounded-[40px] relative overflow-hidden border ${plan.popular ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/5'}`}>
              {plan.popular && (
                <div className="absolute top-0 right-0 p-3 bg-emerald-500 text-zinc-950 text-[10px] font-bold uppercase tracking-widest rounded-bl-2xl">
                  Popular
                </div>
              )}
              <h4 className="text-xl font-bold text-white mb-2">{plan.name}</h4>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold text-white font-display">{plan.price}</span>
                <span className="text-zinc-500 text-sm font-medium">{plan.period}</span>
              </div>
              <p className="text-sm text-zinc-400 mb-8 leading-relaxed">{plan.desc}</p>
              <button className={`w-full py-4 rounded-2xl font-bold transition-all ${plan.popular ? 'bg-emerald-500 hover:bg-emerald-600 text-zinc-950 shadow-lg shadow-emerald-500/20' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'}`}>
                {plan.price === 'Custom' ? 'Contact Sales' : 'Select Plan'}
              </button>
            </div>
          ))}
        </div>

        <div className="p-8 glass-card rounded-[40px] border border-white/5 space-y-6">
          <h3 className="text-xl font-bold text-white font-display">Payment Methods</h3>
          <div className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/10 group hover:border-white/20 transition-all cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-xl border border-white/10 group-hover:border-white/20 transition-all">
                <CreditCard className="w-6 h-6 text-zinc-400 group-hover:text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-100">UPI / Credit Card / Net Banking</p>
                <p className="text-xs text-zinc-500 mt-1">Available via Indian Payment Gateways</p>
              </div>
            </div>
            <button className="text-emerald-500 text-sm font-bold hover:underline">Manage</button>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'language') {
    return (
      <div className="space-y-8 max-w-4xl">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveTab('menu')} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <ChevronRight className="w-6 h-6 rotate-180" />
          </button>
          <h2 className="text-3xl font-bold text-white font-display">Language Settings</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`p-6 glass-card rounded-3xl border transition-all flex items-center justify-between group ${
                currentLang === lang.code ? 'border-emerald-500 bg-emerald-500/5' : 'border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">{lang.flag}</span>
                <span className={`font-bold ${currentLang === lang.code ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                  {lang.name}
                </span>
              </div>
              {currentLang === lang.code && <Check className="w-6 h-6 text-emerald-500" />}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'profile', name: 'Profile Information', icon: User, desc: 'Update your personal details and photo' },
    { id: 'security', name: 'Security', icon: Shield, desc: 'Manage your password and 2FA' },
    { id: 'clinic', name: t('clinic_settings') || 'Clinic Settings', icon: Building2, desc: 'Manage clinic details and staff', roles: ['admin', 'clinic_admin'] },
    { id: 'notifs', name: 'Notifications', icon: Bell, desc: 'Configure how you receive alerts' },
    { id: 'billing', name: 'Billing & Subscription', icon: CreditCard, desc: 'Manage your HairOS plan and invoices', roles: ['admin', 'clinic_admin'] },
    { id: 'language', name: 'Language & Region', icon: Globe, desc: 'Set your preferred language and timezone' },
  ];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white font-display">{t('settings')}</h2>
        <p className="text-zinc-400 mt-1">Manage your account and platform preferences.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sections.filter(s => !s.roles || s.roles.includes(profile?.role || 'doctor')).map((section) => (
          <div 
            key={section.id} 
            onClick={() => {
              if (section.id === 'profile' || section.id === 'language' || section.id === 'billing') setActiveTab(section.id as any);
            }}
            className="p-6 glass-card rounded-3xl hover:border-white/20 transition-all cursor-pointer group flex items-center justify-between shadow-[0_0_20px_rgba(0,0,0,0.1)]"
          >
            <div className="flex items-center gap-6">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-emerald-500 group-hover:bg-emerald-600 group-hover:border-emerald-500 group-hover:text-white transition-all shadow-sm">
                <section.icon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-zinc-100">{section.name}</h4>
                <p className="text-sm text-zinc-500 mt-1">{section.desc}</p>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
          </div>
        ))}
      </div>

      <div className="p-8 bg-red-500/5 border border-red-500/10 rounded-[32px] space-y-4 shadow-[0_0_30px_rgba(239,68,68,0.05)]">
        <h4 className="text-lg font-bold text-red-400 font-display">Danger Zone</h4>
        <p className="text-sm text-zinc-500">Once you delete your account or clinic data, there is no going back. Please be certain.</p>
        <button className="px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-semibold hover:bg-red-500 hover:text-white transition-all shadow-sm">
          Delete Account
        </button>
      </div>
    </div>
  );
}
