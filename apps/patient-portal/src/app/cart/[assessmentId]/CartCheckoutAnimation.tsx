"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Package, CheckCircle2 } from "lucide-react";

// Checkout moment for the patient cart. Runs when the patient confirms:
// each kit slides into the cart (badge ticks up, cart dips), the cart
// rolls off to the right, and a confirmation settles in. Pure theatre —
// the order state was already flipped by the caller.

interface Props {
  itemNames: string[];
  onComplete: () => void;
}

type Phase = "loading" | "packed" | "leaving" | "done";

export default function CartCheckoutAnimation({ itemNames, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [loaded, setLoaded] = useState(0);
  const [dip, setDip] = useState(false);
  const [flying, setFlying] = useState<number | null>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    itemNames.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setFlying(i);
          timers.push(
            setTimeout(() => {
              setFlying(null);
              setLoaded(i + 1);
              setDip(true);
              timers.push(setTimeout(() => setDip(false), 300));
              if (i === itemNames.length - 1) {
                timers.push(setTimeout(() => setPhase("packed"), 700));
              }
            }, 500),
          );
        }, 350 + i * 750),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [itemNames]);

  useEffect(() => {
    if (phase === "packed") {
      const t = setTimeout(() => setPhase("leaving"), 900);
      return () => clearTimeout(t);
    }
    if (phase === "leaving") {
      const t = setTimeout(() => setPhase("done"), 800);
      return () => clearTimeout(t);
    }
    if (phase === "done") {
      const t = setTimeout(onComplete, 1400);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-50/95 backdrop-blur-sm px-6"
    >
      <div className="w-full max-w-sm text-center space-y-10">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-700">
            {phase === "done" ? "Order confirmed" : "Placing your order"}
          </p>
          <h2 className="font-serif text-2xl text-slate-900">
            {phase === "done"
              ? "On its way to your clinic"
              : phase === "leaving"
              ? "Sending to your clinic…"
              : "Packing your kits"}
          </h2>
        </div>

        {/* Stage: flying item + cart */}
        <div className="relative h-32 flex items-center justify-center overflow-hidden">
          <AnimatePresence>
            {flying !== null && (
              <motion.div
                key={`fly-${flying}`}
                initial={{ x: -150, opacity: 0, scale: 0.8 }}
                animate={{ x: 0, opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 0.4] }}
                transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                className="absolute left-1/2 -translate-x-1/2 -translate-y-10 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-4 py-2 shadow-sm"
              >
                <Package className="size-3.5 text-teal-700" />
                <span className="text-xs font-medium text-slate-800 max-w-[160px] truncate">
                  {itemNames[flying]}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {phase !== "done" ? (
              <motion.div
                key="cart"
                animate={
                  phase === "leaving"
                    ? { x: 260, rotate: 8, opacity: 0 }
                    : dip
                    ? { y: [0, 6, -3, 0], scale: [1, 0.97, 1.03, 1] }
                    : { x: 0, y: 0 }
                }
                exit={{ opacity: 0 }}
                transition={
                  phase === "leaving"
                    ? { duration: 0.7, ease: [0.55, 0, 1, 0.45] }
                    : { duration: 0.3 }
                }
                className="relative"
              >
                <div className="flex size-20 items-center justify-center rounded-2xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.2)]">
                  <ShoppingCart className="size-9 text-slate-700" strokeWidth={1.5} />
                </div>
                <AnimatePresence>
                  {loaded > 0 && (
                    <motion.span
                      key={loaded}
                      initial={{ scale: 0.4 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-teal-600 text-[11px] font-semibold text-white ring-2 ring-stone-50"
                    >
                      {loaded}
                    </motion.span>
                  )}
                </AnimatePresence>
                {/* road line */}
                <div className="absolute -bottom-3 left-1/2 h-px w-24 -translate-x-1/2 bg-stone-200" />
              </motion.div>
            ) : (
              <motion.div
                key="check"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
              >
                <CheckCircle2 className="size-16 text-teal-600" strokeWidth={1.5} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Item checklist */}
        <ul className="space-y-2 text-left">
          {itemNames.map((name, i) => {
            const isIn = loaded > i;
            return (
              <li
                key={`${name}-${i}`}
                className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 transition-colors duration-500 ${
                  isIn
                    ? "border-teal-200 bg-teal-50/70"
                    : "border-stone-200 bg-white"
                }`}
              >
                {isIn ? (
                  <CheckCircle2 className="size-4 shrink-0 text-teal-600" />
                ) : (
                  <Package className="size-4 shrink-0 text-stone-300" />
                )}
                <span
                  className={`truncate text-sm ${
                    isIn ? "text-teal-900 font-medium" : "text-stone-500"
                  }`}
                >
                  {name}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-stone-500">
          {phase === "done"
            ? "The clinic will reach out on WhatsApp shortly."
            : `${loaded} of ${itemNames.length} kits packed`}
        </p>
      </div>
    </motion.div>
  );
}
