import { NextResponse } from "next/server";
import { requireDoctorContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPurchaseTransaction, listPurchaseTransactions, transitionPurchaseTransaction } from "@/lib/commerce/transactionStore";
import { CheckoutError } from "@/lib/commerce/partialCheckout";
import { PurchaseNotProvisionedError } from "@/lib/commerce/purchaseStore";
import { PurchasingDisabledError } from "@/lib/commerce/purchasingGate";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{intentId:string}> };
function failure(err:unknown) {
  if (err instanceof CheckoutError) return NextResponse.json({error:err.code},{status:err.status});
  if (err instanceof PurchasingDisabledError) return NextResponse.json({error:err.code},{status:403});
  if (err instanceof PurchaseNotProvisionedError) return NextResponse.json({error:err.reason},{status:503});
  throw err;
}
export async function GET(_req:Request,ctx:Context) {
  const auth = await requireDoctorContext();
  if (auth instanceof NextResponse) return auth;
  const {intentId} = await ctx.params;
  const order = await prisma.kitOrderIntent.findFirst({where:{id:intentId,clinicId:auth.doctor.clinicId},select:{id:true}});
  if (!order) return NextResponse.json({error:"not_found"},{status:404});
  try { return NextResponse.json({transactions:await listPurchaseTransactions(auth.doctor.clinicId,intentId)}); } catch(err) { return failure(err); }
}
export async function POST(req:Request,ctx:Context) {
  const auth = await requireDoctorContext();
  if (auth instanceof NextResponse) return auth;
  const {intentId} = await ctx.params;
  const body = await req.json().catch(()=>({}));
  try {
    const result = await createPurchaseTransaction({clinicId:auth.doctor.clinicId,intentId,clientTransactionId:body.clientTransactionId,selection:body.selection});
    return NextResponse.json(result,{status:result.created?201:200});
  } catch(err) { return failure(err); }
}
export async function PATCH(req:Request,ctx:Context) {
  const auth = await requireDoctorContext();
  if (auth instanceof NextResponse) return auth;
  const {intentId} = await ctx.params;
  const body = await req.json().catch(()=>({}));
  if (typeof body.transactionId !== "string" || !["PAID","REFUNDED","CANCELLED"].includes(body.action)
    || (body.reference != null && typeof body.reference !== "string") || (body.reason != null && typeof body.reason !== "string")) {
    return NextResponse.json({error:"invalid_transaction_action"},{status:400});
  }
  try {
    return NextResponse.json(await transitionPurchaseTransaction({clinicId:auth.doctor.clinicId,intentId,doctorId:auth.doctor.id,
      transactionId:body.transactionId,action:body.action,reference:body.reference,reason:body.reason}));
  } catch(err) { return failure(err); }
}
