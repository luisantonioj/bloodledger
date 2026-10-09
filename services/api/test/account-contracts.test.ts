import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
test('FR-12/16 published account and onboarding contracts contain no unresolved internal schema references',()=>{
  for(const name of ['openapi.json','openapi-v2.json']){
    const document=JSON.parse(readFileSync(new URL(`../../${name}`,import.meta.url),'utf8')) as Record<string,unknown>;
    function visit(value:unknown):void{
      if(!value||typeof value!=='object')return;
      const row=value as Record<string,unknown>;
      if(typeof row.$ref==='string'&&row.$ref.startsWith('#/')){
        let target:unknown=document;
        for(const part of row.$ref.slice(2).split('/'))target=(target as Record<string,unknown>|undefined)?.[part.replaceAll('~1','/').replaceAll('~0','~')];
        assert.ok(target,`${name}: ${row.$ref}`);
      }
      for(const item of Object.values(row))visit(item);
    }
    visit(document);
  }
});
