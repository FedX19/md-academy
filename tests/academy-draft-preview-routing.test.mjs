import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(file)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
test("draft administrator courses route to isolated preview, not published playback",()=>{
 const ui=read("components/school-client.tsx");
 assert.match(ui,/function isAdminDraft\(course:Course\)/);
 assert.match(ui,/user\?\.admin===true && course\.status!=="published"/);
 assert.match(ui,/window\.location\.assign\(adminDraftPreviewUrl\(course\)\)/);
 assert.match(ui,/window\.location\.assign\(adminDraftPreviewUrl\(course,lesson\)\)/);
 assert.match(ui,/query\.set\("lessonId",lesson\.id\)/);
 assert.match(ui,/query\.set\("open","course"\)/);
});
test("preview accepts a deep link and opens requested video from its own private API",()=>{
 const ui=read("components/school-client.tsx");
 const page=read("app/admin/preview/page.tsx");
 assert.match(page,/previewLessonId=\{params\.lessonId\}/);
 assert.match(page,/previewOpenCourse=\{params\.open==="course"\}/);
 assert.match(ui,/sortedLessons\(response\.course\)\.find\(lesson=>lesson\.id===previewLessonId\)/);
 assert.match(ui,/void openLesson\(requested\)/);
 assert.match(ui,/isPreview \? "\/api\/academy\/admin\/preview" : "\/api\/academy\/playback"/);
 assert.match(ui,/if \(isPreview\) \{ previewProgress\(lesson, seconds, complete\); return; \}/);
 assert.match(ui,/if \(isPreview \|\| progressBusy\) return/);
});
test("published-only playback remains protected against unpublished and unenrolled users",()=>{
 const playback=read("app/api/academy/playback/route.ts");
 assert.match(playback,/if\(course\.status!=="published"\)/);
 assert.match(playback,/if\(!user\.admin&&!enrollment\)/);
 assert.match(playback,/Draft lessons are available only in the private staff learner review/);
});
