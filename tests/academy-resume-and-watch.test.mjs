import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("academy learner resumes by account and shows real progress",()=>{
 const ui=read("components/school-client.tsx");
 assert.match(ui,/resumeLesson\(course: Course\)/);
 assert.match(ui,/Continue Learning/);
 assert.match(ui,/role="progressbar"/);
 assert.match(ui,/updated_at/);
 assert.match(ui,/onLoadedMetadata=\{event/);
});
test("video completion uses server-timed RPC not client-supplied completed flags",()=>{
 const ui=read("components/school-client.tsx");
 const api=read("app/api/academy/watch/route.ts");
 const progress=read("app/api/academy/progress/route.ts");
 assert.match(ui,/academy\/watch/);
 assert.match(ui,/onEnded=\{event=>reportWatch/);
 assert.doesNotMatch(ui,/onEnded=\{event => void saveProgress/);
 assert.match(api,/academy_video_heartbeat/);
 assert.match(progress,/lesson\.lesson_type==="quiz"\|\|lesson\.lesson_type==="video"/);
});
