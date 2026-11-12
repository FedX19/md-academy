import {authenticateAcademy,privateHeaders} from "@/lib/academy-server";
export async function GET(request:Request){
 const user=await authenticateAcademy(request);
 if(!user)return Response.json({error:"Sign in through UniteHQ."},{status:401,headers:privateHeaders});
 const [enrollments,membership]=await Promise.all([
  user.client.from("academy_enrollments").select("id").eq("user_id",user.id).eq("status","active").limit(1),
  user.client.from("profile_memberships").select("profile_id").eq("profile_id",user.id).eq("plan","mdc_individual").eq("status","active").limit(1),
 ]);
 const rows=enrollments.data; const error=enrollments.error??membership.error;
 const isIndividualMember=(membership.data?.length??0)>0;
 if(error)return Response.json({error:"Unable to verify Academy access."},{status:503,headers:privateHeaders});
 if(!user.admin&&!isIndividualMember&&(rows?.length??0)===0)return Response.json({error:"An Academy enrollment is required."},{status:403,headers:privateHeaders});
 return Response.json({user:{id:user.id,name:user.name,email:user.email,admin:user.admin,author:user.author,publisher:user.publisher}},{headers:privateHeaders});
}
