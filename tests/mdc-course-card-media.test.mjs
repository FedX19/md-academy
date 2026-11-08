import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("Official Modern Day Coach mark replaces generic MD on warm Academy course artwork",()=>{
 const ui=read("components/school-client.tsx"),css=read("app/globals.css");
 assert.match(ui,/src="\/brand\/mdc-logo-clear-white\.png"/);
 assert.match(ui,/alt="Modern Day Coach"/);
 assert.doesNotMatch(ui,/<div className="course-art"><span>MD<\/span>/);
 assert.match(css,/\.course-art\{[^}]*linear-gradient\(140deg,#68321a,#121518 70%\)/);
 assert.match(css,/\.course-art \.academy-course-logo/);
 assert.ok(readFileSync(new URL("../public/brand/mdc-logo-clear-white.png",import.meta.url)).length>10000);
});
test("Existing signed videos show decode/network-aware errors and allow one-tap retry",()=>{
 const ui=read("components/school-client.tsx");
 assert.match(ui,/media\.error\?\.code/);
 assert.match(ui,/onLoadedData=\{\(\)=>setVideoIssue\(null\)\}/);
 assert.match(ui,/Retry video/);
 assert.match(ui,/onClick=\{\(\)=>void openLesson\(selected\)\}/);
 assert.match(ui,/H\.264 video with AAC audio/);
});
test("HEVC/AV1 MP4 upload is rejected before saving to private Storage",()=>{
 const admin=read("components/admin/admin-studio.tsx");
 assert.match(admin,/detectMdcMp4Encoding\(file\)/);
 assert.match(admin,/file\.slice\(0,Math\.min\(file\.size,windowSize\)\)/);
 assert.match(admin,/encoding==="hevc"/);
 assert.match(admin,/encoding==="av1"/);
 assert.match(admin,/contentType:mime,upsert:false/);
});
