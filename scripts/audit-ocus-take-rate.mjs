import { readFileSync } from 'node:fs';
const src=readFileSync(new URL('../server/kajabiSalesRouter.ts',import.meta.url),'utf8');
const id=process.env.KAJABI_CLIENT_ID,sec=process.env.KAJABI_CLIENT_SECRET;
const tok=await (await fetch('https://api.kajabi.com/v1/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:id,client_secret:sec})})).json();
let a=[];for(let p=1;p<=20;p++){let j=await (await fetch(`https://api.kajabi.com/v1/transactions?filter[site_id]=2148432935&page[number]=${p}`,{headers:{Authorization:`Bearer ${tok.access_token}`}})).json();a.push(...(j.data||[]));if(!(j.links?.next))break}
const start='2026-08-13';const r=a.filter(x=>x.attributes.created_at.slice(0,10)>=start&&x.attributes.state!=='failed'&&x.attributes.state!=='refunded'&&x.attributes.action!=='refund');console.log(JSON.stringify({start,entries:r.filter(x=>x.attributes.amount_in_cents===6700).length,ocus199:r.filter(x=>x.attributes.amount_in_cents===19900).length,latest:r.map(x=>x.attributes.created_at).sort().at(-1)},null,2));
