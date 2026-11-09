import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const server=readFileSync("lib/academy-server.ts","utf8");

test("verified Academy editor must retain an active MDC staff role",()=>{
 assert.match(server,/client\.rpc\("academy_can_author"\)/);
 assert.match(server,/roles\.error \|\| profile\.error \|\| authorCheck\.error/);
 assert.match(server,/roles\.data\?\.role === "editor" && authorCheck\.data === true/);
});
test("existing platform admins and Academy publishers stay authorized",()=>{
 assert.match(server,/const publisher = platformAdmin \|\| roles\.data\?\.role === "admin"/);
 assert.match(server,/const author = publisher \|\|/);
});
