"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, PlayCircle, CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck, GraduationCap, LoaderCircle, LockKeyhole, Award, X, Clock3, Menu, LogOut } from "lucide-react";
import { academyRequest, browserAcademyClient } from "@/lib/academy-client";

type Lesson = { id: string; title: string; summary: string; body: string; lesson_type: "video" | "article" | "quiz"; duration_seconds: number; sort_order: number };
type Module = { id: string; title: string; sort_order: number; academy_lessons: Lesson[] };
type Course = { id: string; slug: string; title: string; summary: string; status: string; passing_score_pct?: number; academy_modules: Module[] };
type Progress = { lesson_id: string; position_seconds: number; completed_at: string | null; updated_at?: string };
type Viewer = { name: string; admin: boolean };
type QuizQuestion = { id: string; prompt: string; choices: string[]; correct_index?: number };
type QuizResult = { scorePct: number; passed: boolean; requiredPct: number; questionCount: number };
type Certificate = { course_id: string; verification_code: string; issued_at: string; course_title?: string; learner_name?: string };

function sortedLessons(course: Course) {
  return (course.academy_modules ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
    .flatMap(m => (m.academy_lessons ?? []).slice().sort((a, b) => a.sort_order - b.sort_order));
}

export function SchoolClient({ previewCourseId, previewLessonId, previewOpenCourse }: {
  previewCourseId?: string; previewLessonId?: string; previewOpenCourse?: boolean;
} = {}) {
  const isPreview = Boolean(previewCourseId);
  const [user, setUser] = useState<Viewer | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [activeCourseId,setActiveCourseId]=useState<string|null>(null);
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const mobileMenuButtonRef=useRef<HTMLButtonElement|null>(null);
  const dialogRef=useRef<HTMLDialogElement|null>(null);
  const playerRef=useRef<HTMLVideoElement|null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [videoIssue,setVideoIssue] = useState<{kind:"format"|"network"|"unknown";detail:string}|null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressBusy, setProgressBusy] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const lastSave = useRef<Record<string, number>>({});
  const loadSeq = useRef(0);
  const watchSession = useRef<{ lessonId: string; id: string } | null>(null);
  const watchQueue = useRef<Promise<void>>(Promise.resolve());
  const previewWatched=useRef<Record<string,Array<[number,number]>>>({});
  const previewAnchor=useRef<{id:string;position:number;at:number}|null>(null);

  // Draft material belongs to the isolated preview. Never send draft lesson
  // playback or completion to the real enrolled-coach endpoints.
  function adminDraftPreviewUrl(course:Course, lesson?:Lesson) {
    const query=new URLSearchParams({courseId:course.id});
    if(lesson)query.set("lessonId",lesson.id);
    else query.set("open","course");
    return "/admin/preview?"+query.toString();
  }
  function isAdminDraft(course:Course) {
    return !isPreview && user?.admin===true && course.status!=="published";
  }
  function openCourse(course:Course) {
    if(isAdminDraft(course)){
      window.location.assign(adminDraftPreviewUrl(course));
      return;
    }
    setError(null);setVideoIssue(null);setSelected(null);setVideo(null);setActiveCourseId(course.id);
  }
  function closeCourse() {
    // Pause before unmounting so the final legitimate watch segment is saved.
    if(playerRef.current && !playerRef.current.paused) playerRef.current.pause();
    ++loadSeq.current; // Prevent a late signed-link request reopening media after exit.
    setActiveCourseId(null); setSelected(null); setVideo(null);
    setError(null);setVideoIssue(null);watchSession.current=null;
  }
  useEffect(()=>{
    const dialog=dialogRef.current;
    if(!dialog || !activeCourseId)return;
    if(!dialog.open)dialog.showModal();
    const prior=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{document.body.style.overflow=prior;if(dialog.open)dialog.close();};
  },[activeCourseId]);

  // Mobile menu actions close themselves before navigation; no state changes
  // during effects, which avoids cascading renders on mobile Safari.

  useEffect(()=>{
    if(!mobileMenuOpen)return;
    const onEscape=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){
        event.preventDefault();
        setMobileMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown",onEscape);
    return ()=>window.removeEventListener("keydown",onEscape);
  },[mobileMenuOpen]);

  function goToClassroomSection(id:"courses"|"certificates"){
    setMobileMenuOpen(false);
    // Scroll after the menu closes so the sticky Academy header does not
    // obscure the destination on narrow phones.
    requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"}));
  }

  // Always start each lesson at its player instead of retaining the scroll
  // position from the previous course outline or lesson.
  useEffect(()=>{
    if(activeCourseId){
      const scroll=dialogRef.current?.querySelector<HTMLElement>(".academy-modal-scroll");
      if(scroll)scroll.scrollTop=0;
    }
  },[activeCourseId,selected?.id]);

  function recordPreviewWatch(lesson:Lesson, seconds:number,event:"tick"|"pause"|"ended"|"seek"){
    const now=Date.now(),position=Math.max(0,Math.floor(seconds));
    const prev=previewAnchor.current;
    if(event!=="seek" && prev?.id===lesson.id){
      const elapsed=(now-prev.at)/1000, moved=position-prev.position;
      if(elapsed>=1.5 && elapsed<=45 && moved>0 && moved<=elapsed+2){
        previewWatched.current[lesson.id]??=[];
        previewWatched.current[lesson.id].push([prev.position,Math.min(position,lesson.duration_seconds)]);
      }
    }
    previewAnchor.current={id:lesson.id,position,at:now};
    if(event==="seek")return;
    const sorted=[...(previewWatched.current[lesson.id]??[])].sort((a,b)=>a[0]-b[0]);
    let edge=0;
    for(const [start,end] of sorted){
      if(start>edge)break;
      edge=Math.max(edge,end);
    }
    const complete=event==="ended" && position>=lesson.duration_seconds-2 && edge>=lesson.duration_seconds-2;
    previewProgress(lesson,position,complete);
    if(event==="ended"&&!complete)setError("This video has unwatched sections. Watch from the start through the end to finish.");
  }

  // Preview state is intentionally memory-only. Never call progress, quiz grading,
  // enrollment, video-watch or certificate write endpoints in this mode.
  function previewProgress(lesson: Lesson, seconds: number, complete: boolean) {
    const now = new Date().toISOString();
    const position = Math.min(86400, Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0)));
    setProgress(items => {
      const prior = items.find(p => p.lesson_id === lesson.id);
      const row: Progress = { lesson_id: lesson.id, position_seconds: position,
        completed_at: prior?.completed_at ?? (complete ? now : null), updated_at: now };
      return prior ? items.map(item => item.lesson_id === lesson.id ? row : item) : [...items, row];
    });
  }

  function resumeLesson(course: Course): Lesson | null {
    const lessons = sortedLessons(course);
    const unfinished = lessons.filter(l => !progress.some(p => p.lesson_id === l.id && p.completed_at));
    if (!unfinished.length) return null;
    const activity = unfinished.map(l => ({ lesson:l, record: progress.find(p => p.lesson_id===l.id) }))
      .filter(x => x.record?.updated_at).sort((a,b) => Date.parse(b.record?.updated_at ?? "")-Date.parse(a.record?.updated_at ?? ""));
    return activity[0]?.lesson ?? unfinished[0];
  }
  const formatTime = (seconds:number) => Math.floor(seconds/60)+":"+String(Math.floor(seconds%60)).padStart(2,"0");

  async function beginWatch(lesson: Lesson, seconds: number) {
    if (isPreview) return;
    try {
      const { sessionId } = await academyRequest<{ sessionId: string }>("/api/academy/watch", {
        method:"POST",body:JSON.stringify({lessonId:lesson.id,positionSeconds:Math.max(0,Math.floor(seconds))}),
      });
      if (selected?.id === lesson.id) watchSession.current={lessonId:lesson.id,id:sessionId};
    } catch(cause) { setError(cause instanceof Error ? cause.message : "Watch session unavailable."); }
  }
  function reportWatch(lesson: Lesson,seconds:number,event:"tick"|"pause"|"ended"|"seek"){
    if (isPreview) { recordPreviewWatch(lesson,seconds,event); return; }
    const session=watchSession.current;
    if (!session || session.lessonId!==lesson.id) return;
    const secondsValue=Math.min(86400,Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0)));
    const pending=watchQueue.current;
    const action=(async()=>{
      await pending.catch(()=>undefined);
      try{
        const {watch}=await academyRequest<{watch:{completed:boolean;creditedSeconds:number;requiredSeconds:number}}>("/api/academy/watch",{
          method:"PATCH",body:JSON.stringify({sessionId:session.id,positionSeconds:secondsValue,event}),
        });
        const now=new Date().toISOString();
        setProgress(rows=>{
          const found=rows.find(row=>row.lesson_id===lesson.id);
          if(found)return rows.map(row=>row.lesson_id===lesson.id
            ? {...row,position_seconds:secondsValue,updated_at:now,completed_at:row.completed_at??(watch.completed?now:null)}
            : row);
          return [...rows,{lesson_id:lesson.id,position_seconds:secondsValue,updated_at:now,completed_at:watch.completed?now:null}];
        });
        if(event==="ended"&&!watch.completed){
          setError("Video not complete yet. Watch at normal speed; skips do not count toward certification.");
        }
      }catch(cause){
        if(event!=="tick")setError(cause instanceof Error?cause.message:"Video progress could not be saved.");
      }
    })();
    watchQueue.current=action;
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const me = await academyRequest<{ user: Viewer }>("/api/academy/me");
        if (previewCourseId) {
          if (!me.user.admin) throw new Error("Administrator access required to preview drafts.");
          const response = await academyRequest<{ course: Course }>("/api/academy/admin/preview?courseId=" + encodeURIComponent(previewCourseId));
          if (!cancelled) {
            // Render as a learner. Hide admin-only menus and production progress.
            setUser({ name: "Course Reviewer", admin: false });
            setCourses([response.course]);
            setProgress([]);
            setCertificates([]);
            // Draft links from the admin's real classroom open the same coach
            // preview directly at the selected module or lesson.
            const requested=previewLessonId
              ? sortedLessons(response.course).find(lesson=>lesson.id===previewLessonId)
              : undefined;
            if(requested){
              setActiveCourseId(response.course.id);
              void openLesson(requested);
            }else if(previewOpenCourse){
              setActiveCourseId(response.course.id);
            }
          }
        } else {
          const [catalog, history, awards] = await Promise.all([
            academyRequest<{ courses: Course[] }>("/api/academy/courses"),
            academyRequest<{ progress: Progress[] }>("/api/academy/progress"),
            academyRequest<{ certificates: Certificate[] }>("/api/academy/certificates"),
          ]);
          if (!cancelled) {
            setUser(me.user);
            setCourses(catalog.courses);
            setProgress(history.progress);
            setCertificates(awards.certificates);
          }
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Academy is unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [previewCourseId,previewLessonId,previewOpenCourse]);

  async function openLesson(lesson: Lesson) {
    const seq = ++loadSeq.current;
    if(playerRef.current && !playerRef.current.paused)playerRef.current.pause();
    setSelected(lesson);
    previewAnchor.current=null;
    watchSession.current=null;
    watchQueue.current=Promise.resolve();
    setError(null);
    setVideoIssue(null);
    setVideo(null);
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizResult(null);
    setLoadingVideo(lesson.lesson_type === "video" || lesson.lesson_type === "quiz");
    if (lesson.lesson_type === "article") return;
    if (lesson.lesson_type === "quiz") {
      try {
        const quiz = await academyRequest<{ questions: QuizQuestion[] }>((isPreview ? "/api/academy/admin/preview?lessonId=" : "/api/academy/quiz?lessonId=") + encodeURIComponent(lesson.id));
        if (loadSeq.current === seq) setQuizQuestions(quiz.questions);
      } catch (cause) {
        if (loadSeq.current === seq) setError(cause instanceof Error ? cause.message : "Assessment not available.");
      } finally {
        if (loadSeq.current === seq) setLoadingVideo(false);
      }
      return;
    }
    try {
      const result = await academyRequest<{ url: string }>(isPreview ? "/api/academy/admin/preview" : "/api/academy/playback", {
        method: "POST",
        body: JSON.stringify({ lessonId: lesson.id }),
      });
      if (loadSeq.current === seq) setVideo(result.url);
    } catch (cause) {
      if (loadSeq.current === seq) setError(cause instanceof Error ? cause.message : "Video unavailable.");
    } finally {
      if (loadSeq.current === seq) setLoadingVideo(false);
    }
  }

  async function saveProgress(lesson: Lesson, seconds: number, complete: boolean) {
    if (isPreview) { previewProgress(lesson, seconds, complete); return; }
    if (lesson.lesson_type === "quiz") return;
    if (complete) setProgressBusy(true);
    try {
      await academyRequest("/api/academy/progress", {
        method: "PUT",
        body: JSON.stringify({
          lessonId: lesson.id,
          positionSeconds: Math.min(86400, Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))),
          complete,
        }),
      });
      if (complete) {
        setProgress(items => items.some(item => item.lesson_id === lesson.id)
          ? items.map(item => item.lesson_id === lesson.id ? { ...item, completed_at: item.completed_at ?? new Date().toISOString() } : item)
          : [...items, { lesson_id: lesson.id, position_seconds: Math.floor(seconds), completed_at: new Date().toISOString() }]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save lesson progress.");
    } finally {
      if (complete) setProgressBusy(false);
    }
  }

  async function submitQuiz(lesson: Lesson) {
    if (progressBusy || quizQuestions.length === 0 || quizQuestions.some(question => quizAnswers[question.id] === undefined)) return;
    if (isPreview) {
      const course = courses.find(c => sortedLessons(c).some(l => l.id === lesson.id));
      const required = course?.passing_score_pct ?? 80;
      const correct = quizQuestions.filter(q => q.correct_index !== undefined && quizAnswers[q.id] === q.correct_index).length;
      const score = Math.round(100 * correct / quizQuestions.length);
      const passed = score >= required;
      setQuizResult({ scorePct: score, passed, requiredPct: required, questionCount: quizQuestions.length });
      if (passed) previewProgress(lesson, 0, true);
      return;
    }
    setProgressBusy(true);
    setError(null);
    try {
      const { result } = await academyRequest<{ result: QuizResult }>("/api/academy/quiz", {
        method: "POST", body: JSON.stringify({ lessonId: lesson.id, answers: quizAnswers }),
      });
      setQuizResult(result);
      if (result.passed) {
        const history = await academyRequest<{ progress: Progress[] }>("/api/academy/progress");
        setProgress(history.progress);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Assessment could not be submitted.");
    } finally {
      setProgressBusy(false);
    }
  }

  async function issueCertificate(courseId: string) {
    if (isPreview || progressBusy) return;
    setProgressBusy(true);
    setError(null);
    try {
      const { certificate } = await academyRequest<{ certificate: { verificationCode: string; issuedAt: string; courseTitle: string; learnerName: string } }>("/api/academy/certificates", {
        method: "POST", body: JSON.stringify({ courseId }),
      });
      setCertificates(items => items.some(item => item.course_id === courseId)
        ? items
        : [...items, { course_id: courseId, verification_code: certificate.verificationCode, issued_at: certificate.issuedAt, course_title: certificate.courseTitle, learner_name: certificate.learnerName }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Certificate not available.");
    } finally {
      setProgressBusy(false);
    }
  }

  async function signOut() {
    await browserAcademyClient()?.auth.signOut();
    window.location.replace("/");
  }

  const visible = isPreview ? courses : courses.filter(course => course.status === "published" || user?.admin);
  const activeCourse=visible.find(course=>course.id===activeCourseId)??null;
  const selectedCourse = selected ? visible.find(course => sortedLessons(course).some(lesson => lesson.id === selected.id)) : null;
  const lessonSequence = selectedCourse ? sortedLessons(selectedCourse) : [];
  const nextIndex = selected ? lessonSequence.findIndex(lesson => lesson.id === selected.id) + 1 : 0;
  const nextLesson = lessonSequence[nextIndex] ?? null;
  const completedCount = progress.filter(p => p.completed_at).length;
  const resumeCourse = visible.find(course => resumeLesson(course)) ?? null;
  const resumeTarget = resumeCourse ? resumeLesson(resumeCourse) : null;
  const resumeRecord = resumeTarget ? progress.find(p => p.lesson_id===resumeTarget.id) : null;
  function openLessonFromCourse(lesson:Lesson, course:Course){
    if(isAdminDraft(course)){
      window.location.assign(adminDraftPreviewUrl(course,lesson));
      return;
    }
    setActiveCourseId(course.id);
    void openLesson(lesson);
  }
  function moduleProgress(module:Module){
    const total=module.academy_lessons?.length??0;
    const done=(module.academy_lessons??[]).filter(l=>progress.some(p=>p.lesson_id===l.id&&p.completed_at)).length;
    return {done,total,percent:total?Math.round(done*100/total):0};
  }
  function nextInModule(module:Module){
    const ordered=(module.academy_lessons??[]).slice().sort((a,b)=>a.sort_order-b.sort_order);
    return ordered.find(l=>!progress.some(p=>p.lesson_id===l.id&&p.completed_at))??ordered[0]??null;
  }

  return (
    <div className="school">
      <aside className="sidebar">
        <Link href="/"><Image src="/brand/md-academy.svg" alt="MD Academy" width={190} height={190} /></Link>
        <div className="nav-label">YOUR COACHING SCHOOL</div>
        <nav>
          <a href="#courses"><BookOpen size={18} /> My Courses</a>
          {resumeTarget && resumeCourse
            ? <button type="button" className="academy-nav-continue"
                onClick={()=>openLessonFromCourse(resumeTarget,resumeCourse)}>
                <PlayCircle size={18}/> Continue Learning
              </button>
            : <a href="#courses"><PlayCircle size={18}/> Continue Learning</a>}
          <a href="#certificates"><Award size={18} /> Certificates</a>
          {user?.admin ? <Link href="/admin"><GraduationCap size={18} /> Academy Admin Studio</Link> : null}
        </nav>
        <p className="sidebar-bottom">Learn it. Apply it. Repeat.</p>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="academy-desktop-header-label">MODERN DAY COACH <b>/ ACADEMY</b></span>
          <Link className="academy-mobile-brand" href={isPreview ? "/admin" : "/school"}
            aria-label={isPreview ? "Back to Academy Admin Studio" : "MD Academy Coach Classroom"}>
            <Image src="/brand/md-academy.svg" alt="MD Academy" width={115} height={100} priority />
          </Link>
          <div className="school-account-actions">
            {user?.admin ? <Link className="school-signout" href="/admin">Admin Studio</Link> : null}
            {isPreview ? <Link className="school-signout" href="/admin">Back to Studio</Link> : <button type="button" className="school-signout" onClick={() => void signOut()}>Sign out</button>}
          </div>
          <button type="button" className="academy-mobile-menu-toggle" ref={mobileMenuButtonRef}
            aria-label={mobileMenuOpen ? "Close Academy menu" : "Open Academy menu"}
            aria-expanded={mobileMenuOpen} aria-controls="academy-mobile-menu"
            onClick={()=>setMobileMenuOpen(open=>!open)}>
            {mobileMenuOpen ? <X size={24} aria-hidden="true"/> : <Menu size={24} aria-hidden="true"/>}
          </button>
          {mobileMenuOpen ? <>
            <button type="button" tabIndex={-1} aria-label="Close Academy navigation"
              className="academy-mobile-menu-scrim" onClick={()=>setMobileMenuOpen(false)}/>
            <nav id="academy-mobile-menu" className="academy-mobile-menu" aria-label="Academy mobile navigation">
              <span className="academy-mobile-menu-title">COACH CLASSROOM</span>
              {resumeTarget&&resumeCourse ? <button type="button"
                onClick={()=>{setMobileMenuOpen(false);openLessonFromCourse(resumeTarget,resumeCourse);}}>
                <PlayCircle size={18}/> Continue Learning <ArrowRight className="academy-menu-arrow" size={16}/>
              </button> : null}
              <button type="button" onClick={()=>goToClassroomSection("courses")}>
                <BookOpen size={18}/> My Courses <ArrowRight className="academy-menu-arrow" size={16}/>
              </button>
              <button type="button" onClick={()=>goToClassroomSection("certificates")}>
                <Award size={18}/> My Certificates <ArrowRight className="academy-menu-arrow" size={16}/>
              </button>
              {user?.admin ? <Link href="/admin" onClick={()=>setMobileMenuOpen(false)}>
                <GraduationCap size={18}/> Admin Studio
              </Link> : null}
              {isPreview ? <Link href="/admin" onClick={()=>setMobileMenuOpen(false)}>
                <ArrowLeft size={18}/> Back to Studio
              </Link> : <button type="button" className="academy-mobile-sign-out"
                onClick={()=>{setMobileMenuOpen(false);void signOut();}}>
                <LogOut size={18}/> Sign Out
              </button>}
            </nav>
          </> : null}
        </header>
        <main className="content">
          <div className="intro">
            <span className="eyebrow">MD ACADEMY</span>
            <h1>YOUR COACHING <em>CLASSROOM.</em></h1>
            <p>{user ? "Welcome, " + user.name + ". Pick up where you left off." : "Connecting your UniteHQ account…"}</p>
          </div>
          {loading ? <p role="status" className="loading-status"><LoaderCircle size={18} /> Loading your courses…</p> : null}
          {error && !activeCourseId ? <div role="alert" className="notice">{error} {!user && !loading ? <a href="/auth/start"> Sign in through UniteHQ</a> : null}</div> : null}
          {user ? <>
            <div className="benefits">
              <div><ShieldCheck /><strong>Private courses</strong><span>Assigned training only</span></div>
              <div><CheckCircle2 /><strong>Saved progress</strong><span>{completedCount} lesson{completedCount === 1 ? "" : "s"} completed</span></div>
              <div><GraduationCap /><strong>One coaching system</strong><span>Develop the right way</span></div>
            </div>
            {resumeTarget ? <section className="academy-continue-card" aria-label="Continue your training">
              <div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
                <h2>{resumeTarget.title}</h2>
                <p>{resumeCourse?.title}{resumeRecord?.position_seconds && resumeTarget.lesson_type==="video"
                  ? " · Resume at "+formatTime(resumeRecord.position_seconds) : ""}</p>
              </div>
              <button type="button" className="academy-continue-button" onClick={()=>{if(resumeCourse)openLessonFromCourse(resumeTarget,resumeCourse);}}>
                <PlayCircle size={19}/> Continue Learning <ArrowRight size={16}/>
              </button>
            </section> : null}
            <div className="section-title" id="courses"><h2>My courses</h2></div>
            {visible.length === 0 ? <p className="notice">No courses are assigned yet. Ask an MDC Academy administrator to enroll you.</p>
              : <div className="course-grid">
                {visible.map(course=>{
                  const lessons=sortedLessons(course);
                  const done=lessons.filter(l=>progress.some(p=>p.lesson_id===l.id&&p.completed_at)).length;
                  const pct=lessons.length?Math.round(done/lessons.length*100):0;
                  return <button key={course.id} type="button" className="course academy-course-card"
                    onClick={()=>openCourse(course)} aria-label={"Open "+course.title+" course and module progress"}>
                    <div className="course-art"><Image className="academy-course-logo" src="/brand/mdc-logo-clear-white.png" alt="Modern Day Coach" width={260} height={260} priority={false}/><small>{isPreview?"COACH TRAINING":course.status.toUpperCase()}</small></div>
                    <div className="course-copy">
                      <h3>{course.title}</h3><p>{course.summary}</p>
                      <div className="academy-card-meta"><span>{course.academy_modules?.length??0} modules</span><span>{done} / {lessons.length} lessons</span></div>
                      <div className="academy-progress-track" role="progressbar" aria-label={course.title+" progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                        <span style={{width:pct+"%"}}/>
                      </div>
                      <span className="academy-card-open">{isAdminDraft(course)?"Review draft course":"View modules & progress"} <ArrowRight size={16}/></span>
                    </div>
                  </button>;
                })}
              </div>}
            <dialog ref={dialogRef} className={"academy-course-dialog"+(selected?" academy-dialog-player":"")}
              aria-label={selected ? selected.title+" lesson" : activeCourse?.title+" course modules"}
              onCancel={event=>{event.preventDefault();closeCourse();}}
              onClick={event=>{if(event.target===event.currentTarget)closeCourse();}}>
              {activeCourse ? <>
                <div className="academy-modal-header">
                  <div className="academy-modal-header-main">
                    {selected ? <button type="button" className="academy-modal-back" onClick={()=>{
                      if(playerRef.current&&!playerRef.current.paused)playerRef.current.pause();
                      ++loadSeq.current;
                      setSelected(null);setVideo(null);setError(null);setVideoIssue(null);
                    }}><ArrowLeft size={18}/> All modules</button>
                      : <span className="eyebrow">YOUR COURSE</span>}
                    <h2>{selected?selected.title:activeCourse.title}</h2>
                    {!selected ? <p>{activeCourse.summary}</p> : null}
                  </div>
                  <button type="button" className="academy-modal-close" onClick={closeCourse} aria-label="Close course window"><X size={22}/></button>
                </div>
                <div className="academy-modal-scroll" key={selected?.id??"course"} tabIndex={0}
                  aria-label={selected ? "Lesson content and video" : "Course module list and progress"}>
                  {error ? <div className="academy-modal-feedback" role="alert">
                    <span>{error}</span>
                    {selected?.lesson_type==="video" && !loadingVideo
                      ? <button type="button" onClick={()=>void openLesson(selected)}><PlayCircle size={16}/> Retry video</button>
                      : null}
                  </div> : null}
                  {!selected ? <div className="academy-course-overview">
                    <div className="academy-overall-progress">
                      <div className="academy-overall-header">
                        <strong>Course Progress</strong>
                        <strong>{sortedLessons(activeCourse).filter(l=>progress.some(p=>p.lesson_id===l.id&&p.completed_at)).length} / {sortedLessons(activeCourse).length} lessons</strong>
                      </div>
                      <div className="academy-progress-track"><span style={{width:(sortedLessons(activeCourse).length?Math.round(100*sortedLessons(activeCourse).filter(l=>progress.some(p=>p.lesson_id===l.id&&p.completed_at)).length/sortedLessons(activeCourse).length):0)+"%"}}/></div>
                      <small>Completed lessons are saved automatically when you meet the lesson requirements.</small>
                    </div>
                    {(activeCourse.academy_modules??[]).slice().sort((a,b)=>a.sort_order-b.sort_order).map((module,index)=>{
                      const tally=moduleProgress(module);
                      const first=nextInModule(module);
                      return <section className="academy-module-panel" key={module.id}>
                        <div className="academy-module-head">
                          <div><span className="eyebrow">MODULE {index+1}</span><h3>{module.title}</h3>
                            <p>{tally.done} of {tally.total} lessons completed</p></div>
                          <button type="button" className="academy-module-start" disabled={!first}
                            onClick={()=>{if(first)openLessonFromCourse(first,activeCourse);}}>
                            <PlayCircle size={17}/>{tally.done?"Continue module":"Start module"}<ArrowRight size={15}/>
                          </button>
                        </div>
                        <div className="academy-progress-track academy-module-track" role="progressbar" aria-label={module.title+" progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={tally.percent}>
                          <span style={{width:tally.percent+"%"}}/>
                        </div>
                        <div className="academy-module-lessons">
                          {(module.academy_lessons??[]).slice().sort((a,b)=>a.sort_order-b.sort_order).map(lesson=>{
                            const done=progress.some(p=>p.lesson_id===lesson.id&&p.completed_at);
                            const saved=progress.find(p=>p.lesson_id===lesson.id)?.position_seconds??0;
                            return <button key={lesson.id} type="button" className="academy-lesson-link"
                              onClick={()=>openLessonFromCourse(lesson,activeCourse)}>
                              {done?<CheckCircle2 size={19} className="academy-lesson-done"/>:<PlayCircle size={19}/>}
                              <span><strong>{lesson.title}</strong><small>{done?"Completed":saved>5&&lesson.lesson_type==="video"?"Resume at "+formatTime(saved):lesson.lesson_type==="video"?"Video lesson":lesson.lesson_type==="quiz"?"Knowledge check":"Reading lesson"}</small></span>
                              {lesson.lesson_type==="video"&&<Clock3 size={15}/>}
                              <ArrowRight size={16}/>
                            </button>;
                          })}
                        </div>
                      </section>;
                    })}
                    {!isPreview&&activeCourse.status==="published"&&sortedLessons(activeCourse).length>0&&sortedLessons(activeCourse).every(l=>progress.some(p=>p.lesson_id===l.id&&p.completed_at))&&!certificates.some(cert=>cert.course_id===activeCourse.id)
                      ? <button type="button" className="academy-cert-button" disabled={progressBusy} onClick={()=>void issueCertificate(activeCourse.id)}><Award size={17}/> Claim completion certificate</button> : null}
                  </div> : null}
                  {selected ? <section className="academy-player academy-player-modal" id="learning">
              <span className="eyebrow">MODULE LESSON · {selected.lesson_type.toUpperCase()}</span>
              {loadingVideo ? <div role="status" className="player-placeholder academy-video-loading"><LoaderCircle size={22}/> Loading your lesson…</div> : null}
              {video && selected.lesson_type === "video" ? <video
                ref={playerRef} key={selected.id} controls playsInline preload="metadata" src={video}
                onLoadedMetadata={event => {
                  const prior = progress.find(p => p.lesson_id === selected.id)?.position_seconds ?? 0;
                  const duration = event.currentTarget.duration;
                  if (prior > 5 && Number.isFinite(duration) && prior < duration - 5) event.currentTarget.currentTime = prior;
                }}
                onPlay={event=>{
                  lastSave.current[selected.id]=Math.floor(event.currentTarget.currentTime);
                  if(isPreview)previewAnchor.current={id:selected.id,position:Math.floor(event.currentTarget.currentTime),at:Date.now()};
                  else void beginWatch(selected,event.currentTarget.currentTime);
                }}
                onTimeUpdate={event=>{
                  const seconds=Math.floor(event.currentTarget.currentTime);
                  if(seconds-(lastSave.current[selected.id]??0)>=5){
                    lastSave.current[selected.id]=seconds;
                    reportWatch(selected,seconds,"tick");
                  }
                }}
                onSeeking={event=>{
                  lastSave.current[selected.id]=Math.floor(event.currentTarget.currentTime);
                }}
                onSeeked={event=>reportWatch(selected,event.currentTarget.currentTime,"seek")}
                onRateChange={event=>{if(event.currentTarget.playbackRate>1)event.currentTarget.playbackRate=1;}}
                onPause={event=>{if(!event.currentTarget.ended)reportWatch(selected,event.currentTarget.currentTime,"pause");}}
                onEnded={event=>reportWatch(selected,event.currentTarget.currentTime,"ended")}
                onLoadedData={()=>setVideoIssue(null)}
                onError={event=>{
                  const media=event.currentTarget;
                  const code=media.error?.code;
                  const kind=code===3||code===4?"format":code===2?"network":"unknown";
                  setVideoIssue({
                    kind,
                    detail:kind==="format"
                      ?"Your browser could not decode or load this MP4. The video link may work, but the file could use a codec your device cannot play. H.264 video with AAC audio in an MP4 is the recommended export."
                      :kind==="network"
                        ?"The video connection was interrupted. Try requesting a fresh private playback link."
                        :"This video could not start. Try requesting a fresh link, then check the MP4 encoding if it continues.",
                  });
                }}
              /> : null}
              {selected.lesson_type === "video" && videoIssue ? <div className="academy-video-issue" role="alert">
                <strong>Video playback needs attention</strong>
                <p>{videoIssue.detail}</p>
                <div className="academy-video-issue-actions">
                  <button className="button" type="button" disabled={loadingVideo} onClick={()=>void openLesson(selected)}>
                    <PlayCircle size={16}/> Retry video
                  </button>
                  {isPreview ? <span>In Admin Studio, re-export and re-upload any incompatible lesson using H.264/AAC MP4.</span>
                    : <span>Contact your league director if retrying still fails.</span>}
                </div>
              </div> : null}
              {selected.lesson_type==="video" ? <p className="academy-watch-rule"><ShieldCheck size={15}/> Watch this entire video at normal speed to complete the lesson. Progress is remembered when you return.</p> : null}
              {selected.summary ? <p className="academy-player-summary">{selected.summary}</p> : null}
              {selected.lesson_type === "article" ? <div className="article-copy">{selected.body || "No reading content has been added yet."}</div> : null}
              {selected.lesson_type === "quiz" ? <div className="academy-quiz">
                {quizQuestions.length === 0 && !loadingVideo && !error ? <p>This assessment has not been authored yet.</p> : null}
                {quizQuestions.map((question, index) => <fieldset key={question.id} className="academy-question">
                  <legend>{index + 1}. {question.prompt}</legend>
                  {question.choices.map((choice, optionIndex) =>
                    <label key={optionIndex} className="academy-choice">
                      <input
                        type="radio" name={"answer-" + question.id}
                        checked={quizAnswers[question.id] === optionIndex}
                        disabled={quizResult?.passed || progressBusy}
                        onChange={() => setQuizAnswers(items => ({ ...items, [question.id]: optionIndex }))}
                      />
                      <span>{choice}</span>
                    </label>)}
                </fieldset>)}
                {quizResult ? <div role="status" className="academy-quiz-result">
                  <strong>{quizResult.passed ? "Assessment passed" : "Keep learning and try again"}</strong>
                  <p>Score: {quizResult.scorePct}% · Required: {quizResult.requiredPct}%</p>
                </div> : null}
                {quizQuestions.length > 0 && !quizResult?.passed ? <button
                  type="button" className="button" disabled={progressBusy || quizQuestions.some(q => quizAnswers[q.id] === undefined)}
                  onClick={() => void submitQuiz(selected)}>Submit assessment</button> : null}
              </div> : null}
              {!video && !loadingVideo && selected.lesson_type === "video" && !error ? <div className="notice">This video has not been uploaded yet.</div> : null}
              <div className="academy-player-actions">
                {selected.lesson_type === "article" ? <button type="button" className="button" disabled={progressBusy} onClick={() => void saveProgress(selected, 0, true)}>Mark reading complete</button> : null}
                {nextLesson ? <button type="button" className="button" onClick={() => void openLesson(nextLesson)}>Next lesson <ArrowRight size={16} /></button> : null}
                <button type="button" className="academy-back-lessons" onClick={()=>{
                  if(playerRef.current&&!playerRef.current.paused)playerRef.current.pause();
                  ++loadSeq.current;
                  setSelected(null);setVideo(null);setError(null);setVideoIssue(null);
                }}>Back to course modules</button>
              </div>
            </section> : null}
                </div>
              </> : null}
            </dialog>
            <section id="certificates" className="academy-certificates">
              <div className="section-title"><h2>My certificates</h2></div>
              {certificates.length === 0 ? <p>No completion certificates yet. Complete your lessons and required assessments to earn one.</p>
                : certificates.map(cert => {
                  const course = courses.find(c => c.id === cert.course_id);
                  return <div className="academy-award" key={cert.verification_code}>
                    <Award size={24} />
                    <div><strong>{cert.course_title || course?.title || "MD Academy Course"} — Completed</strong>
                      <small>Issued {new Date(cert.issued_at).toLocaleDateString()} · Code {cert.verification_code}</small>
                      <Link href={"/school/certificate?code=" + encodeURIComponent(cert.verification_code)} className="academy-print-link">View and print certificate</Link>
                    </div>
                  </div>;
                })}
            </section>
          </> : null}
        </main>
        <footer>MD Academy · Powered by UniteHQ</footer>
      </div>
    </div>
  );
}
