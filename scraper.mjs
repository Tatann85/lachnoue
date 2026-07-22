// Robot de mise à jour — Chnoue Wing
// Récupère le vent + la météo via Open-Meteo (modèles GFS/ICON/AROME, best-match),
// combine avec le calendrier écluse + marées (calendar.json) et écrit data.json.
// Aucune dépendance npm (fetch natif Node 18+).
import fs from 'node:fs';

const LAT = 46.498, LON = -1.793;
const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const HS = [7, 9, 11, 13, 15, 17, 19, 21];
const pad = n => String(n).padStart(2, '0');
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const labelDate = iso => { const d = new Date(iso + 'T12:00:00'); return DOW[d.getDay()] + ' ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1); };
function wmoLabel(c) {
  if (c === 0) return 'Ensoleillé';
  if (c === 1) return 'Éclaircies';
  if (c === 2) return 'Peu nuageux';
  if (c === 3) return 'Couvert';
  if (c === 45 || c === 48) return 'Brouillard';
  if (c >= 51 && c <= 57) return 'Bruine';
  if (c >= 61 && c <= 67) return 'Pluie';
  if (c >= 71 && c <= 77) return 'Neige';
  if (c >= 80 && c <= 82) return 'Averses';
  if (c >= 85 && c <= 86) return 'Averses de neige';
  if (c >= 95) return 'Orage';
  return 'Éclaircies';
}
const eclLabel = x => x === 'PRISE' ? 'PRISE' : x === 'RENVOI' ? 'RENVOI' : x === 'FBM' ? 'FERMETURE BASSE MER' : x === 'VAV' ? 'VA-ET-VIENT' : null;

// Calcule l'état de l'écluse jour par jour avec rétention (report du dernier état)
function ecluseStates(cal, fromISO, toISO) {
  const evDates = Object.keys(cal.ecluse).sort();
  let start = evDates.length && evDates[0] < fromISO ? evDates[0] : fromISO;
  const out = {};
  let held = 'plein';
  for (let cur = start; cur <= toISO; cur = addDays(cur, 1)) {
    const ev = cal.ecluse[cur] || {};
    const m = ev.m, s = ev.s;
    const heldLabel = held === 'plein' ? 'aucune (retenu plein)' : 'aucune (retenu bas)';
    let water, eclM, eclS, newHeld = held;
    if (m === 'PRISE' || s === 'PRISE') {
      if (s === 'RENVOI' || s === 'FBM') { water = 'renvoiSoir'; newHeld = 'bas'; }
      else { water = 'plein'; newHeld = 'plein'; }
      eclM = eclLabel(m) || heldLabel; eclS = eclLabel(s) || 'aucune (retenu plein)';
    } else if (m === 'RENVOI' || m === 'FBM' || s === 'RENVOI' || s === 'FBM') {
      water = 'bas'; newHeld = 'bas'; eclM = eclLabel(m) || heldLabel; eclS = eclLabel(s) || 'aucune (retenu bas)';
    } else if (m === 'VAV' || s === 'VAV') {
      water = 'vav'; eclM = eclLabel(m) || heldLabel; eclS = eclLabel(s) || heldLabel;
    } else {
      water = held === 'plein' ? 'plein' : 'bas'; eclM = heldLabel; eclS = heldLabel;
    }
    out[cur] = { water, eclM, eclS };
    held = newHeld;
  }
  return out;
}

// Construit les 9 jours à partir de la réponse Open-Meteo + calendar. Fonction pure = testable.
export function build(om, cal) {
  const H = {};
  om.hourly.time.forEach((t, i) => { H[t.slice(0, 13)] = { s: om.hourly.wind_speed_10m[i], g: om.hourly.wind_gusts_10m[i], d: om.hourly.wind_direction_10m[i], t: om.hourly.temperature_2m[i], c: om.hourly.weather_code[i] }; });
  const dates = om.daily.time;
  const es = ecluseStates(cal, dates[0], dates[dates.length - 1]);
  const days = dates.map((date, i) => {
    const wind = HS.map(h => { const k = H[date + 'T' + pad(h)] || {}; return [h, Math.round(k.s || 0), Math.round(k.g || 0), Math.round(k.d || 0), k.t != null ? Math.round(k.t) : null, k.c != null ? wmoLabel(k.c) : null]; });
    const st = es[date] || { water: 'plein', eclM: 'aucune (retenu plein)', eclS: 'aucune (retenu plein)' };
    const mar = (cal.marees && cal.marees[date]) || {};
    const pmM = mar.pmM || '—', pmS = mar.pmS || '—';
    let tideHigh = 15; const mm = /(\d{1,2}):\d{2}/.exec(pmS);
    if (mm) { const hh = +mm[1]; if (hh >= 7 && hh <= 21) tideHigh = hh; else { const mo = /(\d{1,2}):\d{2}/.exec(pmM); if (mo) tideHigh = Math.min(21, Math.max(7, +mo[1])); } }
    return {
      d: labelDate(date), today: i === 0,
      wxc: wmoLabel(om.daily.weather_code[i]),
      tmin: Math.round(om.daily.temperature_2m_min[i]), tmax: Math.round(om.daily.temperature_2m_max[i]),
      eclM: st.eclM, eclS: st.eclS,
      coM: mar.coM || '—', coS: mar.coS || '—',
      pmM, pmS, water: st.water, tideHigh, wind
    };
  });
  return { generatedAt: new Date().toISOString(), source: 'Open-Meteo (vent/météo) + marées SHOM (auto) + calendrier écluse', days };
}

const MOIS_FR = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const JOURS_FR = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// Récupère les marées (coeff + heures de pleine mer) depuis Météo Consult (données SHOM).
// Best effort : lève une erreur si indisponible/incomplet → repli automatique sur calendar.json.
async function fetchMareesAuto(dates) {
  const need = [...new Set(dates.map(d => d.slice(0, 7)))]; // ["YYYY-MM", ...]
  const out = {};
  for (const ym of need) {
    const [y, mo] = ym.split('-');
    const url = 'https://marine.meteoconsult.fr/meteo-marine/horaires-des-marees/les-sables-d-olonne-1025/' + MOIS_FR[+mo - 1] + '-' + y;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (chnoue-wing)' } });
    if (!res.ok) throw new Error('marées HTTP ' + res.status + ' ' + ym);
    const txt = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ');
    const dayRe = new RegExp('(?:' + JOURS_FR.join('|') + ')\\s+(\\d{1,2})\\b([\\s\\S]*?)(?=(?:' + JOURS_FR.join('|') + ')\\s+\\d{1,2}\\b|$)', 'gi');
    let dm, count = 0;
    while ((dm = dayRe.exec(txt))) {
      const day = +dm[1];
      if (day < 1 || day > 31) continue;
      const highRe = /haute[^0-9]{0,8}(\d{1,2})h(\d{2})[^0-9]{0,14}[\d.,]+\s*m[^0-9]{0,8}(\d{2,3})/gi;
      let hm; const highs = [];
      while ((hm = highRe.exec(dm[2]))) {
        const hh = +hm[1], mm = +hm[2], coef = +hm[3];
        if (hh > 23 || mm > 59 || coef < 20 || coef > 121) continue;
        highs.push({ time: pad(hh) + ':' + hm[2], hh, coef });
      }
      if (!highs.length) continue;
      const am = highs.find(x => x.hh < 12), pm = highs.find(x => x.hh >= 12);
      out[ym + '-' + pad(day)] = {
        coM: am ? String(am.coef) : '—', coS: pm ? String(pm.coef) : '—',
        pmM: am ? am.time : '—', pmS: pm ? pm.time : '—'
      };
      count++;
    }
    if (count < 20) throw new Error('marées parse incomplet (' + count + ' j, ' + ym + ')');
  }
  return out;
}

async function main() {
  const cal = JSON.parse(fs.readFileSync('calendar.json', 'utf8'));
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON +
    '&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,weather_code' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
    '&wind_speed_unit=kn&timezone=Europe%2FParis&forecast_days=9';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Open-Meteo HTTP ' + res.status);
  const om = await res.json();
  let marees = cal.marees || {};
  try {
    const auto = await fetchMareesAuto(om.daily.time);
    marees = { ...marees, ...auto };
    console.log('Marées auto OK —', Object.keys(auto).length, 'jours (SHOM / Météo Consult).');
  } catch (e) {
    console.log('Marées auto indisponibles (' + e.message + ') — repli sur calendar.json.');
  }
  const data = build(om, { ecluse: cal.ecluse, marees });
  fs.writeFileSync('data.json', JSON.stringify(data, null, 1));
  console.log('data.json écrit —', data.days.length, 'jours, generatedAt', data.generatedAt);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scraper.mjs')) {
  main().catch(e => { console.error('Échec robot :', e.message); process.exit(1); });
}
