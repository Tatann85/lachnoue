/* =============================================================================
   sante-site.mjs - le controle de sante du site publie (point D2 du backlog).

   POURQUOI CET OUTIL EXISTE
   Deux incidents du projet ne produisent AUCUNE erreur visible, et c'est ce qui
   les rend dangereux :
     - le site FIGE sur d'anciennes donnees. Les pages se chargent, elles sont
       belles, et elles annoncent le vent de la semaine derniere (incident A du
       cahier des charges) ;
     - le POIDS. Le 24/09/2026 la page d'accueil chargeait 16 Mo d'images sans
       qu'aucune alerte ne se declenche. Dix jours de travail sur ce site sans
       que personne le mesure (incident C).
   Un controle qui tourne en dix secondes repond aux deux.

   USAGE
     node outils/sante-site.mjs
     node outils/sante-site.mjs --age-max 240 --origine https://lachnoue.fr
   Sortie 0 si tout va bien, 1 si un controle echoue, 2 si le site est
   injoignable. Il ne lit ni n'ecrit aucun fichier : il n'interroge que le site
   publie, donc il peut tourner depuis n'importe ou.

   A LANCER une fois par semaine, et apres chaque push (l'Action met deux a
   trois minutes a republier).
   ============================================================================= */

const ORIGINE = arg('origine', 'https://lachnoue.fr');
const AGE_MAX = +arg('age-max', 180);        /* minutes. Le cron GitHub est horaire
                                                mais capricieux : trois heures de
                                                retard ne sont pas un incident. */
const JOURS_ATTENDUS = 9;
const POIDS_FICHIER_MAX = 700;               /* ko, par fichier appele par la page */
const POIDS_PAGE_MAX    = 1500;              /* ko, somme de la page et de ses images */

/* Ces deux PNG ont ete sortis du depot le 24/09/2026 (commit a3f992c) : 14,3 Mo
   de poids mort que le cp *.png du workflow embarquait a chaque publication.
   S'ils reapparaissent, c'est que quelqu'un a redepose une image a la racine. */
const BANNIS = [
  'Gemini_Generated_Image_fo5ekyfo5ekyfo5e.png',
  'Gemini_Generated_Image_mt0blemt0blemt0b.png',
];

function arg(nom, defaut) {
  const i = process.argv.indexOf('--' + nom);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
}

let ko = 0, ok = 0;
function t(nom, condition, detail) {
  if (condition) { ok++; console.log('  ok   ' + nom); }
  else { ko++; console.log('  KO   ' + nom + (detail ? '\n       ' + detail : '')); }
}

async function tete(u) {
  try {
    const r = await fetch(u, { method: 'HEAD', redirect: 'follow' });
    const l = r.headers.get('content-length');
    return { code: r.status, ko: l ? Math.round(+l / 1024) : null };
  } catch (e) { return { code: 0, erreur: e.message }; }
}

async function texte(u) {
  const r = await fetch(u);
  if (!r.ok) throw new Error(u + ' a repondu ' + r.status);
  return r.text();
}

/* --------------------------------------------------------------------------- */

console.log('\nLa Ch\'noue - sante du site publie');
console.log(ORIGINE + '   ' + new Date().toLocaleString('fr-FR') + '\n');

/* 1. LA FRAICHEUR DES DONNEES. C'est le controle le plus important : une page
      qui se charge bien en annoncant le vent de la semaine derniere est pire
      qu'une page en panne, parce qu'on lui fait confiance. */
console.log('1. FRAICHEUR DES DONNEES');
let d;
try { d = JSON.parse(await texte(ORIGINE + '/data.json')); }
catch (e) { console.log('  ARRET : data.json injoignable (' + e.message + ')'); process.exit(2); }

const ageMin = Math.round((Date.now() - new Date(d.generatedAt).getTime()) / 60000);
t('data.json a moins de ' + AGE_MAX + ' min (' + ageMin + ' min)', ageMin <= AGE_MAX,
  'generatedAt = ' + d.generatedAt + '. Verifier l\'onglet Actions du depot.');
t(JOURS_ATTENDUS + ' journees publiees (' + (d.days || []).length + ')', (d.days || []).length === JOURS_ATTENDUS);
t('les marees ne sont pas en repli', d.mareesRepli === false,
  'mareesRepli = true : les heures de pleine mer viennent du calendrier saisi, plus de la source auto.');
