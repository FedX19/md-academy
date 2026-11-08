import {authenticateAcademy,privateHeaders} from "@/lib/academy-server";
export async function POST(request:Request){
 const user=await authenticateAcademy(request);
 if(!user)return Response.json({error:"Sign in."},{status:401,headers:privateHeaders});
 let input:{lessonId?:unknown};
 try{input=await request.json()}catch{return Response.json({error:"Invalid input."},{status:400,headers:privateHeaders})}
 if(typeof input.lessonId!=="string"||!/^[a-f0-9-]{36}$/i.test(input.lessonId))return Response.json({error:"Invalid lesson."},{status:400,headers:privateHeaders});
 const {data:lesson,error}=await user.client.from("academy_lessons").select("id,lesson_type,media_asset_id,academy_modules(course_id)").eq("id",input.lessonId).maybeSingle();
 if(error||!lesson||lesson.lesson_type!=="video"||!lesson.media_asset_id)return Response.json({error:"Video unavailable."},{status:404,headers:privateHeaders});
 const moduleRow=lesson.academy_modules as unknown as {course_id:string}|null;
 if(!moduleRow)return Response.json({error:"Video unavailable."},{status:404,headers:privateHeaders});
 const {data:course}=await user.client.from("academy_courses").select("id,status").eq("id",moduleRow.course_id).maybeSingle();
 if(!course)return Response.json({error:"Course unavailable."},{status:403,headers:privateHeaders});
 if(course.status!=="published")return Response.json({
  error:user.author
    ?"Draft lessons must be opened through Preview as League Coach. No publication is required."
    :"Course unavailable."
 },{status:403,headers:privateHeaders});
 const {data:enrollment}=await user.client.from("academy_enrollments").select("id").eq("course_id",moduleRow.course_id).eq("user_id",user.id).eq("status","active").maybeSingle();
 if(!user.admin&&!enrollment)return Response.json({error:"Enrollment required."},{status:403,headers:privateHeaders});
 const {data:asset}=await user.client.from("academy_media_assets").select("storage_path").eq("id",lesson.media_asset_id).maybeSingle();
 if(!asset)return Response.json({error:"Video asset unavailable."},{status:404,headers:privateHeaders});
 const {data:link,error:signError}=await user.client.storage.from("md-academy-private").createSignedUrl(asset.storage_path,1800);
 if(signError||!link?.signedUrl)return Response.json({error:"Video could not be loaded."},{status:503,headers:privateHeaders});
 return Response.json({url:link.signedUrl,expiresInSeconds:1800},{headers:privateHeaders});
}
