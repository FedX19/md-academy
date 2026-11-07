"use client";
import {useEffect,useState,useCallback} from "react";
import Link from "next/link";
import Image from "next/image";
import {BookOpen,PlayCircle,CheckCircle2,ArrowRight,ShieldCheck,GraduationCap} from "lucide-react";
import {academyRequest,browserAcademyClient} from "@/lib/academy-client";
type Lesson={id:string;title:string;summary:string;lesson_type:string;duration_seconds:number;sort_order:number};
type Module={id:string;title:string;sort_order:number;academy_lessons:Lesson[]};
type Course={id:string;slug:string;title:string;summary:string;status:string;academy_modules:Module[]};
type Progress={lesson_id:string;position_seconds:number;completed_at:string|null};
export function SchoolClient(){
 const [user,setUser]=useState<{name:string;admin:boolean}|null>(null);
 const [courses,setCourses]=useState<Course[]>([]);
 const [progress,setProgress]=useState<Progress[]>([]);
 const [selected,setSelected]=useState<Lesson|null>(null);
 const [video,setVideo]=useState<string|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const reload=useCallback(async()=>{
  const me=await academyRequest<{user:{name:string;admin:boolean}}>("/api/academy/me");
  const [catalog,history]=await Promise.all([academyRequest<{courses:Course[]}>("/api/academy/courses"),academyRequest<{progress:Progress[]}>("/api/academy/progress")]);
  setUser(me.user);setCourses(catalog.courses);setProgress(history.progress);
 },[]);
 useEffect(()=>{void reload().catch(e=>setError(e instanceof Error?e.message:"Academy is unavailable."))},[reload]);
 async function openLesson(lesson:Lesson){
  setSelected(lesson);setVideo(null);setError(null);
  if(lesson.lesson_type==="video"){
   try{const result=await academyRequest<{url:string}>("/api/academy/playback",{method:"POST",body:JSON.stringify({lessonId:lesson.id})});setVideo(result.url)}
   catch(e){setError(e instanceof Error?e.message:"Video unavailable.")}
  }
 }
 async function save(lesson:Lesson,seconds:number,complete:boolean){
  if(busy)return;setBusy(true);
  try{
   await academyRequest("/api/academy/progress",{method:"PUT",body:JSON.stringify({lessonId:lesson.id,positionSeconds:Math.floor(seconds),complete})});
   const history=await academyRequest<{progress:Progress[]}>("/api/academy/progress");setProgress(history.progress);
  }catch(e){setError(e instanceof Error?e.message:"Unable to save progress.")}finally{setBusy(false)}
 }
 async function signOut(){await browserAcademyClient()?.auth.signOut();window.location.replace("/auth/start")}
 const cards=courses.filter(c=>c.status==="published"||user?.admin);
 return <div className="school"><aside className="sidebar"><Link href="/"><Image src="/brand/md-academy.svg" alt="MD Academy" width={190} height={190}/></Link><div className="nav-label">YOUR COACHING SCHOOL</div><nav><a href="#courses"><BookOpen size={18}/> My Courses</a><a href="#learning"><PlayCircle size={18}/> Continue Learning</a></nav><p className="sidebar-bottom">Develop players the right way.</p></aside><div className="workspace"><header className="topbar"><span>MODERN DAY COACH <b>/ ACADEMY</b></span><button className="school-signout" onClick={signOut}>Sign out</button></header><main className="content">
 <div className="intro"><span className="eyebrow">MD ACADEMY</span><h1>YOUR COACHING <em>CLASSROOM.</em></h1><p>{user?"Welcome, "+user.name+". Pick up where you left off.":"Connecting your UniteHQ membership…"}</p></div>
 {error?<div role="alert" className="notice">{error} {!user?<a href="/auth/start"> Sign in through UniteHQ</a>:null}</div>:null}
 {user?<><div className="benefits"><div><ShieldCheck/><strong>Private courses</strong><span>Only assigned learning is shown</span></div><div><CheckCircle2/><strong>Saved progress</strong><span>Resume where you left off</span></div><div><GraduationCap/><strong>One coaching system</strong><span>Develop the right way</span></div></div><div className="section-title" id="courses"><h2>My courses</h2></div>
 {cards.length===0?<p className="notice">No training has been assigned yet. Ask your MDC administrator to enroll you in a course.</p>:<div className="course-grid">{cards.map(course=><div className="course" key={course.id}><div className="course-art"><span>MD</span><small>{course.status.toUpperCase()}</small></div><div className="course-copy"><h3>{course.title}</h3><p>{course.summary}</p><div>{course.academy_modules?.reduce((n,m)=>n+(m.academy_lessons?.length??0),0)??0} lessons <ArrowRight size={16}/></div>{course.academy_modules?.slice().sort((a,b)=>a.sort_order-b.sort_order).map(module=><section key={module.id}><h4>{module.title}</h4>{module.academy_lessons?.slice().sort((a,b)=>a.sort_order-b.sort_order).map(lesson=><button className="school-lesson" key={lesson.id} onClick={()=>void openLesson(lesson)}>{progress.some(p=>p.lesson_id===lesson.id&&p.completed_at)?<CheckCircle2 size={15}/>:<PlayCircle size={15}/>} {lesson.title}</button>)}</section>)}</div></div>)}</div>}
 {selected?<section className="academy-player" id="learning"><h2>{selected.title}</h2><p>{selected.summary}</p>{video?<video controls playsInline key={selected.id} src={video} onPause={event=>void save(selected,event.currentTarget.currentTime,false)} onEnded={event=>void save(selected,event.currentTarget.duration,true)} />:<div className="notice">{selected.lesson_type==="video"?"Loading private video…":"Lesson content will appear here once published."}</div>}<button className="button" disabled={busy} onClick={()=>void save(selected,0,true)}>Mark lesson complete</button></section>:null}
 </>:null}</main><footer>MD Academy · Powered by UniteHQ</footer></div></div>;
}
