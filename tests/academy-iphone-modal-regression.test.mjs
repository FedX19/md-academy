import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("iPhone modal uses explicit height instead of shrinking to the heading",()=>{
 const css=read("app/globals.css");
 const fix=css.slice(css.indexOf("/* iOS Safari dialog fix:"));
 assert.match(fix,/\.academy-course-dialog\{[\s\S]*?height:min\(88dvh,860px\)/);
 assert.match(fix,/\.academy-course-dialog,\.academy-course-dialog\.academy-dialog-player\{[\s\S]*?height:calc\(100dvh - 24px\)/);
 assert.match(fix,/\.academy-course-dialog \.academy-modal-scroll\{[\s\S]*?flex:1 1 0/);
 assert.match(fix,/overflow-y:auto/);
 assert.match(fix,/-webkit-overflow-scrolling:touch/);
 assert.match(fix,/max-height:46dvh/);
});
test("lesson failures, video loading, and retry render inside accessible modal",()=>{
 const ui=read("components/school-client.tsx");
 const start=ui.indexOf("<dialog ref={dialogRef}");
 const end=ui.indexOf("</dialog>",start);
 const inner=ui.slice(start,end);
 assert.match(inner,/className="academy-modal-feedback" role="alert"/);
 assert.match(inner,/onClick=\{\(\)=>void openLesson\(selected\)\}/);
 assert.match(inner,/Loading your lesson/);
 assert.match(inner,/className="academy-player academy-player-modal"/);
 assert.ok(inner.indexOf("Loading your lesson")<inner.indexOf("ref={playerRef}"));
 assert.match(inner,/tabIndex=\{0\}/);
 assert.match(ui,/error && !activeCourseId/);
});
test("Continue Learning sidebar and course CTA open actual selected lesson",()=>{
 const ui=read("components/school-client.tsx");
 assert.match(ui,/className="academy-nav-continue"/);
 assert.match(ui,/onClick=\{\(\)=>openLessonFromCourse\(resumeTarget,resumeCourse\)\}/);
 assert.match(ui,/openLessonFromCourse\(resumeTarget,resumeCourse\)/);
 assert.match(ui,/\+\+loadSeq\.current; \/\/ Prevent a late signed-link request/);
});
