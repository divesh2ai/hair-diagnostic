import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Package, CheckCircle2, Sparkles, Zap } from 'lucide-react';

interface Props {
  kits: string[];
  patientName: string;
  onComplete: () => void;
}

const ITEM_COLORS = [
  { bg: 'bg-emerald-500', glow: 'shadow-emerald-500/50', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  { bg: 'bg-purple-500', glow: 'shadow-purple-500/50', border: 'border-purple-500/30', text: 'text-purple-400' },
  { bg: 'bg-blue-500', glow: 'shadow-blue-500/50', border: 'border-blue-500/30', text: 'text-blue-400' },
  { bg: 'bg-amber-500', glow: 'shadow-amber-500/50', border: 'border-amber-500/30', text: 'text-amber-400' },
  { bg: 'bg-pink-500', glow: 'shadow-pink-500/50', border: 'border-pink-500/30', text: 'text-pink-400' },
];

export default function CartAnimation({ kits, patientName, onComplete }: Props) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'packed' | 'launching' | 'done'>('idle');
  const [loadedCount, setLoadedCount] = useState(0);
  const [cartBounce, setCartBounce] = useState(false);
  const [activeItem, setActiveItem] = useState<number | null>(null);

  useEffect(() => {
    // Start after mount
    const startDelay = setTimeout(() => setPhase('loading'), 400);
    return () => clearTimeout(startDelay);
  }, []);

  useEffect(() => {
    if (phase !== 'loading') return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    kits.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setActiveItem(i);
        timers.push(setTimeout(() => {
          setLoadedCount(prev => prev + 1);
          setCartBounce(true);
          timers.push(setTimeout(() => setCartBounce(false), 350));
          setActiveItem(null);

          if (i === kits.length - 1) {
            timers.push(setTimeout(() => setPhase('packed'), 600));
          }
        }, 550));
      }, i * 800));
    });

    return () => timers.forEach(clearTimeout);
  }, [phase, kits]);

  useEffect(() => {
    if (phase !== 'packed') return;
    const t = setTimeout(() => setPhase('launching'), 1200);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'launching') return;
    const t = setTimeout(() => {
      setPhase('done');
      setTimeout(onComplete, 900);
    }, 900);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl overflow-hidden">
      {/* Ambient background pulse */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: phase === 'launching' ? [0.3, 0.8, 0] : 0.3 }}
        transition={{ duration: 0.9 }}
        style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.15) 0%, transparent 70%)' }}
      />

      {/* Particle sparks on launch */}
      <AnimatePresence>
        {phase === 'launching' && Array.from({ length: 16 }).map((_, i) => (
          <motion.div
            key={`spark-${i}`}
            className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400"
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: Math.cos((i / 16) * Math.PI * 2) * 180 + 120,
              y: Math.sin((i / 16) * Math.PI * 2) * 120,
              scale: 0,
            }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>

      <div className="relative flex flex-col items-center gap-16 max-w-xl w-full px-8">

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-[0.3em]">Kit Dispatch</span>
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 className="text-3xl font-bold text-white font-display">
            {phase === 'done' ? 'Order Dispatched!' : `Loading Kits for ${patientName}`}
          </h2>
        </motion.div>

        {/* Central stage — flying items + cart */}
        <div className="relative w-full h-48 flex items-center justify-center">

          {/* Flying items */}
          <AnimatePresence>
            {phase === 'loading' && kits.map((kit, i) => {
              const color = ITEM_COLORS[i % ITEM_COLORS.length];
              const isActive = activeItem === i;
              if (!isActive) return null;

              return (
                <motion.div
                  key={`item-${i}`}
                  className={`absolute left-0 flex items-center gap-2 px-4 py-3 rounded-2xl border ${color.border} bg-zinc-950 shadow-xl ${color.glow}`}
                  initial={{ x: -220, y: 0, opacity: 0, scale: 0.7, rotate: -8 }}
                  animate={{ x: 80, y: 0, opacity: [0, 1, 1, 0], scale: [0.7, 1, 1, 0.5], rotate: [-8, 0, 0, 8] }}
                  transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  <Package className={`w-4 h-4 ${color.text}`} />
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-tight max-w-[120px] truncate">{kit}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Shopping Cart */}
          <motion.div
            className="relative"
            animate={
              phase === 'launching'
                ? { x: 320, y: -80, scale: 0.3, opacity: 0, rotate: 15 }
                : cartBounce
                ? { y: [0, -18, 4, -8, 0], scale: [1, 1.12, 0.96, 1.04, 1] }
                : { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }
            }
            transition={
              phase === 'launching'
                ? { duration: 0.85, ease: [0.55, 0, 1, 0.45] }
                : { duration: 0.35, ease: 'easeOut' }
            }
          >
            {/* Glow ring */}
            <motion.div
              className="absolute -inset-4 rounded-full bg-emerald-500/10 blur-xl"
              animate={{ scale: cartBounce ? 1.4 : 1, opacity: cartBounce ? 0.8 : 0.3 }}
              transition={{ duration: 0.3 }}
            />

            {/* Cart body */}
            <div className="relative w-28 h-28 rounded-[32px] bg-zinc-900 border border-emerald-500/30 flex items-center justify-center shadow-2xl shadow-emerald-500/20">
              <ShoppingCart className="w-14 h-14 text-emerald-400" strokeWidth={1.5} />

              {/* Badge counter */}
              <AnimatePresence>
                {loadedCount > 0 && (
                  <motion.div
                    key={loadedCount}
                    initial={{ scale: 0.4, y: 6 }}
                    animate={{ scale: 1, y: 0 }}
                    className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/50 border-2 border-zinc-950"
                  >
                    <span className="text-xs font-bold text-zinc-950">{loadedCount}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Speed lines on launch */}
            <AnimatePresence>
              {phase === 'launching' && [0, 1, 2].map(i => (
                <motion.div
                  key={`line-${i}`}
                  className="absolute top-1/2 right-full w-12 h-0.5 bg-emerald-500/40 rounded-full"
                  style={{ marginTop: (i - 1) * 12 }}
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: [0, 1, 0] }}
                  transition={{ duration: 0.4, delay: 0.1 * i }}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Kit pills list */}
        <div className="flex flex-wrap gap-3 justify-center">
          {kits.map((kit, i) => {
            const color = ITEM_COLORS[i % ITEM_COLORS.length];
            const loaded = loadedCount > i;

            return (
              <motion.div
                key={kit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all duration-500 ${
                  loaded
                    ? `${color.border} bg-zinc-900 ${color.glow} shadow-lg`
                    : 'border-white/5 bg-white/[0.02]'
                }`}
              >
                <AnimatePresence mode="wait">
                  {loaded ? (
                    <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}>
                      <CheckCircle2 className={`w-4 h-4 ${color.text}`} />
                    </motion.div>
                  ) : (
                    <motion.div key="pkg" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <Package className="w-4 h-4 text-zinc-600" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <span className={`text-xs font-bold uppercase tracking-tight transition-colors duration-500 ${loaded ? 'text-zinc-100' : 'text-zinc-600'}`}>
                  {kit}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Status line */}
        <motion.div className="text-center space-y-3">
          <AnimatePresence mode="wait">
            {phase === 'loading' && (
              <motion.p key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-zinc-500 text-sm font-medium">
                Loading {loadedCount} of {kits.length} kits into order…
              </motion.p>
            )}
            {phase === 'packed' && (
              <motion.div key="packed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
                <p className="text-emerald-400 font-bold text-sm uppercase tracking-widest">All kits loaded — dispatching…</p>
              </motion.div>
            )}
            {phase === 'launching' && (
              <motion.p key="launching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-zinc-500 text-sm font-medium">
                Order en route to pharmacy…
              </motion.p>
            )}
            {phase === 'done' && (
              <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}>
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                </motion.div>
                <p className="text-emerald-300 font-bold text-base">{kits.length} kit{kits.length > 1 ? 's' : ''} dispatched for {patientName}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress bar */}
          {phase === 'loading' && (
            <div className="w-64 mx-auto h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${(loadedCount / kits.length) * 100}%` }}
                transition={{ type: 'spring', stiffness: 80 }}
              />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
