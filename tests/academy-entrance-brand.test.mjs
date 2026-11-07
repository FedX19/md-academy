import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Academy entry uses the same compact one-tap layout as other MDC apps",()=>{
  const component=read("components/brand/entrance-screen.tsx");
  const css=read("app/globals.css");
  assert.match(component,/src="\/brand\/md-academy\.svg"/);
  assert.match(component,/Learn the coaching system\./);
  assert.match(component,/Enter MD Academy/);
  assert.match(component,/href="\/api\/auth\/start"/);
  assert.match(component,/Powered by/);
  assert.doesNotMatch(component,/>ENTER\s*<em>|font-size:\s*clamp\(34px,5vw,70px\)/);
  assert.match(css,/\.academy-entry-logo-wrap\{width:min\(64vw,260px\)/);
  assert.match(css,/\.academy-entry-button\{[\s\S]*?min-height:56px/);
  assert.match(css,/\.academy-entry-tagline\{[\s\S]*?font-size:11px/);
});
test("Home and sign-in entry share a single style and one-click UniteHQ SSO",()=>{
  assert.match(read("app/page.tsx"),/EntranceScreen/);
  assert.match(read("app/auth/start/page.tsx"),/EntranceScreen/);
  assert.doesNotMatch(read("app/page.tsx"),/href="\/auth\/start"/);
});
