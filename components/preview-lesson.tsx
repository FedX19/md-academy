"use client";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {useState} from "react";
import {ArrowLeft,ArrowRight,BookOpen,CheckCircle2,Circle,Play,LockKeyhole} from "lucide-react";
import {previewCourses} from "@/lib/demo";
export function PreviewLesson(){
 const query=useSearchParams();
 const course=previewCourses.find(c=>c.slug===query.get("course"))??previewCourses[0];
 const [current,setCurrent]=useState(0);
 const [completed,setCompleted]=useState<string[]>([]);
 const title=course.lessons[current];
 const percent=Math.round(100*completed.length/course.lessons.length);
 const done=completed.includes(title);
 function next(){setCompleted(items=>items.includes(title)?items:[...items,title]);if(current<course.lessons.length-1)setCurrent(i=>i+1);}
 return <><Link href="/demo/courses" className="back"><ArrowLeft size={16}/> All courses</Link><div className="lesson-head"><div><span className="eyebrow">SAMPLE LEARNING PATH</span><h1>{course.title}</h1><p>{course.summary}</p></div><strong>{percent}%</strong></div><div className="progress-track"><span style={{width:percent+"%"}}/></div><div className="lesson-layout"><section><div className="lesson-video"><BookOpen size={90} strokeWidth={1}/><div><Play size={21} fill="currentColor"/></div><strong>VIDEO PLACEHOLDER</strong><small>Real videos will load privately from Supabase Storage after enrollment is configured.</small></div><div className="lesson-copy"><span className="eyebrow">LESSON {current+1} OF {course.lessons.length}</span><h2>{title}</h2><p>Sample lesson metadata for the MD Academy interface. This is not a published training video.</p></div><div className="lesson-actions"><button type="button" disabled={current===0} onClick={()=>setCurrent(i=>i-1)}>Previous</button><button type="button" onClick={next} className="button">{done?"Continue":"Mark preview complete"} <ArrowRight size={17}/></button></div><p className="privacy-note"><LockKeyhole size={16}/> This checklist is only a local screen preview, not real course credit.</p></section><aside className="outline"><h3>Course outline</h3><p>{completed.length} of {course.lessons.length} preview steps completed</p>{course.lessons.map((lesson,i)=><button type="button" key={lesson} className={current===i?"selected":""} onClick={()=>setCurrent(i)}>{completed.includes(lesson)?<CheckCircle2 size={18} className="done"/>:<Circle size={18}/>}<span>{lesson}</span></button>)}</aside></div></>;
}
