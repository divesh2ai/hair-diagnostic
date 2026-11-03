import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { Prisma } from "@prisma/client";
import { priceSelection, sameSelection } from "@/lib/commerce/partialCheckout";
import { deriveLineState } from "@/lib/commerce/kitPurchaseModel";

// The real stores run unchanged against a disposable PostgreSQL WASM engine.
// Only the Prisma transport is adapted; no database result or pricing is mocked.
const transport = vi.hoisted(()=>({client:null as any}));
vi.mock("@/lib/prisma",()=>({prisma:new Proxy({}, {get:(_,k)=>transport.client[k]})}));
import { createPurchaseTransaction, transitionPurchaseTransaction, listPurchaseTransactions } from "@/lib/commerce/transactionStore";
import { appendPurchaseEvent, listEventsByIntent, listLinesByIntent } from "@/lib/commerce/purchaseStore";
import { createNote, listNotesForPatient } from "@/lib/notes/noteStore";

let pg:PGlite;
const kits=["TE_GOLD","IRON_UP_GOLD","GI_GOLD","PRO_IMMUNE_GOLD"];
const selection=kits.slice(0,2).map(kitId=>({kitId,boxes:1}));
function bridge(db:any):any {
  const raw = async (arg:any,...values:any[]) => {
    const sql=Array.isArray(arg)?Prisma.sql(arg as unknown as TemplateStringsArray,...values):arg;
    return (await db.query(sql.text,sql.values.map((v:any)=>v instanceof Date?v.toISOString():v))).rows;
  };
  return {$queryRaw:raw,$executeRaw:async(a:any,...v:any[])=>{await raw(a,...v);return 1;},
    $transaction:async(fn:any)=>db.transaction((tx:any)=>fn(bridge(tx)))};
}
const checkout=(key=crypto.randomUUID(),items=selection)=>createPurchaseTransaction({clinicId:"clinic-a",intentId:"order-a",clientTransactionId:key,selection:items});
const action=(id:string,kind:"PAID"|"REFUNDED"|"CANCELLED",extra={})=>transitionPurchaseTransaction({clinicId:"clinic-a",intentId:"order-a",transactionId:id,doctorId:"doctor-a",action:kind,...extra});

beforeAll(async()=>{
  pg=await PGlite.create({parsers:{1114:(s:string)=>new Date(s+"Z")}});
  transport.client=bridge(pg);
  await pg.exec(`
    CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE FUNCTION jwt_user_role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claims',true)::jsonb->>'user_role' $$;
    CREATE FUNCTION jwt_is_super_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT jwt_user_role()='SUPER_ADMIN' $$;
    CREATE FUNCTION jwt_is_clinic_member(id text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claims',true)::jsonb->>'clinic_id'=id $$;
    CREATE TABLE "Clinic"(id text PRIMARY KEY);
    CREATE TABLE "Doctor"(id text PRIMARY KEY,"clinicId" text REFERENCES "Clinic");
    CREATE TABLE "Patient"(id text PRIMARY KEY,"clinicId" text REFERENCES "Clinic");
    CREATE TABLE "Assessment"(id text PRIMARY KEY,"clinicId" text REFERENCES "Clinic","patientId" text REFERENCES "Patient");
    CREATE TABLE "Consultation"(id text PRIMARY KEY,"clinicId" text,"patientId" text,"currentVersionId" text);
    CREATE TABLE "ConsultationVersion"(id text PRIMARY KEY,"approvalStatus" text);
    CREATE TABLE "KitOrderIntent"(id text PRIMARY KEY,"clinicId" text,"assessmentId" text,"consultationId" text,"consultationVersionId" text,"kitIds" text[],quantities jsonb,status text);
    CREATE TABLE "KitOrderPayment"(id text PRIMARY KEY,"kitOrderIntentId" text,status text);
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
  `);
  await pg.exec(readFileSync("prisma/migrations/20261023_doctor_notes_and_partial_kit/migration.sql","utf8"));
  await pg.exec(readFileSync("prisma/migrations/20261030_partial_checkout_transactions/migration.sql","utf8"));
},30000);
afterAll(async()=>{await pg?.close();});
beforeEach(async()=>{
  process.env.PURCHASING_ENABLED="true";
  await pg.exec(`TRUNCATE "KitPurchaseEvent","KitPurchaseLine","KitPurchaseTransaction","ConsultationNote","KitOrderPayment","KitOrderIntent","Assessment","Consultation","ConsultationVersion","Doctor","Patient","Clinic" CASCADE;
    INSERT INTO "Clinic" VALUES ('clinic-a'),('clinic-b');
    INSERT INTO "Doctor" VALUES ('doctor-a','clinic-a'),('doctor-b','clinic-b');
    INSERT INTO "Patient" VALUES ('patient-a','clinic-a'),('patient-b','clinic-b');
    INSERT INTO "Assessment" VALUES ('assessment-a','clinic-a','patient-a');
    INSERT INTO "Consultation" VALUES ('consultation-a','clinic-a','patient-a','version-a');
    INSERT INTO "ConsultationVersion" VALUES ('version-a','APPROVED');
    INSERT INTO "KitOrderIntent" VALUES ('order-a','clinic-a','assessment-a','consultation-a','version-a',ARRAY['TE_GOLD','IRON_UP_GOLD','GI_GOLD','PRO_IMMUNE_GOLD'],'{"TE_GOLD":2,"IRON_UP_GOLD":2,"GI_GOLD":2,"PRO_IMMUNE_GOLD":2}','READY_FOR_FULFILMENT');`);
});

