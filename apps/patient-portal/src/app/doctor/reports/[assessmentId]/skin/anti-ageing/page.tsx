import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { getClinicContext, isSuperAdmin } from '@/lib/auth';
import { AntiAgeingDoctorReview } from '@/components/skin-fact/AntiAgeingDoctorReview';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{assessmentId:string}>}){
  const{assessmentId}=await params;const ctx=await getClinicContext();const assessment=await prisma.assessment.findUnique({where:{id:assessmentId},select:{id:true,clinicId:true,submittedAt:true,rawResponses:true,patient:{select:{name:true,age:true,gender:true}}}});
  if(!assessment||(!isSuperAdmin(ctx.role)&&assessment.clinicId!==ctx.clinicId))notFound();
  const raw=(assessment.rawResponses??{}) as Record<string,unknown>;const meta=(raw.__meta??{}) as Record<string,unknown>;if(meta.concern!=='skin_anti_ageing')notFound();
  const common=(raw.commonInitial??{}) as Record<string,unknown>;const antiAgeing=(raw.antiAgeing??{}) as Record<string,unknown>;
  const imageRefs=antiAgeing.AA_10&&typeof antiAgeing.AA_10==='object'?Object.values(antiAgeing.AA_10 as Record<string,Record<string,unknown>>):[];
  const documentRefs=Array.isArray(antiAgeing.AA_09)?antiAgeing.AA_09 as Record<string,unknown>[]:[];
  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;const client=supabaseUrl&&serviceKey?createClient(supabaseUrl,serviceKey):null;
  async function sign(ref:Record<string,unknown>){if(!client||typeof ref.path!=='string')return null;const signed=await client.storage.from('clinical-images').createSignedUrl(ref.path,3600);return signed.data?.signedUrl?{view:String(ref.view??'DOCUMENT'),url:signed.data.signedUrl,uploadedAt:String(ref.uploadedAt??new Date().toISOString()),fileName:String(ref.fileName??'upload')}:null}
  const images=(await Promise.all(imageRefs.map(sign))).filter((value):value is NonNullable<typeof value>=>!!value);const documents=(await Promise.all(documentRefs.map(sign))).filter((value):value is NonNullable<typeof value>=>!!value);
  const doctorReview=(antiAgeing.doctorReview??{}) as Record<string,unknown>;
  return <AntiAgeingDoctorReview initial={{assessmentId:assessment.id,patient:assessment.patient,submittedAt:assessment.submittedAt?.toISOString()??null,common,antiAgeing,images,documents,reviewStatus:String(antiAgeing.reviewStatus??'PENDING_REVIEW'),doctorNote:String(doctorReview.doctorNote??'')}}/>;
}
