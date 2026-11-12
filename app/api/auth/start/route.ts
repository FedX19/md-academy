import {createHash,randomBytes} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
const path="/api/auth";
export async function GET(request:NextRequest){
 const origin=process.env.ACADEMY_ORIGIN ?? "https://mdc-academy.app";
 if(!origin)return Response.json({error:"Academy domain is not configured."},{status:503});
 if(request.nextUrl.origin!==origin)return NextResponse.redirect(new URL("/api/auth/start",origin));
 const state=randomBytes(32).toString("base64url");
 const verifier=randomBytes(32).toString("base64url");
 const challenge=createHash("sha256").update(verifier).digest("base64url");
 const target=new URL("/api/academy/sso/start","https://app.unite-hq.com");
 target.searchParams.set("state",state);target.searchParams.set("challenge",challenge);
 const res=NextResponse.redirect(target);
 for(const [key,value] of [["mdacademy_state",state],["mdacademy_verifier",verifier]]){
  res.cookies.set(key,value,{httpOnly:true,secure:true,sameSite:"lax",path,maxAge:180});
 }
 res.headers.set("Cache-Control","no-store");res.headers.set("Referrer-Policy","no-referrer");
 return res;
}
