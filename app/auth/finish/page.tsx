"use client";
import {useEffect,useRef,useState,Suspense} from "react";
import {useSearchParams} from "next/navigation";
import {AuthTransitionScreen} from "@/components/brand/auth-transition-screen";
import {academyRequest,browserAcademyClient} from "@/lib/academy-client";
function Finish(){
 const params=useSearchParams();const once=useRef(false);
 const [error,setError]=useState<string|null>(null);
 const code=params.get("code");const state=params.get("state");
 useEffect(()=>{if(once.current)return;once.current=true;
  (async()=>{
   try{
    if(!code||!state)throw Error("Sign-in link is incomplete.");
    const res=await fetch("/api/auth/finish",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code,state}),cache:"no-store"});
    if(!res.ok)throw Error("UniteHQ sign-in expired or was declined.");
    const {tokenHash}=await res.json() as {tokenHash?:string};
    const client=browserAcademyClient();
    if(!client||!tokenHash)throw Error("Academy sign-in is not configured.");
    const verified=await client.auth.verifyOtp({token_hash:tokenHash,type:"magiclink"});
    if(verified.error||!verified.data.session)throw Error("Your account could not be confirmed.");
    const {user}=await academyRequest<{user:{admin:boolean}}>("/api/academy/me");
    window.location.replace(user.admin?"/admin":"/school");
   }catch(e){setError(e instanceof Error?e.message:"Unable to sign in.");}
  })();
 },[code,state]);
 return <AuthTransitionScreen error={error} />
}
export default function FinishPage(){return <Suspense fallback={<AuthTransitionScreen />}><Finish/></Suspense>}
