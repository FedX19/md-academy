"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, PlayCircle, CheckCircle2, ArrowRight, ShieldCheck, GraduationCap, LoaderCircle, LockKeyhole } from "lucide-react";
import { academyRequest, browserAcademyClient } from "@/lib/academy-client";

type Lesson = { id: string; title: string; summary: string; body: string; lesson_type: "video" | "article" | "quiz"; duration_seconds: number; sort_order: number };
type Module = { id: string; title: string; sort_order: number; academy_lessons: Lesson[] };
type Course = { id: string; slug: string; title: string; summary: string; status: string; academy_modules: Module[] };
type Progress = { lesson_id: string; position_seconds: number; completed_at: string | null };
type Viewer = { name: string; admin: boolean };

function sortedLessons(course: Course) {
  return (course.academy_modules ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
    .flatMap(m => (m.academy_lessons ?? []).slice().sort((a, b) => a.sort_order - b.sort_order));
}

export function SchoolClient() {
  const [user, setUser] = useState<Viewer | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressBusy, setProgressBusy] = useState(false);
  const lastSave = useRef<Record<string, number>>({});
  const loadSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const me = await academyRequest<{ user: Viewer }>("/api/academy/me");
        const [catalog, history] = await Promise.all([
          academyRequest<{ courses: Course[] }>("/api/academy/courses"),
          academyRequest<{ progress: Progress[] }>("/api/academy/progress"),
        ]);
        if (!cancelled) {
          setUser(me.user);
          setCourses(catalog.courses);
          setProgress(history.progress);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Academy is unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function openLesson(lesson: Lesson) {
    const seq = ++loadSeq.current;
    setSelected(lesson);
    setError(null);
    setVideo(null);
    setLoadingVideo(lesson.lesson_type === "video");
    if (lesson.lesson_type !== "video") return;
    try {
      const result = await academyRequest<{ url: string }>("/api/academy/playback", {
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

  async function signOut() {
    await browserAcademyClient()?.auth.signOut();
    window.location.replace("/");
  }

  const visible = courses.filter(course => course.status === "published" || user?.admin);
  const selectedCourse = selected ? visible.find(course => sortedLessons(course).some(lesson => lesson.id === selected.id)) : null;
  const lessonSequence = selectedCourse ? sortedLessons(selectedCourse) : [];
  const nextIndex = selected ? lessonSequence.findIndex(lesson => lesson.id === selected.id) + 1 : 0;
  const nextLesson = lessonSequence[nextIndex] ?? null;
  const completedCount = progress.filter(p => p.completed_at).length;

  return (
    <div className="school">
      <aside className="sidebar">
        <Link href="/"><Image src="/brand/md-academy.svg" alt="MD Academy" width={190} height={190} /></Link>
        <div className="nav-label">YOUR COACHING SCHOOL</div>
        <nav>
          <a href="#courses"><BookOpen size={18} /> My Courses</a>
          <a href="#learning"><PlayCircle size={18} /> Continue Learning</a>
        </nav>
        <p className="sidebar-bottom">Learn it. Apply it. Repeat.</p>
      </aside>
      <div className="workspace">
        <header className="topbar"><span>MODERN DAY COACH <b>/ ACADEMY</b></span>
          <button type="button" className="school-signout" onClick={() => void signOut()}>Sign out</button>
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
            <div className="section-title" id="courses"><h2>My courses</h2></div>
            {visible.length === 0 ? <p className="notice">No courses are assigned yet. Ask an MDC Academy administrator to enroll you.</p>
              : <div className="course-grid">
                {visible.map(course => {
                  const lessons = sortedLessons(course);
                  const done = lessons.filter(l => progress.some(p => p.lesson_id === l.id && p.completed_at)).length;
                  return <div className="course" key={course.id}>
                    <div className="course-art"><span>MD</span><small>{course.status.toUpperCase()}</small></div>
                    <div className="course-copy">
                      <h3>{course.title}</h3><p>{course.summary}</p>
                      <div>{done} / {lessons.length} complete <ArrowRight size={16} /></div>
                      {course.academy_modules?.slice().sort((a, b) => a.sort_order - b.sort_order).map(module =>
                        <section key={module.id}>
                          <h4>{module.title}</h4>
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
                onTimeUpdate={event => {
                  const seconds = Math.floor(event.currentTarget.currentTime);
                  if (seconds > 0 && seconds - (lastSave.current[selected.id] ?? 0) >= 20) {
                    lastSave.current[selected.id] = seconds;
                    void saveProgress(selected, seconds, false);
                  }
                }}
                onPause={event => { if (!event.currentTarget.ended) void saveProgress(selected, event.currentTarget.currentTime, false); }}
                onEnded={event => void saveProgress(selected, event.currentTarget.duration, true)}
                onError={() => setError("Playback was interrupted. Reopen this lesson to renew your video link.")}
              /> : null}
              {selected.lesson_type === "article" ? <div className="article-copy">{selected.body || "No reading content has been added yet."}</div> : null}
              {selected.lesson_type === "quiz" ? <div className="notice"><LockKeyhole size={18} /> Assessments require verified grading and cannot be marked complete from the video player.</div> : null}
              {!video && !loadingVideo && selected.lesson_type === "video" && !error ? <div className="notice">This video has not been uploaded yet.</div> : null}
              <div className="academy-player-actions">
                {selected.lesson_type === "article" ? <button type="button" className="button" disabled={progressBusy} onClick={() => void saveProgress(selected, 0, true)}>Mark reading complete</button> : null}
                {nextLesson ? <button type="button" className="button" onClick={() => void openLesson(nextLesson)}>Next lesson <ArrowRight size={16} /></button> : null}
              </div>
            </section> : null}
          </> : null}
        </main>
        <footer>MD Academy · Powered by UniteHQ</footer>
      </div>
    </div>
  );
}
