import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("admin studio matches mobile classroom branding and accessible hamburger navigation",()=>{
 const ui=read("components/admin/admin-studio.tsx"),css=read("app/admin/admin.css");
 assert.match(ui,/className="studio-mobile-brand"/);
 assert.match(ui,/src="\/brand\/md-academy\.svg"/);
 assert.match(ui,/className="studio-mobile-menu-toggle"/);
 assert.match(ui,/aria-expanded=\{mobileMenuOpen\}/);
 assert.match(ui,/aria-controls="studio-mobile-menu"/);
 assert.match(ui,/studio-mobile-menu-scrim/);
 assert.match(ui,/window\.addEventListener\("keydown",onEscape\)/);
 assert.match(css,/\.studio-topbar\{[\s\S]*?position:sticky;top:0;z-index:55/);
 assert.match(css,/\.studio-sidebar\{display:none\}/);
 assert.match(css,/\.studio-mobile-menu button\.active/);
});
test("course building appears before administrative statistics on small phones",()=>{
 const ui=read("components/admin/admin-studio.tsx"),css=read("app/admin/admin.css");
 const heading=ui.indexOf('className="studio-page-heading"');
 const resume=ui.indexOf('className="studio-mobile-resume"');
 const stats=ui.indexOf('className="studio-stats"');
 const list=ui.indexOf('className="studio-list-heading"');
 assert.ok(heading<resume&&resume<stats&&stats<list);
 assert.match(ui,/continueBuilding=courses\.find\(course=>course\.status==="draft"\)/);
 assert.match(ui,/onClick=\{\(\)=>openCourse\(continueBuilding\)\}/);
 assert.match(css,/\.studio-content \.studio-stats\{display:none\}/);
 assert.match(css,/\.studio-mobile-resume\{/);
});
test("module and lesson editor stays usable without scrolling through entire outline",()=>{
 const ui=read("components/admin/admin-studio.tsx"),css=read("app/admin/admin.css");
 assert.match(ui,/aria-expanded=\{mobileOutlineOpen\} aria-controls="studio-course-outline"/);
 assert.match(ui,/id="studio-course-outline"/);
 assert.match(ui,/studio-outline-collapsed/);
 assert.match(ui,/id="studio-editor-focus"/);
 assert.match(ui,/function showMobileEditor\(\)/);
 assert.match(ui,/scrollIntoView\(\{behavior:"smooth",block:"start"\}\)/);
 assert.match(css,/\.studio-editor-layout \.studio-outline-collapsed\{display:none\}/);
});
test("menu retains role-scoped coach assignments and normal sign-out",()=>{
 const ui=read("components/admin/admin-studio.tsx");
 assert.match(ui,/viewer\?\.publisher \? <button/);
 assert.match(ui,/navigateMobile\("coaches"\)/);
 assert.match(ui,/href="\/school"/);
 assert.match(ui,/void signOut\(\)/);
 assert.match(ui,/function navigateMobile\(target:View\)/);
});
