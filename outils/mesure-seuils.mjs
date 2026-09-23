/* =============================================================================
   mesure-seuils.mjs — recalibrer les seuils du site sur des donnees reelles.

   POURQUOI CET OUTIL EXISTE
   Le 23/09/2026, le point A8 du backlog a montre qu'un seuil pose « a vue »
   pouvait avoir un effet exactement inverse a celui qu'on croyait. Le plafond
   de rafale GO_GUST_MAX = 30 kn avait ete ajoute pour empecher un GO vert par
   35 kn de rafale (point A4). En mesurant, on a decouvert qu'au spot la rafale
   vaut environ 1,85 fois le vent moyen de facon TRES reguliere : ce plafond
   etait donc un plafond de VENT MOYEN deguise a 16 kn, et il refusait 99 a
   100 % des heures au-dessus de 18 kn, c'est-a-dire les meilleures journees.

   REGLE QUI EN SORT, et elle est dans le cahier des charges : on ne touche plus
   a un seuil sans avoir relance cet outil et regarde l'effet sur plusieurs
   annees. Un seuil deplace tous les creneaux du calendrier d'un coup.

   USAGE
     node outils/mesure-seuils.mjs
     node outils/mesure-seuils.mjs --vent-min 11 --vent-max 25 --rafale-max 50
     node outils/mesure-seuils.mjs --debut 2020-01-01 --fin 2026-08-31

   Ne depend de rien : ni paquet npm, ni fichier du site. Il interroge l'API
   archive d'Open-Meteo, qui sert la reanalyse horaire du point du spot.
   Le niveau d'eau n'est PAS simule : cet outil ne juge que la regle de vent.
   ============================================================================= */

const LAT = 46.498, LON = -1.793;      /* la Ch'noue, ecluse de la Rocade */
const H_DEBUT = 7, H_FIN = 21;         /* heures de navigation, comme le site */

/* Seuils de reference : ceux qui tournent aujourd'hui dans app.js.
   Les tenir a jour ici quand on les change la-bas. */
const ACTUEL = { ventMin: 11, ventMax: 25, rafaleMax: 50, trouMax: 1, dureeMin: 2 };
/* Seuils d'avant le 23/09/2026, gardes pour pouvoir remontrer le probleme. */
const AVANT  = { ventMin: 11, ventMax: 999, rafaleMax: 30, trouMax: 0, dureeMin: 0 };

function arg(nom, defaut) {
  const i = process.argv.indexOf('--' + nom);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
}

const debut = arg('debut', '2023-09-01');
const fin   = arg('fin',   '2026-08-31');
const cible = {
  ventMin:   +arg('vent-min',   ACTUEL.ventMin),
  ventMax:   +arg('vent-max',   ACTUEL.ventMax),
  rafaleMax: +arg('rafale-max', ACTUEL.rafaleMax),
  trouMax:   +arg('trou-max',   ACTUEL.trouMax),
  dureeMin:  +arg('duree-min',  ACTUEL.dureeMin),
};

/* --------------------------------------------------------------------------- */

async function charge() {
  const url = 'https://archive-api.open-meteo.com/v1/archive'
    + '?latitude=' + LAT + '&longitude=' + LON
    + '&start_date=' + debut + '&end_date=' + fin
    + '&hourly=wind_speed_10m,wind_gusts_10m'
    + '&wind_speed_unit=kn&timezone=Europe%2FParis';
  const r = await fetch(url);
  if (!r.ok) throw new Error('Open-Meteo a repondu ' + r.status);
  const j = await r.json();
  if (!j.hourly || !Array.isArray(j.hourly.time)) throw new Error('reponse inattendue');
  return j.hourly;
}

/* Meme regroupement que goGroups() dans app.js. Les deux doivent rester
   identiques : si l'un change, changer l'autre, sinon la mesure ment. */
function creneaux(hs, pas, trouMax, dureeMin) {
  hs = hs.slice().sort((a, b) => a - b);
  const g = []; let cur = [];
  for (const h of hs) {
    if (!cur.length || h - cur[cur.length - 1] <= pas * (1 + trouMax)) cur.push(h);
    else { g.push(cur); cur = [h]; }
  }
  if (cur.length) g.push(cur);
  return g.filter(c => c[c.length - 1] - c[0] + pas >= dureeMin);
}

function pct(a, p) { const b = a.slice().sort((x, y) => x - y); return b[Math.floor((b.length - 1) * p)]; }

function simule(jours, s) {
  let heures = 0, avecCreneau = 0, fragmentes = 0;
  const detail = {};
  for (const [d, hs] of Object.entries(jours)) {
    const ok = hs.filter(x => x.s >= s.ventMin && x.s <= s.ventMax && x.g < s.rafaleMax).map(x => x.h);
    const g = creneaux(ok, 1, s.trouMax, s.dureeMin);
    const n = g.reduce((t, c) => t + c[c.length - 1] - c[0] + 1, 0);
    heures += n;
    if (g.length) avecCreneau++;
    if (g.length > 1) fragmentes++;
    detail[d] = g.length;
  }
  return { heures, avecCreneau, fragmentes, detail };
}