const av = d.avertissements || [];
t('aucun avertissement dans data.json', av.length === 0, av.join(' | '));

/* 2. LES 40 PAGES. Le sitemap est la liste de ce que le site pretend publier :
      si une URL du sitemap ne repond pas, Google la voit avant nous. */
console.log('\n2. LES PAGES ANNONCEES PAR LE SITEMAP');
const sm = await texte(ORIGINE + '/sitemap.xml');
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
t(urls.length + ' URL dans le sitemap', urls.length > 0);
const morts = [];
for (const u of urls) { const r = await tete(u); if (r.code !== 200) morts.push(u + ' -> ' + (r.code || r.erreur)); }
t('toutes repondent 200', morts.length === 0, morts.slice(0, 8).join('\n       '));

/* 3. LES HUIT LANGUES doivent vraiment etre dans la langue annoncee. Un build
      partiel peut servir la page francaise sous /de/ sans que rien n'echoue. */
console.log('\n3. LES HUIT LANGUES');
const LANGS = { '': 'fr', 'en/': 'en', 'de/': 'de', 'nl/': 'nl', 'es/': 'es', 'it/': 'it', 'zh/': 'zh', 'br/': 'br' };
for (const [chemin, code] of Object.entries(LANGS)) {
  let h = '';
  try { h = await texte(ORIGINE + '/' + chemin); } catch (e) { /* signale ci-dessous */ }
  t('/' + chemin + ' est en lang="' + code + '"', new RegExp('<html[^>]+lang="' + code + '"').test(h));
}

/* 4. LE POIDS. Le workflow copie TOUTES les images de la racine du depot dans
      _site, qu'une page les cite ou non : c'est un aspirateur. Ce controle
      mesure ce que la page d'accueil fait reellement telecharger. */
console.log('\n4. POIDS DE LA PAGE D\'ACCUEIL');
const accueil = await texte(ORIGINE + '/');
/* Le (?!\/) ecarte les URL a protocole relatif du genre //gc.zgo.at/count.js :
   ce sont des fichiers d'un autre domaine, GoatCounter en l'occurrence, et leur
   poids n'est pas le notre. */
const refs = [...new Set(
  [...accueil.matchAll(/(?:href|src)="(\/(?!\/)[^"]+\.(?:png|jpe?g|svg|woff2|css|js))"/g)].map(m => m[1])
)];
let total = Math.round(Buffer.byteLength(accueil, 'utf8') / 1024);
const lourds = [];
console.log('   ' + String(total).padStart(5) + ' ko   / (le HTML)');
for (const r of refs) {
  const h = await tete(ORIGINE + r);
  const p = h.ko == null ? 0 : h.ko;
  total += p;
  console.log('   ' + String(p).padStart(5) + ' ko   ' + r + (h.code !== 200 ? '   <-- ' + h.code : ''));
  if (p > POIDS_FICHIER_MAX) lourds.push(r + ' fait ' + p + ' ko');
}
t('aucun fichier au-dela de ' + POIDS_FICHIER_MAX + ' ko', lourds.length === 0, lourds.join('\n       '));
t('la page complete tient sous ' + POIDS_PAGE_MAX + ' ko (' + total + ' ko)', total <= POIDS_PAGE_MAX,
  'Mesure le 24/09/2026 avant correction : environ 16 000 ko.');

/* 5. LES FICHIERS BANNIS. Garde-fou de non-retour sur la correction du poids. */
console.log('\n5. LES FICHIERS SORTIS DU DEPOT NE SONT PAS REVENUS');
for (const b of BANNIS) {
  const r = await tete(ORIGINE + '/' + b);
  t(b.slice(0, 34) + '... absent (404 attendu, recu ' + r.code + ')', r.code === 404,
    'Ce fichier a ete sorti du depot le 24/09/2026. S\'il repond 200, une image a ete redeposee a la racine.');
}

console.log('\n' + (ko ? 'A REGARDER : ' + ko + ' controle(s) en defaut, ' + ok + ' bons'
                       : 'TOUT VA BIEN : ' + ok + ' controles'));
process.exit(ko ? 1 : 0);
