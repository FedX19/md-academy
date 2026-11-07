import {authenticateAcademy,privateHeaders} from "@/lib/academy-server";
export async function GET(request:Request){
 const user=await authenticateAcademy(request);
 if(!user)return Response.json({error:"Sign in through UniteHQ."},{status:401,headers:privateHeaders});
 const {data:rows,error}=await user.client.from("academy_enrollments").select("id").eq("user_id",user.id).eq("status","active").limit(1);
 if(error)return Response.json({error:"Unable to verify Academy access."},{status:503,headers:privateHeaders});
 if(!user.admin&&rows.length===0)return Response.json({error:"An Academy enrollment is required."},{status:403,headers:privateHeaders});
 return Response.json({user:{id:user.id,name:user.name,email:user.email,admin:user.admin}},{headers:privateHeaders});
}
