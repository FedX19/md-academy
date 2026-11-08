"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, PlayCircle, CheckCircle2, ArrowRight, ShieldCheck, GraduationCap, LoaderCircle, LockKeyhole, Award } from "lucide-react";
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

export function SchoolClient({ previewCourseId }: { previewCourseId?: string } = {}) {
  const isPreview = Boolean(previewCourseId);
  const [user, setUser] = useState<Viewer | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [video, setVideo] = useState<string | null>(null);
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
  function reportWatch(lesson: Lesson,seconds:number,event:"tick"|"pause"|"ended"){
    if (isPreview) { previewProgress(lesson,seconds,event==="ended"); return; }
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
            setUser({ name: "League Coach (Preview)", admin: false });
            setCourses([response.course]);
            setProgress([]);
            setCertificates([]);
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
  }, [previewCourseId]);

  async function openLesson(lesson: Lesson) {
    const seq = ++loadSeq.current;
    setSelected(lesson);
    watchSession.current=null;
    watchQueue.current=Promise.resolve();
    setError(null);
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
  const selectedCourse = selected ? visible.find(course => sortedLessons(course).some(lesson => lesson.id === selected.id)) : null;
  const lessonSequence = selectedCourse ? sortedLessons(selectedCourse) : [];
  const nextIndex = selected ? lessonSequence.findIndex(lesson => lesson.id === selected.id) + 1 : 0;
  const nextLesson = lessonSequence[nextIndex] ?? null;
  const completedCount = progress.filter(p => p.completed_at).length;
  const resumeCourse = visible.find(course => resumeLesson(course)) ?? null;
  const resumeTarget = resumeCourse ? resumeLesson(resumeCourse) : null;
  const resumeRecord = resumeTarget ? progress.find(p => p.lesson_id===resumeTarget.id) : null;

  return (
    <div className="school">
      <aside className="sidebar">
        <Link href="/"><Image src="/brand/md-academy.svg" alt="MD Academy" width={190} height={190} /></Link>
        <div className="nav-label">YOUR COACHING SCHOOL</div>
        <nav>
          <a href="#courses"><BookOpen size={18} /> My Courses</a>
          <a href="#courses"><PlayCircle size={18} /> Continue Learning</a>
          <a href="#certificates"><Award size={18} /> Certificates</a>
          {user?.admin ? <Link href="/admin"><GraduationCap size={18} /> Academy Admin Studio</Link> : null}
        </nav>
        <p className="sidebar-bottom">Learn it. Apply it. Repeat.</p>
      </aside>
      <div className="workspace">
        {isPreview ? <div className="academy-preview-banner" role="status">
          <span><strong>PREVIEW AS LEAGUE COACH</strong> · Draft preview only. Your activity is simulated and will not be saved or issue a certificate.</span>
          <Link href="/admin">Back to Course Builder <ArrowRight size={15}/></Link>
        </div> : null}
        <header className="topbar"><span>MODERN DAY COACH <b>/ ACADEMY</b></span>
          <div className="school-account-actions">
            {user?.admin ? <Link className="school-signout" href="/admin">Admin Studio</Link> : null}
            {isPreview ? <Link className="school-signout" href="/admin">Exit Preview</Link> : <button type="button" className="school-signout" onClick={() => void signOut()}>Sign out</button>}
          </div>
        </header>
        <main className="content">
          <div className="intro">
            <span className="eyebrow">MD ACADEMY</span>
            <h1>YOUR COACHING <em>CLASSROOM.</em></h1>
            <p>{user ? "Welcome, " + user.name + ". Pick up where you left off." : "Connecting your UniteHQ account…"}</p>
          </div>
          {loading ? <p role="status" className="loading-status"><LoaderCircle size={18} /> Loading your courses…</p> : null}
          {error ? <div role="alert" className="notice">{error} {!user && !loading ? <a href="/auth/start"> Sign in through UniteHQ</a> : null}</div> : null}
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
              <button type="button" className="academy-continue-button" onClick={()=>void openLesson(resumeTarget)}>
                <PlayCircle size={19}/> Continue Learning <ArrowRight size={16}/>
              </button>
            </section> : null}
            <div className="section-title" id="courses"><h2>My courses</h2></div>
            {visible.length === 0 ? <p className="notice">No courses are assigned yet. Ask an MDC Academy administrator to enroll you.</p>
              : <div className="course-grid">
                {visible.map(course => {
                  const lessons = sortedLessons(course);
                  const done = lessons.filter(l => progress.some(p => p.lesson_id === l.id && p.completed_at)).length;
                  return <div className="course" key={course.id}>
                    <div className="course-art"><span>MD</span><small>{isPreview ? "COACH TRAINING" : course.status.toUpperCase()}</small></div>
                    <div className="course-copy">
                      <h3>{course.title}</h3><p>{course.summary}</p>
                      <div>{done} / {lessons.length} complete <ArrowRight size={16} /></div>
                      <div className="academy-progress-track" role="progressbar" aria-label={course.title+" progress"}
                        aria-valuemin={0} aria-valuemax={100} aria-valuenow={lessons.length?Math.round(done/lessons.length*100):0}>
                        <span style={{width:(lessons.length?Math.round(done/lessons.length*100):0)+"%"}}/>
                      </div>
                      {resumeLesson(course) ? <button type="button" className="academy-resume-course" onClick={()=>void openLesson(resumeLesson(course)!)}>
                        <PlayCircle size={16}/> {progress.some(p=>sortedLessons(course).some(l=>l.id===p.lesson_id))?"Resume course":"Start course"}
                      </button> : null}
                      {!isPreview && course.status === "published" && lessons.length > 0 && done === lessons.length && !certificates.some(cert => cert.course_id === course.id)
                        ? <button type="button" className="academy-cert-button" disabled={progressBusy} onClick={() => void issueCertificate(course.id)}><Award size={17} /> Claim completion certificate</button> : null}
                      {course.academy_modules?.slice().sort((a, b) => a.sort_order - b.sort_order).map(module =>
                        <section key={module.id}>
                          <div className="academy-module-heading"><h4>{module.title}</h4>
                            <small>{module.academy_lessons.filter(l=>progress.some(p=>p.lesson_id===l.id&&p.completed_at)).length} / {module.academy_lessons.length} lessons</small>
                          </div>
                          <div className="academy-progress-track academy-module-track" role="progressbar" aria-label={module.title+" progress"}
                            aria-valuemin={0} aria-valuemax={100}
                            aria-valuenow={module.academy_lessons.length?Math.round(module.academy_lessons.filter(l=>progress.some(p=>p.lesson_id===l.id&&p.completed_at)).length/module.academy_lessons.length*100):0}>
                            <span style={{width:(module.academy_lessons.length?Math.round(module.academy_lessons.filter(l=>progress.some(p=>p.lesson_id===l.id&&p.completed_at)).length/module.academy_lessons.length*100):0)+"%"}}/>
                          </div>
                          {module.academy_lessons?.slice().sort((a, b) => a.sort_order - b.sort_order).map(lesson =>
                            <button type="button" className="school-lesson" key={lesson.id} onClick={() => void openLesson(lesson)}>
                              {progress.some(p => p.lesson_id === lesson.id && p.completed_at) ? <CheckCircle2 size={15} /> : <PlayCircle size={15} />}
                              {lesson.title}
                            </button>)}
                        </section>)}
                    </div>
                  </div>;
                })}
              </div>}
            {selected ? <section className="academy-player" id="learning">
              <span className="eyebrow">NOW LEARNING</span>
              <h2>{selected.title}</h2><p>{selected.summary}</p>
              {loadingVideo ? <div role="status" className="player-placeholder">Loading your video…</div> : null}
              {video && selected.lesson_type === "video" ? <video
                key={selected.id} controls playsInline preload="metadata" src={video}
                onLoadedMetadata={event => {
                  const prior = progress.find(p => p.lesson_id === selected.id)?.position_seconds ?? 0;
                  const duration = event.currentTarget.duration;
                  if (prior > 5 && Number.isFinite(duration) && prior < duration - 5) event.currentTarget.currentTime = prior;
                }}
                onPlay={event=>{void beginWatch(selected,event.currentTarget.currentTime);}}
                onTimeUpdate={event=>{
                  const seconds=Math.floor(event.currentTarget.currentTime);
                  if(seconds-(lastSave.current[selected.id]??0)>=12){
                    lastSave.current[selected.id]=seconds;
                    reportWatch(selected,seconds,"tick");
                  }
                }}
                onPause={event=>{if(!event.currentTarget.ended)reportWatch(selected,event.currentTarget.currentTime,"pause");}}
                onEnded={event=>reportWatch(selected,event.currentTarget.currentTime,"ended")}
                onError={() => setError("Playback was interrupted. Reopen this lesson to renew your video link.")}
              /> : null}
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
              </div>
            </section> : null}
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
