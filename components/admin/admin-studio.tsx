"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, CirclePlus, ClipboardList, FileText, GraduationCap, LayoutDashboard, LibraryBig, LoaderCircle, LockKeyhole, Pencil, Plus, Save, ShieldCheck, Trash2, UploadCloud, Users, Video, X } from "lucide-react";
import { academyRequest, browserAcademyClient } from "@/lib/academy-client";

type CourseStatus = "draft" | "review" | "published" | "archived";
type LessonType = "video" | "article" | "quiz";
type Audience = "mdc-coach" | "league-coach" | "parent" | "public";
type Lesson = {
 id:string; title:string; summary:string; lesson_type:LessonType;
 body:string; duration_seconds:number; media_asset_id:string|null; sort_order:number;
};
type Module = { id:string; title:string; sort_order:number; academy_lessons:Lesson[] };
type Course = {
 id:string; slug:string; title:string; summary:string; audience:Audience;
 status:CourseStatus; published_at:string|null; academy_modules:Module[];
};
type Editor = {name:string; email:string|null; admin:boolean; author:boolean; publisher:boolean};
type Question = {
 id:string; lesson_id:string; prompt:string; choices:string[];
 correct_index:number; explanation:string; sort_order:number;
};
type View = "overview"|"curriculum"|"coaches";
type CourseDraft = {title:string;slug:string;summary:string;audience:Audience};
type LessonDraft = {title:string;summary:string;body:string;duration:number};
const emptyCourse:CourseDraft={title:"",slug:"",summary:"",audience:"mdc-coach"};
const audienceNames:Record<Audience,string>={
 "mdc-coach":"MDC Coaches","league-coach":"League Coaches",parent:"Parents",public:"Public Learners",
};
const typeNames:Record<LessonType,string>={video:"Video lesson",article:"Reading / article",quiz:"Knowledge check"};
async function measuredVideoDuration(file: File): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const url=URL.createObjectURL(file);
    const video=document.createElement("video");
    let closed=false;
    const finish=(duration?:number)=>{
      if(closed)return;
      closed=true;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      if(!duration||!Number.isFinite(duration)||duration<30||duration>5400){
        reject(new Error("Unable to verify video length. Use a web-ready MP4/WebM between 30 seconds and 90 minutes."));
      }else resolve(Math.ceil(duration));
    };
    video.preload="metadata";
    video.onloadedmetadata=()=>finish(video.duration);
    video.onerror=()=>finish();
    video.src=url;
  });
}

const slugify=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,72);
const ordered=<T extends {sort_order:number}>(items:T[]|undefined)=>[...(items??[])].sort((a,b)=>a.sort_order-b.sort_order);
const nextOrder=(items:{sort_order:number}[]|undefined)=>Math.max(-1,...(items??[]).map(x=>x.sort_order))+1;
function statusName(status:CourseStatus){return status==="published"?"Published":status==="review"?"In review":status==="archived"?"Archived":"Draft";}
function countLessons(course:Course){return (course.academy_modules??[]).reduce((sum,module)=>sum+(module.academy_lessons?.length??0),0);}