const lignes = (a, b) => String(a).padStart(10) + String(b).padStart(12);

/* --------------------------------------------------------------------------- */

const H = await charge();
const jours = {};
let n = 0;
for (let i = 0; i < H.time.length; i++) {
  const h = +H.time[i].slice(11, 13);
  if (h < H_DEBUT || h > H_FIN) continue;
  if (H.wind_speed_10m[i] == null || H.wind_gusts_10m[i] == null) continue;
  const d = H.time[i].slice(0, 10);
  (jours[d] = jours[d] || []).push({ h, s: Math.round(H.wind_speed_10m[i]), g: Math.round(H.wind_gusts_10m[i]) });
  n++;
}
const nJours = Object.keys(jours).length;
const ans = nJours / 365.25;

console.log('\nLa Ch\'noue — mesure des seuils');
console.log('Periode ' + debut + ' au ' + fin + ' : ' + nJours + ' journees, ' + n + ' heures de ' + H_DEBUT + ' h a ' + H_FIN + ' h.\n');

/* 1. La relation rafale / vent, c'est elle qui a piege le projet en 2026. */
const nav = [];
for (const hs of Object.values(jours)) for (const x of hs) if (x.s >= 11) nav.push(x.g / x.s);
console.log('1. RAPPORT RAFALE / VENT MOYEN sur les heures a plus de 11 kn (n=' + nav.length + ')');
console.log('   p10 ' + pct(nav, .10).toFixed(2) + '   p50 ' + pct(nav, .50).toFixed(2)
          + '   p90 ' + pct(nav, .90).toFixed(2) + '   p99 ' + pct(nav, .99).toFixed(2));
console.log('   Si l\'ecart p10-p90 est etroit, le facteur de rafale ne distingue RIEN :');
console.log('   un plafond exprime en rafales est alors un plafond de vent moyen deguise.');
console.log('   Plafond de rafale ' + cible.rafaleMax + ' kn  =  environ '
          + Math.round(cible.rafaleMax / pct(nav, .50)) + ' kn de vent moyen.\n');

/* 2. Avant / apres. */
const a = simule(jours, AVANT), b = simule(jours, cible);
console.log('2. EFFET DES SEUILS');
console.log('   avant = vent >= ' + AVANT.ventMin + ', rafale < ' + AVANT.rafaleMax + ', sans lissage');
console.log('   cible = vent ' + cible.ventMin + '-' + cible.ventMax + ', rafale < ' + cible.rafaleMax
          + ', trou ' + cible.trouMax + ' h comble, duree mini ' + cible.dureeMin + ' h\n');
console.log('                                            AVANT       CIBLE');
console.log('   heures GO affichees par an       ' + lignes(Math.round(a.heures / ans), Math.round(b.heures / ans)));
console.log('   journees avec un creneau, par an ' + lignes(Math.round(a.avecCreneau / ans), Math.round(b.avecCreneau / ans)));
console.log('   journees au creneau FRAGMENTE    ' + lignes(Math.round(a.fragmentes / ans), Math.round(b.fragmentes / ans)));

let gagne = 0, perdu = 0;
for (const d of Object.keys(jours)) {
  if (!a.detail[d] && b.detail[d]) gagne++;
  if (a.detail[d] && !b.detail[d]) perdu++;
}
console.log('\n   journees qui GAGNENT un creneau  : ' + Math.round(gagne / ans) + ' par an');
console.log('   journees qui PERDENT leur creneau: ' + Math.round(perdu / ans) + ' par an');

/* 3. Ou le plafond mord, bande par bande. */
console.log('\n3. OU LE PLAFOND DE RAFALE MORD, par bande de vent moyen');
console.log('   bande        heures/an   refusees par le plafond ' + cible.rafaleMax + ' kn');
const tout = [];
for (const hs of Object.values(jours)) for (const x of hs) if (x.s >= cible.ventMin) tout.push(x);
for (const [x, y] of [[11, 14], [14, 16], [16, 18], [18, 20], [20, 25], [25, 30], [30, 99]]) {
  const t = tout.filter(v => v.s >= x && v.s < y);
  if (!t.length) continue;
  const c = t.filter(v => v.g >= cible.rafaleMax).length;
  console.log('   ' + (x + '-' + y + ' kn').padEnd(12) + String(Math.round(t.length / ans)).padStart(9)
            + '   ' + (Math.round(c / ans) + ' (' + (100 * c / t.length).toFixed(0) + ' %)').padStart(18));
}
console.log('\n   Une bande entierement refusee est un signal d\'alarme : le plafond');
console.log('   ne protege plus, il supprime une categorie entiere de journees.\n');
