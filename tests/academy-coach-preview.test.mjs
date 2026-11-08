import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("administrator can preview a draft in the real coach classroom without publishing", () => {
 const admin = read("components/admin/admin-studio.tsx");
 const page = read("app/admin/preview/page.tsx");
 const school = read("components/school-client.tsx");
 assert.match(admin, /Preview as League Coach/);
 assert.match(admin, /\/admin\/preview\?courseId=/);
 assert.match(page, /SchoolClient previewCourseId=/);
 assert.match(school, /PREVIEW AS LEAGUE COACH/);
 assert.match(school, /isPreview \? courses : courses\.filter/);
 assert.match(school, /setProgress\(\[\]\)/);
});
test("preview reads private draft courses, quiz questions and videos only for editors", () => {
 const route = read("app/api/academy/admin/preview/route.ts");
 assert.match(route, /authenticateAcademy\(request\)/);
 assert.match(route, /!identity\?\.author/);
 assert.match(route, /academy_quiz_questions/);
 assert.match(route, /createSignedUrl/);
 assert.doesNotMatch(route, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|academy_grade_quiz|academy_issue_certificate/);
});
test("simulated preview cannot write course progress, submit real quizzes, or claim certificates", () => {
 const school = read("components/school-client.tsx");
 assert.match(school, /if \(isPreview\) \{ previewProgress\(lesson, seconds, complete\); return; \}/);
 assert.match(school, /if \(isPreview\) \{ previewProgress\(lesson,seconds,event==="ended"\); return; \}/);
 assert.match(school, /if \(isPreview\) \{/);
 assert.match(school, /if \(isPreview \|\| progressBusy\) return/);
 assert.match(school, /setQuizResult\(\{ scorePct: score, passed, requiredPct: required/);
 assert.match(school, /Your activity is simulated/);
});
