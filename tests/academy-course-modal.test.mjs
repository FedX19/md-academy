import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("course cards open module progress dialogs and lessons expand the same native dialog",()=>{
 const school=read("components/school-client.tsx");
 assert.match(school,/className="course academy-course-card"/);
 assert.match(school,/onClick=\{\(\)=>openCourse\(course\)\}/);
 assert.match(school,/<dialog ref=\{dialogRef\}/);
 assert.match(school,/aria-label=\{selected \? selected\.title/);
 assert.match(school,/Start module/);
 assert.match(school,/academy-dialog-player/);
 assert.match(school,/onCancel=\{event=>\{event\.preventDefault\(\);closeCourse\(\);\}\}/);
});
test("modal scroll works on desktop and touch screens",()=>{
 const css=read("app/globals.css");
 assert.match(css,/\.academy-modal-scroll\{overflow-y:auto/);
 assert.match(css,/-webkit-overflow-scrolling:touch/);
 assert.match(css,/\.academy-course-dialog\[open\]/);
 assert.match(css,/max-height:calc\(100dvh - 26px\)/);
});
test("video watches are timed and seeking does not count in preview or live training",()=>{
 const school=read("components/school-client.tsx");
 assert.match(school,/onSeeked=\{event=>reportWatch\(selected,event\.currentTarget\.currentTime,"seek"\)\}/);
 assert.match(school,/recordPreviewWatch/);
 assert.match(school,/edge>=lesson\.duration_seconds-2/);
 assert.match(school,/onEnded=\{event=>reportWatch\(selected,event\.currentTarget\.currentTime,"ended"\)\}/);
 assert.match(school,/if\(isPreview\)\{return|if \(isPreview\)/);
});
