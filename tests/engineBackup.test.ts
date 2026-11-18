import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'vite';
import type { LeitnerCard } from '../src/core/types.ts';

test('versioned engine backup round trip preserves stories and merge does not remove existing cards', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>data.get(key)??null,
    setItem:(key:string,value:string)=>{data.set(key,value);},
    removeItem:(key:string)=>{data.delete(key);},
  }});
  try {
    // Bundle with the same toolchain as the app (which resolves its extensionless TS imports).
    const result = await build({configFile:false,logLevel:'silent',build:{write:false,minify:false,
      lib:{entry:'src/core/leitnerEngine.ts',formats:['es']}}});
    const bundle = Array.isArray(result) ? result[0] : result;
    assert.ok('output' in bundle);
    const chunk = bundle.output.find(x=>x.type==='chunk');
    assert.ok(chunk && chunk.type==='chunk');
    const {leitnerEngine:engine} = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
    const card: LeitnerCard = {id:'existing',type:'vocab',box:0,lastReviewedAt:null,nextReviewDate:'2026-11-18',createdAt:'2026-11-18T10:00:00Z',reviewCount:0,correctCount:0,wrongCount:0};
    engine.hydrate('test-user',[card],null);
    const story={storyId:'S01-Q1',page:2,totalPages:5,completedAt:null,updatedAt:'2026-11-18T10:00:00Z'};
    data.set('daf_stories_progress_test-user',JSON.stringify({'S01-Q1':story}));
    const exported=JSON.parse(engine.exportData());
    assert.equal(exported.version,'2.0');
    assert.deepEqual(exported.stories,{'S01-Q1':story});
    const imported=engine.importData(JSON.stringify({...exported,cards:[{...card,id:'incoming'}]}),'merge');
    assert.equal(imported.ok,true);
    assert.deepEqual(new Set(engine.getCards().map((c:LeitnerCard)=>c.id)),new Set(['existing','incoming']));
    assert.equal(engine.importData(JSON.stringify({...exported,version:'999'})).ok,false);
    assert.equal(engine.getCards().length,2,'unsupported version cannot mutate cards');
    const malformed={...exported,stories:{'S01-Q1':{...story,page:100}}};
    assert.equal(engine.importData(JSON.stringify(malformed)).ok,false);
    assert.equal(engine.getCards().length,2,'malformed stories cannot mutate cards');
  } finally {
    if(descriptor) Object.defineProperty(globalThis,'localStorage',descriptor);
    else Reflect.deleteProperty(globalThis,'localStorage');
  }
});
