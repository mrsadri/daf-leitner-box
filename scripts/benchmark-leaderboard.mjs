/** Synthetic local measurement only: PGlite timings are not hosted latency estimates. */
import {applySchema} from './database-schema.mjs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try{
 await applySchema(db);
 await db.exec(`insert into auth.users(id,email) select md5('perf-'||n)::uuid,'perf-'||n||'@test' from generate_series(1,100)n;
 alter table public.cards disable trigger cards_limit_per_user;
 insert into public.cards(user_id,id,type,box,next_review_date)
 select md5('perf-'||u)::uuid,'word-'||n,'vocab',n%7,current_date from generate_series(1,100)u cross join generate_series(1,100)n;
 alter table public.cards enable trigger cards_limit_per_user;
 insert into public.verified_card_points(user_id,card_id,points) select user_id,id,box from public.cards;
 alter table public.review_events disable trigger review_events_validate;
 insert into public.review_events(user_id,card_id,card_type,correct,from_box,to_box,review_day,verified,verified_delta)
 select md5('perf-'||(1+n%100))::uuid,'word-'||(1+n%100),'vocab',true,0,1,current_date-(n%500),true,1 from generate_series(1,200000)n;
 alter table public.review_events enable trigger review_events_validate;
 analyze;`);
 const measure=async()=>{
  const times=[];
  for(let i=0;i<12;i++){
   const start=performance.now();await db.query("select * from public.get_verified_leaderboard('week',100)");
   if(i>=2)times.push(performance.now()-start);
  }
  times.sort((a,b)=>a-b);return {p50_ms:times[4],p95_ms:times[9],samples:times};
 };
 const before=await measure();
 const planBefore=await db.query("explain (analyze,buffers,format json) select user_id,count(*) from public.review_events where verified and review_day>=current_date-6 group by user_id");
 await db.exec('create index benchmark_review_day_user on public.review_events(review_day,user_id); analyze public.review_events;');
 const after=await measure();
 const planAfter=await db.query("explain (analyze,buffers,format json) select user_id,count(*) from public.review_events where verified and review_day>=current_date-6 group by user_id");
 console.log(JSON.stringify({environment:'isolated PGlite; synthetic, not production',users:100,cards:10000,events:200000,query:"get_verified_leaderboard",before,after,planBefore:planBefore.rows,planAfter:planAfter.rows},null,2));
}finally{await db.close();}
