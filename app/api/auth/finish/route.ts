import {NextRequest,NextResponse} from "next/server";
const pkce=/^[a-zA-Z0-9_-]{43}$/;
function respond(body:object,status:number){
 const result=NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
 for(const name of ["mdacademy_state","mdacademy_verifier"])result.cookies.set(name,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/api/auth",maxAge:0});
 return result;
}
export async function POST(req:NextRequest){
 let data:{code?:string;state?:string};try{data=await req.json()}catch{return respond({error:"invalid_request"},400)}
 const state=req.cookies.get("mdacademy_state")?.value??"";
 const verifier=req.cookies.get("mdacademy_verifier")?.value??"";
 if(!pkce.test(data.code??"")||!pkce.test(data.state??"")||data.state!==state||!pkce.test(verifier))return respond({error:"invalid_or_expired_state"},401);
 try{
  const response=await fetch("https://app.unite-hq.com/api/academy/sso/exchange",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code:data.code,verifier}),cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!response.ok)return respond({error:"sign_in_unavailable"},response.status===401?401:502);
  const body=await response.json() as {tokenHash?:string};
  if(!body.tokenHash)return respond({error:"sign_in_failed"},502);
  return respond({tokenHash:body.tokenHash},200);
 }catch{return respond({error:"sign_in_unavailable"},502)}
}