export function AdminStudio(){
 const [viewer,setViewer]=useState<Editor|null>(null);
 const [access,setAccess]=useState<"loading"|"allowed"|"denied">("loading");
 const [courses,setCourses]=useState<Course[]>([]);
 const [view,setView]=useState<View>("overview");
 const [courseId,setCourseId]=useState<string|null>(null);
 const [moduleId,setModuleId]=useState<string|null>(null);
 const [lessonId,setLessonId]=useState<string|null>(null);
 const [showNewCourse,setShowNewCourse]=useState(false);
 const [creatingCourse,setCreatingCourse]=useState<CourseDraft>(emptyCourse);
 const [courseDraft,setCourseDraft]=useState<CourseDraft>(emptyCourse);
 const [moduleTitle,setModuleTitle]=useState("");
 const [newModuleTitle,setNewModuleTitle]=useState("");
 const [newLessonTitle,setNewLessonTitle]=useState("");
 const [newLessonType,setNewLessonType]=useState<LessonType>("video");
 const [newLessonSummary,setNewLessonSummary]=useState("");
 const [newLessonDuration,setNewLessonDuration]=useState(5);
 const [lessonDraft,setLessonDraft]=useState<LessonDraft>({title:"",summary:"",body:"",duration:5});
 const [uploadFile,setUploadFile]=useState<File|null>(null);
 const [uploadStatus,setUploadStatus]=useState("");
 const [questions,setQuestions]=useState<Question[]>([]);
 const [editingQuestionId,setEditingQuestionId]=useState<string|null>(null);
 const [questionPrompt,setQuestionPrompt]=useState("");
 const [questionChoices,setQuestionChoices]=useState<string[]>(["",""]);
 const [correctIndex,setCorrectIndex]=useState(0);
 const [questionExplanation,setQuestionExplanation]=useState("");
 const [coachEmail,setCoachEmail]=useState("");
 const [coachCourseId,setCoachCourseId]=useState<string>("");
 const [loadingMessage,setLoadingMessage]=useState("");
 const [working,setWorking]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const questionSeq=useRef(0);

 const selectedCourse=useMemo(()=>courses.find(course=>course.id===courseId)??null,[courses,courseId]);
 const selectedModule=selectedCourse?.academy_modules?.find(module=>module.id===moduleId)??null;
 const selectedLesson=selectedModule?.academy_lessons?.find(lesson=>lesson.id===lessonId)??null;
 const readOnly=selectedCourse?.status==="published"||selectedCourse?.status==="archived";
 const publishedCourses=courses.filter(course=>course.status==="published");

 useEffect(()=>{
  let active=true;
  async function init(){
   try{
    const account=await academyRequest<{user:Editor}>("/api/academy/me");
    if(!active)return;
    if(!account.user.author){setAccess("denied");return;}
    const library=await academyRequest<{courses:Course[]}>("/api/academy/admin/courses");
    if(!active)return;
    setViewer(account.user);
    setCourses(library.courses??[]);
    setAccess("allowed");
   }catch(cause){
    if(!active)return;
    setAccess("denied");
    setError(cause instanceof Error?cause.message:"Academy administration is unavailable.");
   }
  }
  void init();
  return()=>{active=false;};
 },[]);

 async function reload(){
  const response=await academyRequest<{courses:Course[]}>("/api/academy/admin/courses");
  setCourses(response.courses??[]);
 }
 async function run(work:()=>Promise<void>, success:string){
  if(working)return;
  setWorking(true);setNotice("");setError("");
  try{await work();setNotice(success);}
  catch(cause){setError(cause instanceof Error?cause.message:"The change could not be saved.");}
  finally{setWorking(false);setLoadingMessage("");}
 }
 function openCourse(course:Course){
  setCourseId(course.id);setModuleId(null);setLessonId(null);
  setCourseDraft({title:course.title,slug:course.slug,summary:course.summary,audience:course.audience});
  setView("curriculum");setError("");setNotice("");
 }
 function openModule(module:Module){
  setModuleId(module.id);setLessonId(null);setModuleTitle(module.title);
  setUploadFile(null);setQuestions([]);setError("");setNotice("");
 }
 async function openLesson(lesson:Lesson,module:Module){
  setModuleId(module.id);setModuleTitle(module.title);setLessonId(lesson.id);
  setLessonDraft({title:lesson.title,summary:lesson.summary,body:lesson.body??"",duration:Math.max(1,Math.ceil(lesson.duration_seconds/60)||5)});
  setUploadFile(null);setUploadStatus("");setError("");setNotice("");
  setQuestions([]);clearQuestion();
  const seq=++questionSeq.current;
  if(lesson.lesson_type==="quiz"){
   try{
    const result=await academyRequest<{questions:Question[]}>("/api/academy/admin/questions?lessonId="+encodeURIComponent(lesson.id));
    if(seq===questionSeq.current)setQuestions(result.questions??[]);
   }catch(cause){
    if(seq===questionSeq.current)setError(cause instanceof Error?cause.message:"Quiz questions could not load.");
   }
  }
 }
 function clearQuestion(){
  setEditingQuestionId(null);setQuestionPrompt("");
  setQuestionChoices(["",""]);setCorrectIndex(0);setQuestionExplanation("");
 }
 function startQuestionEdit(question:Question){
  setEditingQuestionId(question.id);setQuestionPrompt(question.prompt);
  setQuestionChoices([...question.choices]);setCorrectIndex(question.correct_index);
  setQuestionExplanation(question.explanation??"");
 }
 async function refreshQuestions(id:string){
  const result=await academyRequest<{questions:Question[]}>("/api/academy/admin/questions?lessonId="+encodeURIComponent(id));
  setQuestions(result.questions??[]);
 }
 function exitToOverview(){
  setView("overview");setCourseId(null);setModuleId(null);setLessonId(null);setError("");setNotice("");
 }
 function showCoaches(){
  setView("coaches");setLessonId(null);setError("");setNotice("");
  if(selectedCourse?.status==="published")setCoachCourseId(selectedCourse.id);
 }
 async function signOut(){
  await browserAcademyClient()?.auth.signOut();
  window.location.replace("/");
 }
 async function createCourse(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  await run(async()=>{
   const {course}=await academyRequest<{course:{id:string}}>("/api/academy/admin/courses",{
    method:"POST",body:JSON.stringify({...creatingCourse,slug:creatingCourse.slug.trim()||slugify(creatingCourse.title)}),
   });
   await reload();
   setCourseId(course.id);setModuleId(null);setLessonId(null);
   setCourseDraft({...creatingCourse,slug:creatingCourse.slug||slugify(creatingCourse.title)});
   setCreatingCourse(emptyCourse);setShowNewCourse(false);setView("curriculum");
  },"Course created as a private draft. Add your first module.");
 }
 async function saveCourse(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!selectedCourse||readOnly)return;
  await run(async()=>{
   await academyRequest("/api/academy/admin/courses",{method:"PATCH",body:JSON.stringify({id:selectedCourse.id,...courseDraft})});
   await reload();
  },"Course details saved.");
 }
 async function markForReview(){
  if(!selectedCourse||readOnly)return;
  await run(async()=>{
   await academyRequest("/api/academy/admin/courses",{method:"PATCH",body:JSON.stringify({id:selectedCourse.id,status:"review"})});
   await reload();
  },"Course is marked for review. It is not visible to learners.");
 }
 async function publishCourse(){
  if(!selectedCourse||!viewer?.publisher||readOnly)return;
  if(!window.confirm("Publish this course? Check every lesson and quiz first. Published curriculum is locked to protect learner records."))return;
  await run(async()=>{
   await academyRequest("/api/academy/admin/publish",{method:"POST",body:JSON.stringify({courseId:selectedCourse.id})});
   await reload();
  },"Course published. You can now assign coaches.");
 }
 async function addModule(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!selectedCourse||readOnly)return;
  await run(async()=>{
   const {module}=await academyRequest<{module:Module}>("/api/academy/admin/content",{
    method:"POST",body:JSON.stringify({kind:"module",courseId:selectedCourse.id,title:newModuleTitle.trim(),sortOrder:nextOrder(selectedCourse.academy_modules)}),
   });
   await reload();setModuleId(module.id);setModuleTitle(module.title);setLessonId(null);setNewModuleTitle("");
  },"Module added. Add lessons to this module.");
 }
 async function saveModule(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!selectedModule||readOnly)return;
  await run(async()=>{
   await academyRequest("/api/academy/admin/content",{method:"PATCH",body:JSON.stringify({kind:"module",id:selectedModule.id,title:moduleTitle.trim()})});
   await reload();
  },"Module updated.");
 }
 async function addLesson(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!selectedModule||readOnly)return;
  await run(async()=>{
   const {lesson}=await academyRequest<{lesson:{id:string}}>("/api/academy/admin/content",{
    method:"POST",body:JSON.stringify({kind:"lesson",moduleId:selectedModule.id,title:newLessonTitle.trim(),
     summary:newLessonSummary.trim(),type:newLessonType,durationSeconds:newLessonDuration*60,
     sortOrder:nextOrder(selectedModule.academy_lessons)}),
   });
   const type=newLessonType,title=newLessonTitle,summary=newLessonSummary,duration=newLessonDuration;
   await reload();setLessonId(lesson.id);
   setLessonDraft({title,summary,body:"",duration});
   setNewLessonTitle("");setNewLessonSummary("");setNewLessonType("video");setNewLessonDuration(5);
   setQuestions([]);clearQuestion();setUploadFile(null);
   if(type==="quiz")await refreshQuestions(lesson.id);
  },"Lesson added. Complete its content before publishing.");
 }
 async function saveLesson(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!selectedLesson||readOnly)return;
  await run(async()=>{
   await academyRequest("/api/academy/admin/content",{method:"PATCH",body:JSON.stringify({
    kind:"lesson",id:selectedLesson.id,title:lessonDraft.title.trim(),summary:lessonDraft.summary.trim(),
    body:selectedLesson.lesson_type==="article"?lessonDraft.body:undefined,
    durationSeconds:Math.round(lessonDraft.duration*60),
   })});
   await reload();
  },"Lesson changes saved.");
 }
 async function deleteItem(kind:"module"|"lesson",id:string){
  if(readOnly||!window.confirm(kind==="module"?"Delete this module and all its lessons? This cannot be undone.":"Delete this lesson? This cannot be undone."))return;
  await run(async()=>{
   await academyRequest("/api/academy/admin/content",{method:"DELETE",body:JSON.stringify({kind,id})});
   if(kind==="module"){setModuleId(null);setLessonId(null);}
   else setLessonId(null);
   await reload();
  },kind==="module"?"Module removed.":"Lesson removed.");
 }
 async function uploadVideo(){
  if(!selectedCourse||!selectedLesson||readOnly||selectedLesson.lesson_type!=="video"||!uploadFile)return;
  const file=uploadFile;
  const mime=file.type==="video/webm"||/\.webm$/i.test(file.name)?"video/webm":
   file.type==="video/mp4"||/\.mp4$/i.test(file.name)?"video/mp4":null;
  if(!mime){setError("Select an MP4 or WebM video.");return;}
  if(file.size>314572800){setError("Videos must be 300 MiB or smaller.");return;}
  if(file.size===0){setError("The selected video is empty.");return;}
  const lessonIdForUpload=selectedLesson.id;
  await run(async()=>{
   setLoadingMessage("Checking actual video duration...");
   const videoDuration=await measuredVideoDuration(file);
   setLoadingMessage("Reserving your private video...");
   const reservation=await academyRequest<{assetId:string;bucket:string;path:string}>("/api/academy/admin/media",{
    method:"POST",body:JSON.stringify({courseId:selectedCourse.id,mimeType:mime}),
   });
   const client=browserAcademyClient();
   if(!client)throw Error("Supabase sign-in is not configured.");
   setLoadingMessage("Uploading directly to secure storage. Keep this page open...");
   const {error:storageError}=await client.storage.from(reservation.bucket).upload(reservation.path,file,{
    contentType:mime,upsert:false,cacheControl:"3600",
   });
   if(storageError)throw Error("Video upload failed: "+storageError.message);
   setLoadingMessage("Linking video to lesson...");
   await academyRequest("/api/academy/admin/content",{method:"PATCH",
    body:JSON.stringify({kind:"lesson",id:lessonIdForUpload,mediaAssetId:reservation.assetId,durationSeconds:videoDuration}),
   });
   setUploadFile(null);
   setLessonDraft(draft=>({...draft,duration:Math.ceil(videoDuration/60)}));
   await reload();
  },"Video uploaded privately. The lesson duration was synchronized to the real video length.");
 }
 async function saveQuestion(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!selectedLesson||selectedLesson.lesson_type!=="quiz"||readOnly)return;
  if(questionChoices.some(x=>!x.trim())){setError("Each answer option needs text.");return;}
  if(questionChoices.length<2||correctIndex>=questionChoices.length){setError("Select a valid correct answer.");return;}
  await run(async()=>{
   const payload={lessonId:selectedLesson.id,prompt:questionPrompt.trim(),choices:questionChoices.map(x=>x.trim()),
    correctIndex,explanation:questionExplanation.trim(),
    sortOrder:editingQuestionId?undefined:nextOrder(questions)};
   await academyRequest("/api/academy/admin/questions",{
    method:editingQuestionId?"PATCH":"POST",
    body:JSON.stringify(editingQuestionId?{id:editingQuestionId,...payload}:payload),
   });
   await refreshQuestions(selectedLesson.id);clearQuestion();
  },editingQuestionId?"Question updated.":"Question added.");
 }
 async function removeQuestion(question:Question){
  if(readOnly||!window.confirm("Delete this quiz question?"))return;
  await run(async()=>{
   await academyRequest("/api/academy/admin/questions",{method:"DELETE",body:JSON.stringify({id:question.id})});
   await refreshQuestions(question.lesson_id);clearQuestion();
  },"Question removed.");
 }
 async function changeEnrollment(status:"active"|"revoked"){
  if(!viewer?.publisher||!coachCourseId||!coachEmail.trim())return;
  const action=status==="active"?"assign":"revoke";
  if(status==="revoked"&&!window.confirm("Revoke Academy access for "+coachEmail.trim()+"?"))return;
  await run(async()=>{
   await academyRequest("/api/academy/admin/enrollments",{
    method:status==="active"?"POST":"PATCH",
    body:JSON.stringify({courseId:coachCourseId,email:coachEmail.trim().toLowerCase(),
     ...(status==="revoked"?{status:"revoked"}:{})}),
   });
   setCoachEmail("");
  },status==="active"?"Coach assigned. They can enter Academy through UniteHQ.":"Coach access revoked.");
 }

 if(access==="loading")return <main className="studio-gate"><LoaderCircle size={29}/><h1>Opening Academy Admin Studio</h1><p>Verifying your permissions…</p></main>;
 if(access==="denied")return <main className="studio-gate">
  <LockKeyhole size={38}/><h1>Administrator access required</h1>
  <p>{error||"This workspace is reserved for assigned MD Academy administrators and course editors."}</p>
  <div className="studio-gate-actions"><Link href="/school">Return to coach classroom</Link><Link href="/auth/start">Sign in through UniteHQ</Link></div>
 </main>;

 return <div className="studio-app">
  <aside className="studio-sidebar">
   <Link className="studio-brand" href="/admin"><Image alt="MD Academy" src="/brand/md-academy.svg" width={164} height={150} priority/></Link>
   <div className="studio-nav-heading">ACADEMY MANAGEMENT</div>
   <nav aria-label="Admin navigation">
    <button className={view==="overview"?"active":""} type="button" onClick={exitToOverview}><LayoutDashboard size={18}/> Overview</button>
    <button className={view==="curriculum"?"active":""} type="button" onClick={()=>{if(selectedCourse){setView("curriculum");}else exitToOverview();}}><BookOpen size={18}/> Curriculum Builder</button>
    {viewer?.publisher?<button className={view==="coaches"?"active":""} type="button" onClick={showCoaches}><Users size={18}/> Coach Assignments</button>:null}
   </nav>
   <div className="studio-divider"/>
   <Link className="studio-classroom-link" href="/school"><GraduationCap size={18}/> View Coach Classroom <ArrowRight size={15}/></Link>
   <div className="studio-sidebar-foot">
    <ShieldCheck size={17}/><span><strong>Private admin workspace</strong><small>Courses stay hidden until you publish</small></span>
   </div>
  </aside>
  <div className="studio-main">
   <header className="studio-topbar">
    <div className="studio-topbar-breadcrumb">MODERN DAY COACH <span>/</span> <strong>ACADEMY ADMIN STUDIO</strong></div>
    <div className="studio-topbar-actions"><span className="studio-user-role">{viewer?.publisher?"Administrator":"Course Editor"}</span><button type="button" onClick={()=>void signOut()}>Sign out</button></div>
   </header>
   <main className="studio-content">
    {view==="overview"?<>
     <div className="studio-page-heading"><div><div className="studio-eyebrow">CREATE & MANAGE CURRICULUM</div>
      <h1>Build the <em>coaching school.</em></h1>
      <p>Create courses, structure modules, add lessons and assessments, then publish when everything is ready.</p></div>
      <button className="studio-primary" type="button" onClick={()=>setShowNewCourse(x=>!x)}><Plus size={19}/> New Course</button>
     </div>
     <div className="studio-stats">
      <div><BookOpen size={20}/><strong>{courses.length}</strong><span>Courses created</span></div>
      <div><FileText size={20}/><strong>{courses.filter(c=>c.status!=="published").length}</strong><span>Drafts & reviews</span></div>
      <div><GraduationCap size={20}/><strong>{courses.filter(c=>c.status==="published").length}</strong><span>Published courses</span></div>
     </div>
     {showNewCourse?<section className="studio-panel studio-new-course">
      <div className="studio-section-title"><div><h2>Create a new course</h2><p>Start with the fundamentals. You can build the lessons afterward.</p></div>
       <button type="button" className="studio-icon-button" aria-label="Close new course" onClick={()=>setShowNewCourse(false)}><X size={19}/></button></div>
      <form onSubmit={event=>void createCourse(event)} className="studio-form-grid">
       <label className="studio-field"><span>Course name</span><input value={creatingCourse.title} maxLength={100} required placeholder="e.g., MDC Coach Foundations" onChange={event=>setCreatingCourse(c=>({...c,title:event.target.value,slug:slugify(event.target.value)}))}/></label>
       <label className="studio-field"><span>Who is it for?</span><select value={creatingCourse.audience} onChange={event=>setCreatingCourse(c=>({...c,audience:event.target.value as Audience}))}>{Object.entries(audienceNames).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
       <label className="studio-field studio-wide"><span>What will coaches learn?</span><textarea required rows={3} maxLength={320} value={creatingCourse.summary} placeholder="A short description of what this course teaches." onChange={event=>setCreatingCourse(c=>({...c,summary:event.target.value}))}/></label>
       <label className="studio-field studio-wide"><span>Course URL identifier</span><input required maxLength={72} pattern="[a-z][a-z0-9-]*" value={creatingCourse.slug} onChange={event=>setCreatingCourse(c=>({...c,slug:slugify(event.target.value)}))}/></label>
       <button className="studio-primary" disabled={working} type="submit"><CirclePlus size={17}/> Create Private Draft</button>
      </form>
     </section>:null}
     <div className="studio-list-heading"><h2>Your Courses</h2><span>{courses.length} total</span></div>
     {courses.length===0?<div className="studio-empty"><LibraryBig size={43}/><h3>Start your first course</h3><p>Your curriculum lives here, separate from what coaches see when they arrive to get certified.</p><button className="studio-primary" onClick={()=>setShowNewCourse(true)} type="button"><Plus size={17}/> Create a course</button></div>
      :<div className="studio-course-cards">{courses.map(course=><button key={course.id} type="button" className="studio-course-card" onClick={()=>openCourse(course)}>
        <div className="studio-course-symbol"><BookOpen size={27}/></div>
        <div className="studio-course-info"><div className="studio-course-topline"><strong>{course.title}</strong><span className={"studio-status "+course.status}>{statusName(course.status)}</span></div>
         <p>{course.summary}</p><div className="studio-course-meta">{ordered(course.academy_modules).length} modules · {countLessons(course)} lessons · {audienceNames[course.audience]}</div></div>
        <ChevronRight size={21}/></button>)}</div>}
    </>:null}

    {view==="curriculum"&&selectedCourse?<>
     <button type="button" className="studio-back" onClick={exitToOverview}><ArrowLeft size={16}/> All courses</button>
     <div className="studio-page-heading studio-course-heading"><div><div className="studio-eyebrow">CURRICULUM BUILDER <span className={"studio-status "+selectedCourse.status}>{statusName(selectedCourse.status)}</span></div>
      <h1>{selectedCourse.title}</h1><p>{countLessons(selectedCourse)} lessons across {selectedCourse.academy_modules?.length??0} modules · {audienceNames[selectedCourse.audience]}</p></div>
      {selectedCourse.status==="published"&&viewer?.publisher?<button className="studio-secondary" type="button" onClick={showCoaches}><Users size={17}/> Assign Coaches</button>:null}
     </div>
     {readOnly?<div className="studio-inline-warning"><LockKeyhole size={17}/> Published curriculum is locked to preserve coach progress and certifications. New revisions will need a separate draft.</div>:null}
     <div className="studio-editor-layout">
      <aside className="studio-outline">
       <div className="studio-outline-head"><h2>Course Structure</h2><span>{selectedCourse.academy_modules?.length??0} modules</span></div>
       <button type="button" className={"studio-outline-course "+(!moduleId?"chosen":"")} onClick={()=>{setModuleId(null);setLessonId(null);}}><ClipboardList size={17}/> Course Details</button>
       {ordered(selectedCourse.academy_modules).map((module,index)=><div className="studio-module" key={module.id}>
        <button type="button" className={"studio-module-button "+(moduleId===module.id&&!lessonId?"chosen":"")} onClick={()=>openModule(module)}>
         <span className="studio-module-number">{index+1}</span><strong>{module.title}</strong><ChevronDown size={14}/></button>
        {ordered(module.academy_lessons).map(lesson=><button type="button" key={lesson.id} className={"studio-outline-lesson "+(lessonId===lesson.id?"chosen":"")} onClick={()=>void openLesson(lesson,module)}>
          {lesson.lesson_type==="video"?<Video size={15}/>:lesson.lesson_type==="article"?<FileText size={15}/>:<ClipboardList size={15}/>}
          <span>{lesson.title}</span>{lesson.media_asset_id?<Check size={14} className="studio-complete"/>:null}
        </button>)}
       </div>)}
       {!readOnly?<form className="studio-add-module" onSubmit={event=>void addModule(event)}>
        <label htmlFor="new-module-name">Add module</label><input id="new-module-name" required maxLength={100} value={newModuleTitle} onChange={event=>setNewModuleTitle(event.target.value)} placeholder="e.g. The Winning Way"/>
        <button className="studio-secondary" type="submit" disabled={working}><Plus size={15}/> Add Module</button>
       </form>:null}
      </aside>
      <div className="studio-editor-panel">
       {!selectedModule?<section className="studio-panel">
        <div className="studio-section-title"><div><span className="studio-eyebrow">COURSE SETUP</span><h2>Course Details</h2><p>Define what this training teaches before building its lessons.</p></div></div>
        <form onSubmit={event=>void saveCourse(event)} className="studio-form-grid">
         <label className="studio-field studio-wide"><span>Course title</span><input required disabled={readOnly} maxLength={100} value={courseDraft.title} onChange={event=>setCourseDraft(x=>({...x,title:event.target.value}))}/></label>
         <label className="studio-field studio-wide"><span>Description</span><textarea required rows={4} maxLength={320} disabled={readOnly} value={courseDraft.summary} onChange={event=>setCourseDraft(x=>({...x,summary:event.target.value}))}/></label>
         <label className="studio-field"><span>Audience</span><select disabled={readOnly} value={courseDraft.audience} onChange={event=>setCourseDraft(x=>({...x,audience:event.target.value as Audience}))}>{Object.entries(audienceNames).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
         <label className="studio-field"><span>Course URL</span><input required disabled={readOnly} maxLength={72} value={courseDraft.slug} onChange={event=>setCourseDraft(x=>({...x,slug:slugify(event.target.value)}))}/></label>
         {!readOnly?<button type="submit" className="studio-primary" disabled={working}><Save size={17}/> Save Course</button>:null}
        </form>
        <div className="studio-publish-zone">
         <div><h3>Publish curriculum</h3><p>Build modules, add real lesson content, upload required videos, and add quiz questions before publishing.</p></div>
         {selectedCourse.status==="draft"&&!readOnly?<button type="button" disabled={working} className="studio-secondary" onClick={()=>void markForReview()}><ClipboardList size={17}/> Mark for Review</button>:null}
         {viewer?.publisher&&!readOnly?<button type="button" disabled={working} className="studio-primary" onClick={()=>void publishCourse()}><ShieldCheck size={17}/> Review & Publish</button>:null}
         {selectedCourse.status==="published"?<span className="studio-published-label"><Check size={17}/> Published and locked</span>:null}
         {!viewer?.publisher&&!readOnly?<span className="studio-muted">Only Academy administrators can publish and enroll coaches.</span>:null}
        </div>
       </section>:null}
       {selectedModule&&!selectedLesson?<section className="studio-panel">
        <div className="studio-section-title"><div><span className="studio-eyebrow">MODULE BUILDER</span><h2>{selectedModule.title}</h2><p>Organize one skill or coaching topic into focused lessons.</p></div>
         {!readOnly?<button type="button" className="studio-icon-button studio-danger" title="Delete module" aria-label="Delete module" onClick={()=>void deleteItem("module",selectedModule.id)}><Trash2 size={18}/></button>:null}
        </div>
        <form className="studio-inline-form" onSubmit={event=>void saveModule(event)}>
         <label className="studio-field"><span>Module title</span><input required maxLength={100} disabled={readOnly} value={moduleTitle} onChange={event=>setModuleTitle(event.target.value)}/></label>
         {!readOnly?<button type="submit" className="studio-secondary" disabled={working}><Save size={16}/> Save</button>:null}
        </form>
        <div className="studio-list-heading"><h3>Lessons</h3><span>{selectedModule.academy_lessons?.length??0}</span></div>
        {ordered(selectedModule.academy_lessons).length===0?<p className="studio-empty-copy">There are no lessons yet. Add a video, written lesson or knowledge check below.</p>
         :<div className="studio-lessons-list">{ordered(selectedModule.academy_lessons).map((lesson,index)=><button key={lesson.id} type="button" onClick={()=>void openLesson(lesson,selectedModule)}>
           <span className="studio-index">{index+1}</span><span className="studio-lesson-list-main"><strong>{lesson.title}</strong><small>{typeNames[lesson.lesson_type]} · {Math.ceil(lesson.duration_seconds/60)} min</small></span>
           <ChevronRight size={18}/></button>)}</div>}
        {!readOnly?<form className="studio-create-lesson" onSubmit={event=>void addLesson(event)}>
         <div className="studio-section-title"><div><h3><Plus size={17}/> Add a lesson</h3><p>Choose how coaches will learn this topic.</p></div></div>
         <div className="studio-form-grid">
          <label className="studio-field studio-wide"><span>Lesson name</span><input required maxLength={100} value={newLessonTitle} onChange={event=>setNewLessonTitle(event.target.value)} placeholder="e.g. Throwing Strikes"/></label>
          <label className="studio-field"><span>Lesson format</span><select value={newLessonType} onChange={event=>setNewLessonType(event.target.value as LessonType)}>{Object.entries(typeNames).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
          <label className="studio-field"><span>Estimated minutes</span><input required type="number" min={1} max={90} value={newLessonDuration} onChange={event=>setNewLessonDuration(Number(event.target.value))}/></label>
          <label className="studio-field studio-wide"><span>Lesson goal / summary</span><textarea required rows={2} maxLength={500} placeholder="What should coaches understand after this lesson?" value={newLessonSummary} onChange={event=>setNewLessonSummary(event.target.value)}/></label>
          <button type="submit" className="studio-primary" disabled={working}><Plus size={17}/> Add Lesson</button>
         </div>
        </form>:null}
       </section>:null}
       {selectedLesson&&selectedModule?<section className="studio-panel">
        <div className="studio-section-title"><div><button className="studio-back" type="button" onClick={()=>openModule(selectedModule)}><ArrowLeft size={15}/> {selectedModule.title}</button>
         <span className="studio-eyebrow">{typeNames[selectedLesson.lesson_type].toUpperCase()}</span><h2>{selectedLesson.title}</h2></div>
         {!readOnly?<button type="button" title="Delete lesson" aria-label="Delete lesson" className="studio-icon-button studio-danger" onClick={()=>void deleteItem("lesson",selectedLesson.id)}><Trash2 size={18}/></button>:null}
        </div>
        <form onSubmit={event=>void saveLesson(event)} className="studio-form-grid">
         <label className="studio-field studio-wide"><span>Lesson title</span><input required maxLength={100} disabled={readOnly} value={lessonDraft.title} onChange={event=>setLessonDraft(x=>({...x,title:event.target.value}))}/></label>
         <label className="studio-field studio-wide"><span>What does this lesson teach?</span><textarea required maxLength={500} rows={2} disabled={readOnly} value={lessonDraft.summary} onChange={event=>setLessonDraft(x=>({...x,summary:event.target.value}))}/></label>
         <label className="studio-field"><span>Estimated duration (minutes)</span><input required type="number" min={1} max={90} disabled={readOnly} value={lessonDraft.duration} onChange={event=>setLessonDraft(x=>({...x,duration:Number(event.target.value)}))}/></label>
         {selectedLesson.lesson_type==="article"?<label className="studio-field studio-wide"><span>Reading content</span><textarea className="studio-body-editor" maxLength={20000} rows={13} disabled={readOnly} placeholder="Write the teaching material here. Keep it practical and clearly organized." value={lessonDraft.body} onChange={event=>setLessonDraft(x=>({...x,body:event.target.value}))}/></label>:null}
         {!readOnly?<button type="submit" className="studio-primary" disabled={working}><Save size={17}/> Save Lesson</button>:null}
        </form>
        {selectedLesson.lesson_type==="video"?<div className="studio-asset-panel">
         <div className="studio-section-title"><div><h3><UploadCloud size={20}/> Lesson Video</h3><p>Upload an MP4 or WebM directly to your private Academy storage.</p></div></div>
         {selectedLesson.media_asset_id?<div className="studio-media-attached"><Check size={17}/> A private video is attached to this lesson.</div>:<div className="studio-empty-copy">No video uploaded yet. The course cannot be published with an empty video lesson.</div>}
         {!readOnly?<div className="studio-upload-controls">
          <input aria-label="Choose lesson video" type="file" accept="video/mp4,video/webm,.mp4,.webm" onChange={event=>setUploadFile(event.target.files?.[0]??null)}/>
          <button type="button" className="studio-primary" disabled={working||!uploadFile} onClick={()=>void uploadVideo()}><UploadCloud size={17}/>{selectedLesson.media_asset_id?"Replace Video":"Upload Video"}</button>
         </div>:null}
         {loadingMessage?<p role="status" className="studio-muted">{loadingMessage}</p>:null}
         {uploadStatus?<p className="studio-muted">{uploadStatus}</p>:null}
         <p className="studio-muted">300 MiB maximum, subject to the global Supabase limit. The video does not pass through Vercel. Real playback duration is captured automatically to protect certification accuracy.</p>
        </div>:null}
        {selectedLesson.lesson_type==="quiz"?<div className="studio-quiz-panel">
         <div className="studio-section-title"><div><h3><ClipboardList size={20}/> Knowledge Check</h3><p>Coaches will see the questions but never the correct-answer keys.</p></div></div>
         {ordered(questions).length===0?<p className="studio-empty-copy">No questions yet. Add at least one before publishing.</p>:<div className="studio-question-list">
          {ordered(questions).map((question,index)=><div className="studio-question-item" key={question.id}><div><span className="studio-eyebrow">QUESTION {index+1}</span>
            <strong>{question.prompt}</strong><small>Correct: {question.choices[question.correct_index]}</small></div>
            {!readOnly?<div><button title="Edit question" type="button" className="studio-icon-button" onClick={()=>startQuestionEdit(question)}><Pencil size={16}/></button>
              <button title="Delete question" type="button" className="studio-icon-button studio-danger" onClick={()=>void removeQuestion(question)}><Trash2 size={16}/></button></div>:null}
           </div>)}
         </div>}
         {!readOnly?<form className="studio-question-form" onSubmit={event=>void saveQuestion(event)}>
          <h4>{editingQuestionId?"Edit Question":"Add Question"}</h4>
          <label className="studio-field"><span>Question</span><textarea required rows={2} maxLength={800} placeholder="What should the coach know?" value={questionPrompt} onChange={event=>setQuestionPrompt(event.target.value)}/></label>
          <fieldset className="studio-answer-fieldset"><legend>Answer options — select the correct one</legend>
           {questionChoices.map((choice,index)=><div className="studio-answer-row" key={index}>
            <input aria-label={"Mark answer "+(index+1)+" correct"} type="radio" name="correct-answer" checked={correctIndex===index} onChange={()=>setCorrectIndex(index)}/>
            <input required aria-label={"Answer option "+(index+1)} maxLength={200} placeholder={"Answer "+(index+1)} value={choice} onChange={event=>setQuestionChoices(values=>values.map((item,i)=>i===index?event.target.value:item))}/>
            {questionChoices.length>2?<button type="button" aria-label={"Remove answer "+(index+1)} className="studio-icon-button" onClick={()=>{setQuestionChoices(v=>v.filter((_,i)=>i!==index));setCorrectIndex(x=>x===index?0:x>index?x-1:x);}}><X size={15}/></button>:null}
           </div>)}
          </fieldset>
          {questionChoices.length<6?<button type="button" className="studio-text-button" onClick={()=>setQuestionChoices(v=>[...v,""])}><Plus size={15}/> Add another option</button>:null}
          <label className="studio-field"><span>Explanation (optional)</span><textarea rows={2} maxLength={1000} value={questionExplanation} onChange={event=>setQuestionExplanation(event.target.value)} placeholder="Explain why the correct answer matters on the field."/></label>
          <div className="studio-form-actions"><button type="submit" className="studio-primary" disabled={working}><Save size={16}/>{editingQuestionId?"Save Question":"Add Question"}</button>
            {editingQuestionId?<button type="button" className="studio-secondary" onClick={clearQuestion}>Cancel edit</button>:null}</div>
         </form>:null}
        </div>:null}
       </section>:null}
      </div>
     </div>
    </>:null}

    {view==="coaches"&&viewer?.publisher?<><div className="studio-page-heading"><div><div className="studio-eyebrow">CERTIFICATION ACCESS</div>
      <h1>Assign <em>coaches.</em></h1><p>Choose a published course, then enroll or revoke access for a coach with an existing verified UniteHQ account.</p></div></div>
     <div className="studio-panel studio-coaches-panel"><div className="studio-section-title"><div><h2>Course Assignments</h2><p>Coaches cannot enter private training until you assign them a published course.</p></div><ShieldCheck size={27}/></div>
      {publishedCourses.length===0?<p className="studio-empty-copy">Publish your first course to begin enrolling coaches.</p>
      :<div className="studio-form-grid">
       <label className="studio-field studio-wide"><span>Published course</span><select value={coachCourseId} onChange={event=>setCoachCourseId(event.target.value)}>
        <option value="">Select a course</option>{publishedCourses.map(course=><option key={course.id} value={course.id}>{course.title}</option>)}
       </select></label>
       <label className="studio-field studio-wide"><span>Coach email in UniteHQ</span><input type="email" autoComplete="email" maxLength={254} placeholder="coach@example.com" value={coachEmail} onChange={event=>setCoachEmail(event.target.value)}/></label>
       <div className="studio-form-actions"><button type="button" className="studio-primary" disabled={working||!coachEmail.trim()||!coachCourseId} onClick={()=>void changeEnrollment("active")}><Plus size={17}/> Enroll Coach</button>
        <button type="button" className="studio-secondary" disabled={working||!coachEmail.trim()||!coachCourseId} onClick={()=>void changeEnrollment("revoked")}><X size={17}/> Revoke Access</button></div>
      </div>}
      <p className="studio-muted">Enrollment uses the coach’s exact verified UniteHQ email. Never share credentials or enroll someone by a guessed address.</p>
     </div>
    </>:null}

    {error?<div role="alert" className="studio-feedback studio-error"><X size={18}/>{error}<button aria-label="Dismiss error" type="button" onClick={()=>setError("")}><X size={16}/></button></div>:null}
    {notice?<div role="status" className="studio-feedback studio-success"><Check size={18}/>{notice}<button aria-label="Dismiss message" type="button" onClick={()=>setNotice("")}><X size={16}/></button></div>:null}
    {working?<div className="studio-working" role="status"><LoaderCircle size={17}/> {loadingMessage||"Saving changes securely..."}</div>:null}
   </main>
  </div>
 </div>;
}
