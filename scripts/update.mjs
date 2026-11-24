// Reads the Hijri date of one city per country from Taqwim al-Sayegh (the month starts by the sighting in each country) and keeps the start of each Hijri month per city in hijri.json.
// Run every evening (about 9 pm Beirut) by .github/workflows/update.yml. The site is read only around the change of month:
// from the 28th of a month to the 2nd of the next one (or when a city has no known month yet). On other days nothing is read.
// FORCE=1 reads every city whatever the day.
import fs from 'node:fs';

const FILE = 'hijri.json';
const CITIES = JSON.parse(fs.readFileSync('cities.json', 'utf8'));
const FORCE = process.env.FORCE === '1' || process.env.FORCE === 'true';
const KEEP = 8;   // months kept per city
const UA = 'zad-hijri/1 (daily Hijri date for the Zad al-Muntazirin app; one read per city around the change of month)';
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const pad = n => String(n).padStart(2, '0');
const iso = d => d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m-1, d)); };
const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate()+n); return iso(d); };
const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const todayIn = tz => new Intl.DateTimeFormat('en-CA', {timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());

// Umm al-Qura, only to name the month a start belongs to and to reject nonsense (a start more than 3 days from it)
const UQ = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {timeZone:'UTC', day:'numeric', month:'numeric', year:'numeric'});
function uq(s){ const p = {}; UQ.formatToParts(parse(s)).forEach(x => { p[x.type] = x.value; }); return {y:parseInt(p.year), m:parseInt(p.month), d:parseInt(p.day)}; }

function load(){ try{ return JSON.parse(fs.readFileSync(FILE, 'utf8')); }catch(e){ return {v:1, cities:{}}; } }
function dayOf(entry, date){   // -> {y, m, d} from the known month starts, or null
  if(!entry || !entry.m) return null; let best = null;
  for(const k of Object.keys(entry.m)){ const st = entry.m[k]; if(st <= date && (!best || st > best.st)) best = {k, st}; }
  if(!best) return null; const d = diffDays(date, best.st) + 1; if(d > 30) return null;
  const [y, m] = best.k.split('-').map(Number); return {y, m, d};
}

async function get(url){
  for(let i = 0; i < 3; i++){
    try{ const r = await fetch(url, {headers:{'User-Agent':UA, 'Accept':'text/html'}}); if(r.ok) return await r.text(); console.log('  HTTP', r.status); }
    catch(e){ console.log('  error', e.message); }
    await sleep(4000);
  }
  return null;
}
async function hijriOn(sid, date){   // the Hijri day Sayegh shows for this city on this Gregorian date -> {d, y} or null
  const [y, m, d] = date.split('-').map(Number);
  const html = await get('https://taqwimalsayegh.com/calendar/day-change?day='+d+'&month='+m+'&year='+y+'&city_id='+sid);
  if(!html) return null;
  if(!new RegExp('const\\s+cityId\\s*=\\s*'+sid+'\\s*;').test(html)) { console.log('  not the page of city', sid); return null; }
  const re = /datetitle_en">\s*([A-Za-z'’ ]+?)\s+(\d{1,2})\s+(\d{4})\s*</g, want = uq(date).y; let x, g = false, h = null;
  while((x = re.exec(html))){
    const n = x[1].trim(), dd = +x[2], yy = +x[3];
    if(yy > 1700){ if(n === MONTHS_EN[m-1] && dd === d && yy === y) g = true; continue; }
    if(Math.abs(yy - want) <= 1 && !h) h = {d:dd, y:yy, name:n};   // the lunar year (the Iranian solar year is ~43 less)
  }
  if(!g) { console.log('  the page is not for', date); return null; }
  return h;
}

const data = load(); data.v = 1; data.cities = data.cities || {};
for(const sid of Object.keys(data.cities)) if(!CITIES.some(c => String(c.sid) === sid)) delete data.cities[sid];   // one city per country: the others are no longer kept
for(const c of CITIES){ const e = data.cities[c.sid]; if(e){ e.id = c.id; e.en = c.en; e.country = c.country; e.lat = c.lat; e.lng = c.lng; } }   // every run: the app matches the country
const now = new Date().toISOString(), beirut = todayIn('Asia/Beirut');
const need = FORCE || CITIES.some(c => { const t = dayOf(data.cities[c.sid], todayIn(c.tz)); return !t || t.d >= 28 || t.d <= 2; });
console.log('today (Beirut):', beirut, need ? '— reading the site' : '— mid-month, nothing to read');

if(need){
  let ok = 0;
  for(const c of CITIES){
    const e = data.cities[c.sid] || (data.cities[c.sid] = {m:{}}); e.id = c.id; e.en = c.en; e.country = c.country; e.lat = c.lat; e.lng = c.lng;
    const t0 = todayIn(c.tz);
    for(const date of [t0, addDays(t0, 1)]){   // today, and tomorrow: whether tomorrow is the 30th or the 1st
      const h = await hijriOn(c.sid, date); await sleep(1500);
      if(!h || h.d < 1 || h.d > 30) continue;
      const st = addDays(date, -(h.d - 1)), u = uq(addDays(st, 14));   // the month this start belongs to
      const k = h.y+'-'+u.m, near = uq(st);
      if(u.y !== h.y && u.m !== 1 && u.m !== 12) { console.log('  year mismatch', c.en, date, h, u); continue; }
      if(!(near.d >= 28 || near.d <= 4)) { console.log('  far from Umm al-Qura', c.en, date, h, near); continue; }
      if(e.m[k] !== st) console.log(' ', c.en, k, (e.m[k] || '—'), '->', st);
      e.m[k] = st; e.at = now; ok++;
    }
    const keys = Object.keys(e.m).sort((a, b) => e.m[a] < e.m[b] ? -1 : 1); while(keys.length > KEEP) delete e.m[keys.shift()];
  }
  data.read = now; console.log('pages read:', ok);
  // the study: did the cities start the latest months on different days?
  const by = {}; for(const sid in data.cities){ const e = data.cities[sid]; for(const k in e.m){ (by[k] = by[k] || {})[e.m[k]] = (by[k][e.m[k]] || []).concat(e.en); } }
  data.diff = {}; for(const k in by) if(Object.keys(by[k]).length > 1) data.diff[k] = by[k];
}
data.checked = now;   // also keeps the repository active, so GitHub does not pause the schedule
fs.writeFileSync(FILE, JSON.stringify(data, null, 1)+'\n');
