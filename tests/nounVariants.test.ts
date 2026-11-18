import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nounVariants,matchingNounVariant} from '../src/shared/vocab/nounVariants.ts';
test('paired forms retain their own gender and plural without changing the card identity',()=>{
 const variants=nounVariants({wort:'der Praktikant / die Praktikantin',artikel:'der',plural:'die Praktikanten / die Praktikantinnen'});
 assert.deepEqual(variants,[{word:'Praktikant',article:'der',gender:'m',plural:'Praktikanten'},{word:'Praktikantin',article:'die',gender:'f',plural:'Praktikantinnen'}]);
 assert.equal(matchingNounVariant(variants,'Praktikantin')?.article,'die');
 assert.equal(matchingNounVariant(variants,'Praktikantinnen')?.gender,'f');
 assert.equal(matchingNounVariant(variants,'unbekannt'),null);
 assert.equal(nounVariants({wort:'der/das Teil',artikel:'der/das'})[0].article,null);
 assert.equal(nounVariants({wort:'Praktikant/Praktikantin',artikel:'der'})[1].article,null,'do not teach a guessed article for an unspecified alternate');
});
