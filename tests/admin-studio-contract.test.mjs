import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("academy app has separate admin and learner workspaces",()=>{
 assert.match(file("app/admin/page.tsx"),/AdminStudio/);
 assert.match(file("app/school/page.tsx"),/SchoolClient/);
 assert.match(file("app/auth/finish/page.tsx"),/user.admin\?"\/admin":"\/school"/);
});
test("admin-only API checks are present on course and publishing routes",()=>{
 for(const path of ["app/api/academy/admin/courses/route.ts","app/api/academy/admin/content/route.ts","app/api/academy/admin/media/route.ts","app/api/academy/admin/questions/route.ts"]){
  assert.match(file(path),/authenticateAcademy/);
  assert.match(file(path),/user\?\.author/);
 }
 assert.match(file("app/api/academy/admin/publish/route.ts"),/user\?\.publisher/);
});
test("upload goes from browser to Supabase private storage",()=>{
 const ui=file("components/admin/admin-studio.tsx");
 assert.match(ui,/client\.storage\.from\(reservation\.bucket\)\.upload/);
 assert.match(ui,/md-academy-private|reservation\.bucket/);
 assert.match(ui,/readOnly/);
});
