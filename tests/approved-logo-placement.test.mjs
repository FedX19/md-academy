import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const source=(p)=>readFile(new URL("../"+p,import.meta.url),"utf8");
test("Academy uses approved icon in entry, auth, classroom and Admin Studio",async()=>{
 for(const path of ["components/brand/entrance-screen.tsx","components/brand/auth-transition-screen.tsx","components/school-client.tsx","components/admin/admin-studio.tsx"]){
  const ui=await source(path);
  assert.match(ui,/src="\/brand\/md-academy-app-icon\.svg"/,path);
  assert.doesNotMatch(ui,/src="\/brand\/md-academy\.svg"/,path);
 }
 const classroom=await source("components/school-client.tsx"),admin=await source("components/admin/admin-studio.tsx");
 assert.match(classroom,/academy-desktop-header-icon/);
 assert.match(classroom,/academy-mobile-brand/);
 assert.match(admin,/academy-studio-header-icon/);
 assert.match(admin,/studio-mobile-brand/);
 assert.match(admin,/Opening Academy Admin Studio/);
});
