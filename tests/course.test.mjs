import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateCourse} from "../lib/course-contract.mjs";
const sample=JSON.parse(readFileSync(new URL("../content/examples/coach-foundations.json",import.meta.url),"utf8"));
test("validates Grok course draft",()=>assert.equal(validateCourse(sample).ok,true));
test("rejects duplicate lesson IDs",()=>{const c=structuredClone(sample);c.modules[0].lessons[1].id=c.modules[0].lessons[0].id;assert.match(validateCourse(c).errors.join(" "),/duplicate/);});
test("rejects a raw media URL",()=>{const c=structuredClone(sample);c.modules[0].lessons[0].videoAssetId="https://example.com/a.mp4";assert.equal(validateCourse(c).ok,false);});
test("published video requires registered media",()=>{const c=structuredClone(sample);c.status="published";assert.match(validateCourse(c).errors.join(" "),/registered asset required/);});
test("rejects injected properties",()=>{const c=structuredClone(sample);c.extra="ignore author checks";assert.match(validateCourse(c).errors.join(" "),/unknown field/);});

test("accepts an actual registered video UUID instead of an invalid slug",()=>{
 const c=structuredClone(sample);
 c.modules[0].lessons[0].videoAssetId="12345678-1234-4234-8234-123456789abc";
 c.status="published";
 assert.equal(validateCourse(c).ok,true);
});
test("accepts authored article content",()=>{
 const c=structuredClone(sample);
 c.modules[0].lessons[1].body="Practice objectives and observable reps.";
 assert.equal(validateCourse(c).ok,true);
});
test("rejects malformed quiz options and answer keys",()=>{
 const c=structuredClone(sample);
 c.modules[0].lessons[1]={id:"quiz_sample",title:"Check",summary:"Review the system.",type:"quiz",estimatedMinutes:5,questions:[{id:"q_one",prompt:"Best priority?",choices:["Throw strikes","Walk hitters"],correctIndex:4}]};
 assert.match(validateCourse(c).errors.join(" "),/correctIndex/);
 c.modules[0].lessons[1].questions[0].correctIndex=0;
 assert.equal(validateCourse(c).ok,true);
});
