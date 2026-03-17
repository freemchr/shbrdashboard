import fs from 'fs';
import { put } from '@vercel/blob';

// Load all env from .env.local — no hardcoded secrets
const envLines = fs.readFileSync('/home/freemchr/.openclaw/workspace/shbr-dashboard/.env.local','utf8').split('\n');
for (const l of envLines) { const i = l.indexOf('='); if(i>0) process.env[l.slice(0,i).trim()]=l.slice(i+1).trim(); }

const PRIME = process.env.PRIME_BASE_URL;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Auth
const p = new URLSearchParams({grant_type:'password',username:process.env.PRIME_USERNAME,password:process.env.PRIME_PASSWORD,client_id:process.env.PRIME_CLIENT_ID,client_secret:process.env.PRIME_CLIENT_SECRET});
const tr = await fetch(PRIME+'/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/vnd.api.v2+json'},body:p.toString()});
const {access_token:token} = await tr.json();
const h = {'Authorization':'Bearer '+token,'Accept':'application/vnd.api.v2+json'};

// Fetch all open jobs
console.log('Fetching open jobs...');
const statusRes = await fetch(PRIME+'/statuses?per_page=200',{headers:h});
const statusData = await statusRes.json();
const openIds = statusData.data.filter(s=>s.attributes?.statusType==='Open').map(s=>s.id);
const statusMap = Object.fromEntries(statusData.data.map(s=>[s.id,s.attributes?.name]));

let allJobs = [];
for (let i=0; i<openIds.length; i+=15) {
  const batch = openIds.slice(i,i+15);
  const q = encodeURIComponent(`'statusId'.in(${batch.map(id=>`'${id}'`).join(',')})`);
  let page=1, totalPages=1;
  while(page<=totalPages) {
    const r = await fetch(`${PRIME}/jobs?per_page=100&page=${page}&q=${q}`,{headers:h});
    const d = await r.json();
    allJobs = allJobs.concat(d.data||[]);
    totalPages = d.meta?.pagination?.total_pages||1;
    page++;
  }
}

const jobs = allJobs.map(j => {
  const addr = j.attributes?.address;
  const address = typeof addr==='object'&&addr ? [addr.addressLine1,addr.suburb,addr.state].filter(Boolean).join(', ') : String(addr||'—');
  return {id:j.id,jobNumber:j.attributes?.jobNumber||j.id,address,status:statusMap[j.attributes?.statusId||'']||'—',jobType:j.attributes?.jobType||'—',region:j.attributes?.region||'—',primeUrl:j.attributes?.primeUrl||'',authorisedTotal:Number(j.attributes?.authorisedTotalIncludingTax||0),updatedAt:j.attributes?.updatedAt||'',updatedBy:j.attributes?.updatedBy||''};
});
console.log(`Got ${jobs.length} jobs. Geocoding at 1/sec (~${Math.ceil(jobs.length/60)} min)...\n`);

const skip = addr => !addr || addr.length<5 || ['—','UNDEFINED','NULL','N/A','TBA','TBC','DESKTOP QUOTE','NO ADDRESS','UNKNOWN'].some(p=>addr.toUpperCase().includes(p));

const geocode = async addr => {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr+', Australia')}&format=json&limit=1&countrycodes=au`,{headers:{'User-Agent':'SHBR-Dashboard/1.0 (chris.freeman@techgurus.com.au)'},signal:AbortSignal.timeout(8000)});
    if(!r.ok) return null;
    const d = await r.json();
    return d.length ? {lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon)} : null;
  } catch { return null; }
};

const results = [];
let mapped=0, failed=0;

for (const job of jobs) {
  let lat=null, lng=null, isFailed=false;
  if(!skip(job.address)) {
    const coords = await geocode(job.address);
    if(coords) { lat=coords.lat; lng=coords.lng; mapped++; }
    else { isFailed=true; failed++; }
    await sleep(1100);
  } else { isFailed=true; failed++; }
  results.push({...job,lat,lng,failed:isFailed});
  if(results.length%50===0) process.stdout.write(`  ${results.length}/${jobs.length} — ${mapped} mapped, ${failed} failed\n`);
}

console.log(`\n✅ Done: ${mapped} mapped, ${failed} failed`);
console.log('Writing to Blob (1 operation)...');

const meta = {expiresAt:Date.now()+7*24*60*60*1000, data:{jobs:results,complete:true,total:jobs.length,geocoded:mapped}};
await put('shbr-cache/geocoded-jobs-v6.json', JSON.stringify(meta), {access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true});
console.log('✅ Saved! Map page will now show all geocoded jobs.');
