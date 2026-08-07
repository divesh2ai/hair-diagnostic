import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getClinicContext, handleAuthError, isSuperAdmin } from '@/lib/auth';
const ALLOWED=new Set(['PENDING_REVIEW','IN_REVIEW','REVIEWED']);
export async function PATCH(req:Request,{params}:{params:Promise<{assessmentId:string}>}){
  let ctx;try{ctx=await getClinicContext()}catch(error){const response=handleAuthError(error);if(response)return response;throw error}
  const{assessmentId}=await params;const body=await req.json().catch(()=>({})) as Record<string,unknown>;const reviewStatus=typeof body.reviewStatus==='string'&&ALLOWED.has(body.reviewStatus)?body.reviewStatus:null;
  if(!reviewStatus)return NextResponse.json({error:'Invalid review status'},{status:400});
  const assessment=await prisma.assessment.findUnique({where:{id:assessmentId},select:{clinicId:true,rawResponses:true}});
  if(!assessment||(!isSuperAdmin(ctx.role)&&assessment.clinicId!==ctx.clinicId))return NextResponse.json({error:'Assessment not found'},{status:404});
  const raw=(assessment.rawResponses??{}) as Record<string,unknown>;const meta=(raw.__meta??{}) as Record<string,unknown>;if(meta.concern!=='skin_anti_ageing')return NextResponse.json({error:'Assessment not found'},{status:404});
  const antiAgeing=(raw.antiAgeing??{}) as Record<string,unknown>;const previous=String(antiAgeing.reviewStatus??'PENDING_REVIEW');const priorReview=(antiAgeing.doctorReview??{}) as Record<string,unknown>;
  const updated={...raw,__meta:{...meta,status:reviewStatus},antiAgeing:{...antiAgeing,reviewStatus,doctorReview:{...priorReview,doctorNote:typeof body.doctorNote==='string'?body.doctorNote.slice(0,5000):priorReview.doctorNote,updatedAt:new Date().toISOString()}}};
  await prisma.$transaction([prisma.assessment.update({where:{id:assessmentId},data:{rawResponses:updated as Prisma.InputJsonValue}}),prisma.assessmentEvent.create({data:{assessmentId,type:'ANTI_AGEING_REVIEW_STATUS_CHANGED',stage:'CLINICAL_REVIEW',message:`${previous} → ${reviewStatus}`,metadata:{previous,next:reviewStatus} as Prisma.InputJsonValue}})]);
  return NextResponse.json({success:true,reviewStatus});
}