describe("Release 2 PostgreSQL persistence",()=>{
  it("4 recommended / 2 selected: bills only selected boxes; pending is not purchased",async()=>{
    const {transaction}=await checkout();
    expect(transaction.status).toBe("PENDING");
    expect(transaction.selection).toHaveLength(2);
    expect(transaction.amountMinor).toBe(priceSelection(kits,selection).amountMinor);
    expect(await listEventsByIntent("clinic-a","order-a")).toHaveLength(0);
    expect(await listPurchaseTransactions("clinic-a","order-a")).toHaveLength(1);
    await action(transaction.id,"PAID",{reference:"receipt-1"});
    const lines=await listLinesByIntent("clinic-a","order-a");
    const events=await listEventsByIntent("clinic-a","order-a");
    expect(lines).toHaveLength(2);
    expect(events.filter(e=>e.eventType==="PURCHASE_CONFIRMED_BY_CLINIC")).toHaveLength(2);
    expect(events.filter(e=>e.eventType==="PAYMENT_RECORDED")).toHaveLength(2);
    expect(events.every(e=>e.transactionId===transaction.id)).toBe(true);
    expect(events.some(e=>e.eventType==="DISPENSED")).toBe(false);
  });
  it("retry creates no duplicates; same-day identical genuine purchases get distinct IDs",async()=>{
    const key=crypto.randomUUID();
    const first=await checkout(key);
    expect((await checkout(key)).created).toBe(false);
    await expect(checkout(key,[{kitId:kits[0],boxes:2}])).rejects.toMatchObject({code:"idempotency_conflict"});
    await action(first.transaction.id,"PAID",{reference:"receipt-1"});
    expect((await action(first.transaction.id,"PAID",{reference:"receipt-1"})).created).toBe(false);
    const second=await checkout();
    expect(second.transaction.id).not.toBe(first.transaction.id);
    await action(second.transaction.id,"PAID",{reference:"receipt-2"});
    expect((await listEventsByIntent("clinic-a","order-a")).filter(e=>e.eventType==="PURCHASE_CONFIRMED_BY_CLINIC")).toHaveLength(4);
    await expect(checkout()).rejects.toMatchObject({code:"quantity_exceeds_outstanding"});
  });
  it("refunds once, leaves dispensing independent, and allows a later purchase",async()=>{
    const {transaction}=await checkout();
    await action(transaction.id,"PAID",{reference:"receipt-1"});
    await action(transaction.id,"REFUNDED",{reason:"Clinic issued full refund"});
    expect((await action(transaction.id,"REFUNDED",{reason:"Clinic issued full refund"})).created).toBe(false);
    const events=await listEventsByIntent("clinic-a","order-a");
    const line=(await listLinesByIntent("clinic-a","order-a"))[0];
    expect(deriveLineState(2,"RECOMMENDED",events.filter(e=>e.kitPurchaseLineId===line.id)).purchasedBoxes).toBe(0);
    expect((await checkout()).transaction.status).toBe("PENDING");
  });
  it("separates external supply, treatment-start and typed notes; recalls across visits",async()=>{
    const {transaction}=await checkout();
    await action(transaction.id,"PAID",{reference:"receipt-1"});
    const [line]=await listLinesByIntent("clinic-a","order-a");
    for (const eventType of ["EXTERNALLY_OBTAINED","TREATMENT_STARTED"] as const) await appendPurchaseEvent({clinicId:"clinic-a",kitOrderIntentId:"order-a",kitPurchaseLineId:line.id,
      eventType,boxes:eventType==="EXTERNALLY_OBTAINED"?1:null,occurredAt:new Date("2026-10-29"),recordedByDoctorId:"doctor-a",clientEventId:crypto.randomUUID()});
    const events=await listEventsByIntent("clinic-a","order-a");
    const state=deriveLineState(2,"RECOMMENDED",events.filter(e=>e.kitPurchaseLineId===line.id));
    expect(state.externallyObtainedBoxes).toBe(1); expect(state.purchasedBoxes).toBe(1); expect(state.treatmentStartedAt).toContain("2026-10-29");
    await createNote({clinicId:"clinic-a",patientId:"patient-a",assessmentId:"assessment-a",authorDoctorId:"doctor-a",authorName:"Synthetic Doctor",body:"Follow up on remaining two kits",inputMode:"TYPED",language:"en-IN"});
    expect((await listNotesForPatient("clinic-a","patient-a"))[0].body).toBe("Follow up on remaining two kits");
    expect(await listNotesForPatient("clinic-b","patient-a")).toHaveLength(0);
  });
  it("retains dated reasons for discontinue and continue; retry cannot restore an old control state",async()=>{
    const {transaction}=await checkout(); await action(transaction.id,"PAID",{reference:"r1"});
    const [line]=await listLinesByIntent("clinic-a","order-a");
    const input={clinicId:"clinic-a",kitOrderIntentId:"order-a",kitPurchaseLineId:line.id,recordedByDoctorId:"doctor-a",occurredAt:new Date(),note:"Follow-up review"};
    const stopKey=crypto.randomUUID();
    await appendPurchaseEvent({...input,eventType:"DISCONTINUED",clientEventId:stopKey});
    await appendPurchaseEvent({...input,eventType:"CONTINUED",clientEventId:crypto.randomUUID()});
    await appendPurchaseEvent({...input,eventType:"DISCONTINUED",clientEventId:stopKey});
    expect((await listLinesByIntent("clinic-a","order-a"))[0].lineStatus).toBe("RECOMMENDED");
    expect((await listEventsByIntent("clinic-a","order-a")).filter(e=>e.note==="Follow-up review")).toHaveLength(2);
  });
  it("rejects cross-clinic store access and association forgery",async()=>{
    await expect(createPurchaseTransaction({clinicId:"clinic-b",intentId:"order-a",clientTransactionId:crypto.randomUUID(),selection})).rejects.toMatchObject({status:404});
    const {transaction}=await checkout();
    await expect(transitionPurchaseTransaction({clinicId:"clinic-b",intentId:"order-a",transactionId:transaction.id,doctorId:"doctor-b",action:"PAID",reference:"x"})).rejects.toMatchObject({status:404});
    await expect(pg.query(`INSERT INTO "KitPurchaseTransaction" (id,"kitOrderIntentId","clinicId","assessmentId","clientTransactionId",selection,"amountMinor") VALUES ('forged','order-a','clinic-b','assessment-a','forged-key','[{"kitId":"TE_GOLD","boxes":1}]',1)`)).rejects.toThrow("transaction_association");
  });
  it("RLS hides Clinic A transactions from Clinic B JWT and refuses browser financial writes",async()=>{
    await checkout();
    await pg.transaction(async tx=>{
      await tx.exec(`SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims='{"user_role":"DOCTOR","clinic_id":"clinic-b"}';`);
      expect((await tx.query(`SELECT * FROM "KitPurchaseTransaction"`)).rows).toHaveLength(0);
    });
    await expect(pg.transaction(async tx=>{
      await tx.exec(`SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims='{"user_role":"DOCTOR","clinic_id":"clinic-a"}';`);
      await tx.query(`UPDATE "KitPurchaseTransaction" SET status='PAID'`);
    })).rejects.toThrow(/permission denied/);
  });
  it("cancellation, invalid input, unapproved plans and purchasing gate fail closed",async()=>{
    expect(sameSelection(selection,[null])).toBe(false);
    expect(()=>priceSelection(kits,[{kitId:"not-approved",boxes:1}])).toThrow();
    expect(()=>priceSelection(kits,[{kitId:kits[0],boxes:0}])).toThrow();
    const {transaction}=await checkout();
    await action(transaction.id,"CANCELLED",{reason:"Patient deferred"});
    await expect(action(transaction.id,"PAID",{reference:"r1"})).rejects.toMatchObject({code:"invalid_payment_transition"});
    await pg.exec(`UPDATE "ConsultationVersion" SET "approvalStatus"='REVISION_REQUESTED'`);
    await expect(checkout()).rejects.toMatchObject({code:"plan_requires_review"});
    process.env.PURCHASING_ENABLED="false";
    await expect(checkout()).rejects.toMatchObject({code:"PURCHASING_DISABLED"});
  });
  it("rolls back purchase events and payment status if attribution fails",async()=>{
    const {transaction}=await checkout();
    await expect(transitionPurchaseTransaction({clinicId:"clinic-a",intentId:"order-a",transactionId:transaction.id,doctorId:"doctor-b",action:"PAID",reference:"bad-doctor"})).rejects.toThrow();
    expect((await listPurchaseTransactions("clinic-a","order-a"))[0].status).toBe("PENDING");
    expect(await listEventsByIntent("clinic-a","order-a")).toHaveLength(0);
  });
  it("a receipt collision rolls back the entire second purchase",async()=>{
    const first=await checkout(); await action(first.transaction.id,"PAID",{reference:"same-receipt"});
    const second=await checkout();
    await expect(action(second.transaction.id,"PAID",{reference:"same-receipt"})).rejects.toThrow();
    expect((await listPurchaseTransactions("clinic-a","order-a")).find(t=>t.id===second.transaction.id)?.status).toBe("PENDING");
    expect((await listEventsByIntent("clinic-a","order-a")).filter(e=>e.eventType==="PURCHASE_CONFIRMED_BY_CLINIC")).toHaveLength(2);
  });
  it("unselected recommendations remain deferred with no financial events",async()=>{
    await pg.query(`INSERT INTO "KitPurchaseLine" (id,"kitOrderIntentId","clinicId","assessmentId","patientId","kitId","kitLabel","recommendedBoxes","updatedAt") VALUES ('deferred','order-a','clinic-a','assessment-a','patient-a','GI_GOLD','GI Gold',2,NOW())`);
    await appendPurchaseEvent({clinicId:"clinic-a",kitOrderIntentId:"order-a",kitPurchaseLineId:"deferred",recordedByDoctorId:"doctor-a",occurredAt:new Date(),eventType:"DEFERRED",note:"Patient wants this at a later visit",clientEventId:crypto.randomUUID()});
    const {transaction}=await checkout(); await action(transaction.id,"PAID",{reference:"two-kits-only"});
    expect((await listLinesByIntent("clinic-a","order-a")).find(l=>l.id==="deferred")?.lineStatus).toBe("DEFERRED");
    expect((await listEventsByIntent("clinic-a","order-a")).filter(e=>e.kitPurchaseLineId==="deferred").map(e=>e.eventType)).toEqual(["DEFERRED"]);
  });
});
