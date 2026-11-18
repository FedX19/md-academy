import {authenticateAcademy,privateHeaders} from "@/lib/academy-server";
// Academy classroom entry trusts the verified UniteHQ coach assignment,
// never an unverified email, editable profile flag, or a purchased membership.
async function hasVerifiedMdcCoachAppAccess(request:Request):Promise<boolean>{
 const token=request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
 if(!token)return false;
 try{
  const response=await fetch("https://app.unite-hq.com/api/me/entitlements",{
   headers:{Authorization:"Bearer "+token,Accept:"application/json"},
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(5000),
  });
  if(!response.ok)return false;
  const payload:unknown=await response.json();
  return Boolean(payload&&typeof payload==="object"&&
   "coachApps" in payload&&(payload as {coachApps?:unknown}).coachApps===true);
 }catch{return false;}
}
export async function GET(request:Request){
 const user=await authenticateAcademy(request);
 if(!user)return Response.json({error:"Sign in through UniteHQ."},{status:401,headers:privateHeaders});
 const [enrollments,membership,coachApps]=await Promise.all([
  user.client.from("academy_enrollments").select("id").eq("user_id",user.id).eq("status","active").limit(1),
  user.client.from("profile_memberships").select("profile_id").eq("profile_id",user.id).eq("plan","mdc_individual").eq("status","active").limit(1),
  hasVerifiedMdcCoachAppAccess(request),
 ]);
 const rows=enrollments.data; const error=enrollments.error??membership.error;
 const isIndividualMember=(membership.data?.length??0)>0;
 if(error)return Response.json({error:"Unable to verify Academy access."},{status:503,headers:privateHeaders});
 if(!user.admin&&!isIndividualMember&&!coachApps&&(rows?.length??0)===0)return Response.json({error:"An Academy enrollment is required."},{status:403,headers:privateHeaders});
 return Response.json({user:{id:user.id,name:user.name,email:user.email,admin:user.admin,author:user.author,publisher:user.publisher}},{headers:privateHeaders});
}
