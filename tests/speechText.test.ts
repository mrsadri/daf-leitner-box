import {test} from 'node:test';
import assert from 'node:assert/strict';
import {speechText} from '../src/shared/lib/speechText.ts';
test('all variants survive punctuation and the translation is omitted',()=>{
 assert.equal(speechText('der Praktikant / die Praktikantin · کارآموز'),'der Praktikant, die Praktikantin');
 assert.equal(speechText('eins/zwei/drei'),'eins, zwei, drei');
 assert.equal(speechText('Hallo, Anna (und Ben)'),'Hallo, Anna, und Ben');
 assert.equal(speechText('Guten Morgen! Wie geht es dir?'),'Guten Morgen! Wie geht es dir?');
});
