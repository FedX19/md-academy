import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const server=readFileSync("lib/academy-server.ts","utf8");

test("Academy editors require current internal MDC staff permission",()=>{
 assert.match(server,/client\.rpc\("academy_can_author"\)/);
 assert.match(server,/roles\.error \|\| profile\.error \|\| authorCheck\.error \|\| publishCheck\.error/);
 assert.match(server,/authorCheck\.data === true && \(publisher \|\| roles\.data\?\.role === "editor"\)/);
});
test("even publisher privileges require current internal MDC staff permission",()=>{
 assert.match(server,/client\.rpc\("academy_can_publish"\)/);
 assert.match(server,/publishCheck\.data === true/);
 assert.match(server,/publisher = \(platformAdmin \|\| roles\.data\?\.role === "admin"\)/);
 assert.doesNotMatch(server,/const publisher = platformAdmin \|\| roles/);
});
