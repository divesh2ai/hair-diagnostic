"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Item { kitId:string; label:string; unitMinor:number|null; maxBoxes:number }
interface Transaction {
  id:string; status:"PENDING"|"PAID"|"REFUNDED"|"CANCELLED"; amountMinor:number;
  selection:{kitId:string;boxes:number}[]; createdAt:string; reference:string|null;
}
const money = (n:number) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(n/100);
const messages:Record<string,string> = {
  PURCHASING_DISABLED:"Purchasing is disabled. Your clinic can help with next steps.",
  purchase_not_provisioned:"Checkout is not enabled in this environment yet.",
  quantity_exceeds_outstanding:"The available quantity changed. Refresh the plan before selecting again.",
  pending_checkout_exists:"A selection is already awaiting clinic payment confirmation. Review it below.",
  reference_already_used:"That receipt reference is already recorded. Check the receipt before retrying.",
  legacy_payment_requires_reconciliation:"A previous whole-plan payment needs clinic reconciliation first.",
  plan_requires_review:"The plan has changed. Ask your doctor to review and approve it before purchasing.",
  kit_requires_review:"A selected kit was stopped or substituted. Ask your doctor to review it.",
  price_changed_restart_checkout:"The approved price changed. Cancel this selection and create a new one.",
};

export function PartialKitCheckout({endpoint,items:providedItems,doctor=false,quantitiesAreRemaining=false,onChanged}:{endpoint:string;items:Item[];doctor?:boolean;quantitiesAreRemaining?:boolean;onChanged?:()=>void}) {
  const [selected,setSelected] = useState<Record<string,number>>({});
  const [transactions,setTransactions] = useState<Transaction[]>([]);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [reference,setReference] = useState("");
  const [reason,setReason] = useState("");
  const key = useRef<string|null>(null);
  const inFlight = useRef(false);
  const load = useCallback(async()=>{
    try {
      const res = await fetch(endpoint,{cache:"no-store"});
      if (!res.ok) throw new Error(res.status===503?"Checkout is not enabled yet.":"Could not load purchase history. Refresh to try again.");
      const data = await res.json();
      setTransactions(data.transactions);
    } catch(err) { setError(err instanceof Error?err.message:"Could not load history."); }
    finally {setLoading(false);}
  },[endpoint]);
  useEffect(()=>{void load();},[load]);
  const pending = transactions.some(t=>t.status==="PENDING");
  const items=providedItems.map(item=>({...item,maxBoxes:quantitiesAreRemaining?item.maxBoxes:Math.max(0,item.maxBoxes-transactions.filter(t=>t.status==="PAID").reduce((sum,t)=>sum+t.selection.filter(l=>l.kitId===item.kitId).reduce((n,l)=>n+l.boxes,0),0))}));
  const amount = items.reduce((sum,i)=>sum+(selected[i.kitId]??0)*(i.unitMinor??0),0);
  async function request(method:string,body:unknown) {
    if (inFlight.current) return;
    inFlight.current=true; setBusy(true); setError(null);
    try {
      const res = await fetch(endpoint,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const data = await res.json();
      if (!res.ok) throw new Error(messages[data.error]??"Could not save. Check your selection and retry; your receipt will not be duplicated.");
      key.current=null;
      try {sessionStorage.removeItem(`checkout:${endpoint}`);} catch {}
      setSelected({}); setReference(""); setReason("");
      await load(); onChanged?.();
    } catch(err) {setError(err instanceof Error?err.message:"Connection lost. Retry the same selection.");}
    finally {inFlight.current=false;setBusy(false);}
  }
  function submit() {
    const selection=items.filter(i=>selected[i.kitId]>0).map(i=>({kitId:i.kitId,boxes:selected[i.kitId]}));
    const signature=JSON.stringify(selection);
    // Retain the identifier across a lost response or refresh. A deliberate
    // later purchase gets a new identifier, including identical same-day buys.
    try {
      const saved=JSON.parse(sessionStorage.getItem(`checkout:${endpoint}`)??"null");
      key.current=saved?.signature===signature?saved.id:crypto.randomUUID();
      sessionStorage.setItem(`checkout:${endpoint}`,JSON.stringify({signature,id:key.current}));
    } catch {key.current??=crypto.randomUUID();}
    void request("POST",{selection,clientTransactionId:key.current});
  }
  return <section className="space-y-4 border-t border-stone-200 pt-4" aria-label="Selected kit purchase">
    <div><h3 className="text-lg font-semibold text-slate-900">Choose kits for this purchase</h3>
      <p className="mt-1 text-sm text-slate-600">Select only the kits and boxes you want now. Unselected kits are not billed. Payment is confirmed by your clinic after collection.</p></div>
    {loading?<p role="status">Loading transactions…</p>:<>
      {!pending && <div className="space-y-3">{items.map(item=><div key={item.kitId} className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-base text-slate-800">
          <input type="checkbox" checked={!!selected[item.kitId]} disabled={busy||item.unitMinor==null||item.maxBoxes<1}
            onChange={e=>{key.current=null;setSelected(s=>({...s,[item.kitId]:e.target.checked?1:0}));}} className="size-5 shrink-0" />
          <span className="break-words">{item.label}<span className="block text-sm text-slate-600">{item.unitMinor==null?"Price awaiting review":`${money(item.unitMinor)} / box`} · {item.maxBoxes} available</span></span>
        </label>
        {!!selected[item.kitId]&&<label className="text-sm text-slate-700">Boxes<input aria-label={`Boxes for ${item.label}`} type="number" min={1} max={item.maxBoxes} value={selected[item.kitId]} disabled={busy}
          onChange={e=>{key.current=null;setSelected(s=>({...s,[item.kitId]:Number(e.target.value)}));}} className="ml-2 min-h-11 w-20 rounded-md border border-stone-300 px-2 text-base" /></label>}
      </div>)}
      <p className="text-lg font-semibold text-slate-900">Selected total: {money(amount)}</p>
      <button type="button" disabled={busy||amount<=0||items.some(i=>selected[i.kitId] && (!Number.isInteger(selected[i.kitId])||selected[i.kitId]<1||selected[i.kitId]>i.maxBoxes))}
        onClick={submit} className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-base text-white disabled:opacity-40">{busy?"Saving…":"Save selected kits for clinic payment"}</button>
      </div>}
      {transactions.length>0&&<div className="space-y-3"><h4 className="font-semibold text-slate-900">Purchase transactions</h4>
        {doctor&&<div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-700">Receipt / UPI reference<input value={reference} maxLength={128} onChange={e=>setReference(e.target.value)} className="mt-1 min-h-11 w-full rounded-md border px-3 text-base" /></label>
          <label className="text-sm text-slate-700">Reason for cancellation or refund<input value={reason} maxLength={2000} onChange={e=>setReason(e.target.value)} className="mt-1 min-h-11 w-full rounded-md border px-3 text-base" /></label>
        </div>}
        <ul className="divide-y divide-stone-200">{transactions.map(t=><li key={t.id} className="space-y-2 py-3 text-sm text-slate-700">
          <p><strong>{t.status}</strong> · {money(t.amountMinor)} · {new Date(t.createdAt).toLocaleDateString()}</p>
          <p className="break-all text-xs">Transaction {t.id}{t.reference?` · Receipt ${t.reference}`:""}</p>
          <ul>{t.selection.map(l=><li key={l.kitId}>{items.find(i=>i.kitId===l.kitId)?.label??l.kitId} · {l.boxes} box(es)</li>)}</ul>
          {doctor&&<div className="flex flex-wrap gap-2">
            {t.status==="PENDING"&&<><button type="button" disabled={busy||!reference.trim()} onClick={()=>void request("PATCH",{transactionId:t.id,action:"PAID",reference:reference.trim()})} className="min-h-11 rounded-md border border-stone-300 px-3 disabled:opacity-40">Confirm payment collected at clinic</button>
              <button type="button" disabled={busy||!reason.trim()} onClick={()=>void request("PATCH",{transactionId:t.id,action:"CANCELLED",reason})} className="min-h-11 rounded-md border px-3 disabled:opacity-40">Cancel selection</button></>}
            {t.status==="PAID"&&<button type="button" disabled={busy||!reason.trim()} onClick={()=>void request("PATCH",{transactionId:t.id,action:"REFUNDED",reason})} className="min-h-11 rounded-md border px-3 disabled:opacity-40">Record full refund already issued at clinic</button>}
          </div>}
        </li>)}</ul></div>}
    </>}
    {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
  </section>;
}
