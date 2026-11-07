import {authenticateAcademy,privateHeaders} from "@/lib/academy-server";
export async function GET(request:Request){
 const user=await authenticateAcademy(request);
 if(!user)return Response.json({error:"Sign in."},{status:401,headers:privateHeaders});
 const {data,error}=await user.client.from("academy_lesson_progress").select("lesson_id,position_seconds,completed_at,updated_at").eq("user_id",user.id).limit(1000);
 if(error)return Response.json({error:"Unable to load progress."},{status:503,headers:privateHeaders});
 return Response.json({progress:data??[]},{headers:privateHeaders});
}
export async function PUT(request:Request){
 const user=await authenticateAcademy(request);
 if(!user)return Response.json({error:"Sign in."},{status:401,headers:privateHeaders});
 let input:{lessonId?:unknown;positionSeconds?:unknown;complete?:unknown};
 try{input=await request.json()}catch{return Response.json({error:"Invalid input."},{status:400,headers:privateHeaders})}
 if(typeof input.lessonId!=="string"||!/^[a-f0-9-]{36}$/i.test(input.lessonId)||typeof input.positionSeconds!=="number"||!Number.isInteger(input.positionSeconds)||input.positionSeconds<0||input.positionSeconds>86400||typeof input.complete!=="boolean"){
  return Response.json({error:"Invalid progress."},{status:400,headers:privateHeaders});
 }
 const {data:lesson,error:lessonError}=await user.client.from("academy_lessons").select("id,module_id,lesson_type,academy_modules(course_id)").eq("id",input.lessonId).maybeSingle();
 if(lessonError||!lesson)return Response.json({error:"Lesson unavailable."},{status:404,headers:privateHeaders});
 if(lesson.lesson_type==="quiz")return Response.json({error:"Assessments require server-side grading."},{status:403,headers:privateHeaders});
 const moduleRow=lesson.academy_modules as unknown as {course_id:string}|null;
 if(!moduleRow)return Response.json({error:"Lesson unavailable."},{status:404,headers:privateHeaders});
 const {data:course}=await user.client.from("academy_courses").select("id,status").eq("id",moduleRow.course_id).maybeSingle();
 if(!course||course.status!=="published")return Response.json({error:"Course not published."},{status:403,headers:privateHeaders});
 const {data:enrollment}=await user.client.from("academy_enrollments").select("id").eq("course_id",course.id).eq("user_id",user.id).eq("status","active").maybeSingle();
 if(!enrollment&&!user.admin)return Response.json({error:"Enrollment required."},{status:403,headers:privateHeaders});
 const {data:previous}=await user.client.from("academy_lesson_progress").select("completed_at").eq("lesson_id",input.lessonId).eq("user_id",user.id).maybeSingle();
 const now=new Date().toISOString();
 const {error}=await user.client.from("academy_lesson_progress").upsert({user_id:user.id,lesson_id:input.lessonId,position_seconds:input.positionSeconds,completed_at:previous?.completed_at??(input.complete?now:null),updated_at:now},{onConflict:"user_id,lesson_id"});
 if(error)return Response.json({error:"Unable to save progress."},{status:503,headers:privateHeaders});
 return Response.json({saved:true},{headers:privateHeaders});
}
