import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Mobile academy has a sticky real-logo header with working hamburger menu",()=>{
 const ui=read("components/school-client.tsx");
 const css=read("app/globals.css");
 assert.match(ui,/className="academy-mobile-brand"/);
 assert.match(ui,/src="\/brand\/md-academy\.svg"/);
 assert.match(ui,/className="academy-mobile-menu-toggle"/);
 assert.match(ui,/aria-expanded=\{mobileMenuOpen\}/);
 assert.match(ui,/aria-controls="academy-mobile-menu"/);
 assert.match(ui,/className="academy-mobile-menu-scrim"/);
 assert.match(ui,/onClick=\{\(\)=>setMobileMenuOpen\(false\)\}/);
 assert.match(ui,/window\.addEventListener\("keydown",onEscape\)/);
 assert.match(css,/\.topbar\{[\s\S]*?position:sticky;top:0;z-index:50/);
 assert.match(css,/\.topbar \.academy-mobile-menu\{/);
});
test("Mobile learner goes directly to resume, courses and certificates",()=>{
 const ui=read("components/school-client.tsx");
 const css=read("app/globals.css");
 const intro=ui.indexOf('<div className="intro">');
 const resume=ui.indexOf('className="academy-continue-card"');
 const courses=ui.indexOf('id="courses"');
 const certs=ui.indexOf('id="certificates"');
 assert.ok(intro<resume&&resume<courses&&courses<certs);
 assert.match(css,/\.content>\.intro,\.content \.benefits\{display:none\}/);
 assert.match(css,/\.content \.academy-continue-card\{/);
 assert.match(css,/\.content \.academy-certificates\{/);
 assert.match(ui,/goToClassroomSection\("courses"\)/);
 assert.match(ui,/goToClassroomSection\("certificates"\)/);
});
test("Menu preserves learner, preview, admin and sign-out actions",()=>{
 const ui=read("components/school-client.tsx");
 assert.match(ui,/openLessonFromCourse\(resumeTarget,resumeCourse\)/);
 assert.match(ui,/Exit Coach Preview/);
 assert.match(ui,/Admin Studio/);
 assert.match(ui,/void signOut\(\)/);
 assert.match(ui,/setMobileMenuOpen\(false\)/);
});
