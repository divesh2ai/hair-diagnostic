import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCartToken } from "@/lib/cartToken";
import { resolveApprovedOrder } from "@/lib/consultation/approvedOrder";
import { createPurchaseTransaction, listPurchaseTransactions } from "@/lib/commerce/transactionStore";
import { CheckoutError } from "@/lib/commerce/partialCheckout";
import { PurchaseNotProvisionedError } from "@/lib/commerce/purchaseStore";
import { PurchasingDisabledError, isPurchasingEnabled, PURCHASING_DISABLED_CODE } from "@/lib/commerce/purchasingGate";

export const dynamic = "force-dynamic";
type Context = {params:Promise<{assessmentId:string}>};
async function context(req:Request,ctx:Context) {
  const {assessmentId} = await ctx.params;
  const token = new URL(req.url).searchParams.get("t");
  if (!token || !verifyCartToken(token,assessmentId).ok) return null;
  const approved = await resolveApprovedOrder(prisma,assessmentId);
  if (!approved) return null;
  const assessment = await prisma.assessment.findUnique({where:{id:assessmentId},select:{clinicId:true}});
  return assessment ? {approved,clinicId:assessment.clinicId} : null;
}
const missing = () => NextResponse.json({error:"no_active_order"},{status:404});
function failure(err:unknown) {
  if (err instanceof CheckoutError) return NextResponse.json({error:err.code},{status:err.status});
  if (err instanceof PurchasingDisabledError) return NextResponse.json({error:err.code},{status:403});
  if (err instanceof PurchaseNotProvisionedError) return NextResponse.json({error:err.reason},{status:503});
  throw err;
}
export async function GET(req:Request,ctx:Context) {
  const c = await context(req,ctx);
  if (!c) return missing();
  try { return NextResponse.json({transactions:await listPurchaseTransactions(c.clinicId,c.approved.intentId)}); } catch(err) { return failure(err); }
}
export async function POST(req:Request,ctx:Context) {
  if (!isPurchasingEnabled()) return NextResponse.json({error:PURCHASING_DISABLED_CODE},{status:403});
  const c = await context(req,ctx);
  if (!c) return missing();
  const body = await req.json().catch(()=>({}));
  // Only a PENDING selection is reachable here. Payment is doctor-authenticated.
  try {
    const result = await createPurchaseTransaction({clinicId:c.clinicId,intentId:c.approved.intentId,
      clientTransactionId:body.clientTransactionId,selection:body.selection});
    return NextResponse.json(result,{status:result.created?201:200});
  } catch(err) { return failure(err); }
}
