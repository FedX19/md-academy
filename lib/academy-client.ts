"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | null = null;
export function browserAcademyClient(): SupabaseClient | null {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return null;
 if(!client)client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 return client;
}
export async function academyHeaders(){
 const client=browserAcademyClient();
 const {data}=client?await client.auth.getSession():{data:{session:null}};
 const headers:Record<string,string>={};
 if(data.session?.access_token)headers.Authorization="Bearer "+data.session.access_token;
 return headers;
}
export async function academyRequest<T>(path:string,init?:RequestInit):Promise<T>{
 const headers=new Headers(await academyHeaders());
 new Headers(init?.headers).forEach((v,k)=>headers.set(k,v));
 if(init?.body&&!headers.has("content-type"))headers.set("content-type","application/json");
 const res=await fetch(path,{...init,headers,cache:"no-store"});
 const body=await res.json().catch(()=>({})) as {error?:string};
 if(!res.ok)throw Error(body.error??"Request failed");
 return body as T;
}
