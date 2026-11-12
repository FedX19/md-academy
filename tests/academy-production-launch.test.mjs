import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("publish requires explicit server-validated audience and verified staff publisher", () => {
 const route = file("app/api/academy/admin/publish/route.ts");
 const form = file("components/admin/admin-studio.tsx");
 const validation = file("lib/academy-input.ts");
 assert.match(route, /!user\?\.publisher/);
 assert.match(route, /isAudience\(body\.audience\)/);
 assert.match(route, /\.in\("status", \["draft", "review"\]\)/);
 assert.match(route, /academy_publish_course/);
 assert.match(validation, /coach-all/);
 assert.match(form, /Who gets this course when published/);
 assert.match(form, /Individual \+ League Coaches/);
 assert.match(form, /Individual Parent Members/);
 assert.match(form, /Manual Assignment Only/);
});

test("individual members may enter the learner classroom without getting Studio access", () => {
 const user = file("app/api/academy/me/route.ts");
 const staff = file("lib/academy-server.ts");
 assert.match(user, /profile_memberships/);
 assert.match(user, /\.eq\("plan","mdc_individual"\)/);
 assert.match(user, /\.eq\("status","active"\)/);
 assert.match(user, /if\(!user\.admin&&!isIndividualMember/);
 assert.match(staff, /academy_can_author/);
 assert.match(staff, /academy_can_publish/);
 assert.match(staff, /publisher:.*|const publisher/);
});

test("manual grants and revocations remain manually owned", () => {
 const enrollment = file("app/api/academy/admin/enrollments/route.ts");
 assert.match(enrollment, /enrollment_source: "manual"/);
 assert.match(enrollment, /Only published courses can be assigned/);
 assert.match(enrollment, /!user\?\.publisher/);
});

test("public demo screens route to authenticated classroom and preview badge is gone", () => {
 const layout = file("app/demo/layout.tsx");
 const learner = file("components/school-client.tsx");
 assert.match(layout, /redirect\("\/school"\)/);
 assert.doesNotMatch(learner, /PREVIEW AS LEAGUE COACH/);
 assert.match(learner, /Your courses will appear here when MDC publishes them/);
 assert.match(learner, /ACADEMY CLASSROOM/);
});
