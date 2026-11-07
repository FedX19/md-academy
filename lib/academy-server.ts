import "server-only";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";
type Identity={id:string;name:string;email:string|null;admin:boolean;client:SupabaseClient};
export function getPublicConfig(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key) return null;
 return {url,key};
}
export async function authenticateAcademy(request:Request):Promise<Identity|null>{
 const token=request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
 const config=getPublicConfig();
 if(!token||!config)return null;
 const client=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:"Bearer "+token}}});
 const {data,error}=await client.auth.getUser(token);
 if(error||!data.user||data.user.is_anonymous)return null;
 const uid=data.user.id;
 const [roles,profile]=await Promise.all([
  client.from("academy_admin_roles").select("role").eq("user_id",uid).maybeSingle(),
  client.from("profiles").select("org_role,is_platform_admin,full_name").eq("id",uid).maybeSingle()
 ]);
 // Fail closed when the role database cannot be checked.
 if(roles.error||profile.error)return null;
 const admin=roles.data?.role==="admin"||roles.data?.role==="editor"||
   profile.data?.org_role==="platform_admin"||profile.data?.is_platform_admin===true;
 return {id:uid,email:data.user.email??null,name:profile.data?.full_name??data.user.email??"Coach",admin,client};
}
export async function hasCourseAccess(user:Identity,courseId:string){
 if(user.admin)return true;
 const {data,error}=await user.client.from("academy_enrollments").select("id").eq("course_id",courseId).eq("user_id",user.id).eq("status","active").maybeSingle();
 return !error&&!!data;
}
export const privateHeaders={"Cache-Control":"private, no-store",Vary:"Authorization"};
