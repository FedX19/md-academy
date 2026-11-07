import {authenticateAcademy,privateHeaders} from "@/lib/academy-server";
export async function GET(request:Request){
 const user=await authenticateAcademy(request);
 if(!user)return Response.json({error:"Sign in."},{status:401,headers:privateHeaders});
 const {data,error}=await user.client.from("academy_courses").select("id,slug,title,summary,audience,status,academy_modules(id,title,sort_order,academy_lessons(id,title,summary,lesson_type,duration_seconds,sort_order)))").order("created_at",{ascending:false}).limit(60);
 if(error)return Response.json({error:"Unable to load courses."},{status:503,headers:privateHeaders});
 return Response.json({courses:data??[]},{headers:privateHeaders});
}
