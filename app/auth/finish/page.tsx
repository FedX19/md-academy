"use client";
import {useEffect,useRef,useState,Suspense} from "react";
import {useSearchParams} from "next/navigation";
import Image from "next/image";
import {browserAcademyClient} from "@/lib/academy-client";
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
    window.location.replace("/school");
   }catch(e){setError(e instanceof Error?e.message:"Unable to sign in.");}
  })();
 },[code,state]);
 return <main className="entrance"><div className="entry"><Image src="/brand/md-academy.svg" alt="MD Academy" width={230} height={230}/><h1>CONNECTING <em>YOUR ACCOUNT</em></h1>{error?<><p role="alert" className="lead">{error}</p><a className="button" href="/auth/start">Try again</a></>:<p role="status" className="lead">Opening your coaching school…</p>}</div></main>
}
export default function FinishPage(){return <Suspense fallback={<p>Connecting…</p>}><Finish/></Suspense>}
