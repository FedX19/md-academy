import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("Academy SSO loading and error screen matches the main entrance scale",()=>{
  const component=read("components/brand/auth-transition-screen.tsx");
  const finish=read("app/auth/finish/page.tsx");
  const entry=read("components/brand/entrance-screen.tsx");
  for(const cls of ["academy-entry-logo-wrap","academy-entry-logo","academy-entry-tagline","academy-entry-footer","academy-entrance"]){
    assert.ok(component.includes(cls),`Missing shared entrance styling: ${cls}`);
    assert.ok(entry.includes(cls),`Main entrance missing shared styling: ${cls}`);
  }
  assert.match(component,/Signing you in…/);
  assert.match(component,/role="alert"/);
  assert.match(component,/href="\/auth\/start"/);
  assert.doesNotMatch(finish,/CONNECTING\s*<em>|className="entry"|Opening your coaching school/);
  assert.match(finish,/AuthTransitionScreen error=\{error\}/);
  assert.match(finish,/fallback=\{<AuthTransitionScreen/);
  assert.match(finish,/window\.location\.replace\(user\.admin\?"\/admin":"\/school"\)/);
});
