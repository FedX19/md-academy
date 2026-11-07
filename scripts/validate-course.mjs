#!/usr/bin/env node
import {readFile} from "node:fs/promises";
import {validateCourse} from "../lib/course-contract.mjs";
const path=process.argv[2];
if(!path){console.error("Usage: node scripts/validate-course.mjs <course.json>");process.exit(2)}
try{
 const content=JSON.parse(await readFile(path,"utf8"));
 const result=validateCourse(content);
 if(!result.ok){for(const error of result.errors)console.error(error);process.exitCode=1}
 else console.log("Validated "+content.slug+" ("+content.modules.length+" module(s))");
}catch(error){console.error("Invalid course document: "+error.message);process.exitCode=1}
