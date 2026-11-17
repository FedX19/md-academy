import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Academy sign-out ends local Academy session and returns to UniteHQ, not Academy SSO",()=>{
 const school=read("components/school-client.tsx");
 const studio=read("components/admin/admin-studio.tsx");
 for(const source of [school,studio]){
   assert.match(source,/auth\.signOut\(\{ scope: "local" \}\)/);
   assert.match(source,/window\.location\.replace\("https:\/\/app\.unite-hq\.com\/platform"\)/);
   assert.doesNotMatch(source,/window\.location\.replace\("\/"\)/);
 }
});

test("All Academy entry, classroom and staff views have direct return links",()=>{
 const entrance=read("components/brand/entrance-screen.tsx");
 const school=read("components/school-client.tsx");
 const studio=read("components/admin/admin-studio.tsx");
 assert.match(entrance,/Back to UniteHQ/);
 assert.match(school,/academy-return-link/);
 assert.match(school,/Back to UniteHQ/);
 assert.match(school,/academy-mobile-menu/);
 assert.match(studio,/studio-return-link/);
 assert.match(studio,/studio-mobile-return/);
 assert.match(studio,/studio-mobile-menu/);
 assert.match(studio,/Back to UniteHQ/);
});

test("Verified editors can use View as Client without granting publish permissions",()=>{
 const studio=read("components/admin/admin-studio.tsx");
 const server=read("lib/academy-server.ts");
 const preview=read("app/api/academy/admin/preview/route.ts");
 assert.match(studio,/type View = "overview"\|"curriculum"\|"client"/);
 assert.match(studio,/View as Client/);
 assert.match(studio,/view==="client"/);
 assert.match(studio,/\/admin\/preview\?courseId=/);
 assert.match(server,/const author = authorCheck\.data === true/);
 assert.match(server,/publishCheck\.data === true/);
 assert.match(preview,/!identity\?\.author/);
});
