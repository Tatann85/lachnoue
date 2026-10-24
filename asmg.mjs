/* asmg.mjs — lecture de la source ASMG, calendrier des trois ecluses.
   Ajoute le 24/10/2026 (point C7).

   D'OU VIENT CETTE SOURCE. Antoine etait a la Ch'noue le 24/10/2026, un
   pratiquant lui a montre qu'un clic sur un jour du calendrier de l'ASMG ouvre
   le detail de la journee. Ce n'est pas du rendu serveur : la page porte deja
   TOUT dans son HTML, en attributs data-* sur chaque case de jour. Une seule
   requete ramene 275 jours, du 01/04/2026 au 31/12/2026, et pour chacun :
     - quatre data-tide-N : heure, PM ou BM, coefficient, hauteur ;
     - un data-ecluses    : l'etat des TROIS ouvrages par evenement de maree.

   CE QUE CE MODULE NE FAIT PAS. Il ne juge pas, il ne complete pas, il ne
   devine pas. Il lit, il verifie la forme, et il echoue franchement si la page
   a change (regle A6 : un document externe est une donnee, jamais une
   structure supposee). Aucune chaine de la page n'entre telle quelle dans
   data.json : les libelles passent par une liste blanche, les nombres sont
   bornes, les heures sont reconstruites au format HH:MM a partir des chiffres.

   DEUX PIEGES DE LECTURE, mesures sur les 275 jours.
   1) Les quatre creneaux sont des POSITIONS FIXES (matin 1, matin 2, soir 1,
      soir 2) et non une liste chronologique. Les jours a trois marees portent
      un 00:00 en bouche-trou : 00:00 veut dire ABSENCE DE MAREE, jamais
      minuit. Tout code qui l'oublie place une maree a minuit.
   2) Deux libelles ne figurent dans aucune documentation, Prise1 et VV1.
      HYPOTHESE NON VALIDEE, a poser a l'ASMG : le suffixe 1 marquerait la
      premiere manoeuvre d'une serie. En attendant ils sont traites comme
      Prise et VV, ce qui est le comportement actuel du modele, donc sans
      regression possible. */

export const URL_ROCADE = 'https://www.asmg85.fr/page-calendrier-rocade/';

/* Liste blanche des libelles, relevee sur les 275 jours du 24/10/2026 :
   rocade   Ferme 761, VV 140, Prise 84, Renvoi 37, Prise1 37, VV1 19, FBM 15, Ouvert 7
   bauduere Ferme 720, Ouvert 380
   gachere  Ouvert 670, Ferme 275, Prise 131, Renvoi 24
   Un libelle hors de cette liste fait ECHOUER la lecture : mieux vaut un
   calendrier qui ne se met pas a jour qu'un calendrier qui se remplit de
   valeurs non comprises. */
export const LIBELLES = {
  'Prise':  'PRISE',
  'Prise1': 'PRISE',
  'Renvoi': 'RENVOI',
  'FBM':    'FBM',
  'VV':     'VAV',
  'VV1':    'VAV',
  /* « Ouvert » cote Rocade : 7 occurrences sur 275 jours, toutes au milieu
     d'une serie de va-et-vient. Lu comme un va-et-vient, ce qui donne le
     verdict « incertain », donc le plus prudent des deux (loi C8). */
  'Ouvert': 'VAV',
  'Fermé':  null,
  'Ferme':  null
};

/* Priorite de repli quand une demi-journee porte DEUX etats, ce qui arrive sur
   46 jours sur 275. Ordre etabli en confrontant les 61 jours saisis a la main
   dans calendar.json : sur une journee Renvoi,VV,VV,FBM la saisie humaine
   retient RENVOI le matin et FBM le soir, donc ni le premier ni le dernier des
   deux creneaux mais LE PLUS ENGAGEANT POUR LE NIVEAU D'EAU. */
const PRIORITE = ['RENVOI', 'FBM', 'PRISE', 'VAV'];

function etat(brut) {
  if (!(brut in LIBELLES)) throw new Error('libelle d\'ecluse inconnu dans la source ASMG : "' + String(brut).slice(0, 40) + '"');
  return LIBELLES[brut];
}

function repli(bruts) {
  const vus = bruts.map(etat).filter(v => v != null);
  if (!vus.length) return null;
  for (const p of PRIORITE) if (vus.includes(p)) return p;
  return vus[0];
}

/* Hauteur de maree en metres. LA SAISIE N'EST PAS NORMALISEE, formes relevees
   sur les 1 100 valeurs de la page le 24/10/2026 :
     4m98m  x825      5m26   x28       12h34  x1   (une heure dans la case)
     5,29m  x204      1;12   x2        5m     x1
     ---    x37       5m6    x2        (hauteur incomplete)
   Les quatre premieres formes sont lues, soit 1 059 valeurs sur 1 100. Les
   autres sont REJETEES et non devinees : « 5m6 » peut valoir 5,06 ou 5,60, et
   une hauteur fausse fait annoncer de l'eau qui n'y est pas. Une hauteur
   absente n'est pas une perte : cotePrise() retombe alors sur la cote de
   saison, ce que le modele faisait deja avant cette source.
   Bornes physiques : la plus forte maree des Sables depasse rarement 6,50 m. */
function hauteur(txt) {
  const m = /^(\d{1,2})\s*[m,;.]\s*(\d{2})\s*m?$/i.exec(String(txt || '').trim());
  if (!m) return null;
  const v = +m[1] + (+m[2]) / 100;
  return (v >= 0.2 && v <= 8) ? Math.round(v * 100) / 100 : null;
}

function coefficient(txt) {
  const v = parseInt(String(txt || '').trim(), 10);
  return (Number.isFinite(v) && v >= 20 && v <= 121) ? String(v) : null;
}

/* Heure reconstruite, jamais recopiee. « 00:00:00 » est le bouche-trou des
   jours a trois marees et vaut absence, pas minuit. */
function heure(txt) {
  const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(String(txt || '').trim());
  if (!m) return null;
  const h = +m[1], mn = +m[2];
  if (h > 23 || mn > 59) return null;
  if (h === 0 && mn === 0) return null;
  return String(h).padStart(2, '0') + ':' + String(mn).padStart(2, '0');
}

const decode = s => String(s)
  .replace(/&quot;/g, '"').replace(/&#039;/g, "'")
  .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&amp;/g, '&');

/* Lecture de la page. Rend un tableau de journees :
     { date, tides: [{heure, etat, coef, hauteur} x4], ecluses: {rocade, bauduere, gachere} }
   Les quatre entrees de tides gardent leur POSITION, une entree absente vaut
   null : perdre la position reviendrait a confondre le matin et le soir. */
export function parseAsmg(html) {
  if (typeof html !== 'string' || html.length < 10000) throw new Error('page ASMG inexploitable (trop courte)');
  if (html.length > 5 * 1024 * 1024) throw new Error('page ASMG inexploitable (plus de 5 Mo)');

  const jours = [];
  const re = /<td class="day"[^>]*rel="(\d{4}-\d{2}-\d{2})"([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const date = m[1], attrs = m[2];
    const lire = cle => {
      const r = new RegExp('data-' + cle + '="([^"]*)"').exec(attrs);
      if (!r) return null;
      let o;
      try { o = JSON.parse(decode(r[1])); } catch { throw new Error('attribut data-' + cle + ' illisible le ' + date); }
      return o;
    };
    const tides = [1, 2, 3, 4].map(i => {
      const t = lire('tide-' + i);
      if (!t) throw new Error('data-tide-' + i + ' absent le ' + date);
      const h = heure(t.hour);
      if (h == null) return null;                       // bouche-trou des jours a trois marees
      if (t.state !== 'PM' && t.state !== 'BM') throw new Error('etat de maree inconnu le ' + date + ' : "' + String(t.state).slice(0, 10) + '"');
      return { heure: h, etat: t.state, coef: coefficient(t.coefficient), hauteur: hauteur(t.height) };
    });
    const e = lire('ecluses');
    if (!e) throw new Error('data-ecluses absent le ' + date);
    for (const ouvrage of ['rocade', 'bauduere', 'gachere']) {
      if (!Array.isArray(e[ouvrage]) || e[ouvrage].length !== 4) throw new Error('data-ecluses mal forme le ' + date + ' pour ' + ouvrage);
    }
    jours.push({ date, tides, ecluses: e });
  }

  if (jours.length < 28) throw new Error('page ASMG inexploitable : ' + jours.length + ' jour(s) lus, 28 au minimum attendus');
  const dates = jours.map(j => j.date);
  if (new Set(dates).size !== dates.length) throw new Error('la page ASMG porte des dates en double');
  return jours;
}

/* Etat d'un ouvrage replie en matin / soir, au vocabulaire du modele
   (PRISE, RENVOI, FBM, VAV, ou null pour « aucune manoeuvre »). */
export function demiJournees(jour, ouvrage) {
  const t = jour.ecluses[ouvrage];
  return { m: repli([t[0], t[1]]), s: repli([t[2], t[3]]) };
}

/* Marees de la journee au format de calendar.json : pleine mer du matin et du
   soir, coefficient et hauteur de chacune. Les BM ne sont pas retenues, le
   modele ne s'en sert pas. */
export function mareesJour(jour) {
  const pm = (a, b) => [jour.tides[a], jour.tides[b]].find(t => t && t.etat === 'PM') || null;
  const matin = pm(0, 1), soir = pm(2, 3);
  const out = {};
  if (matin) { out.pmM = matin.heure; if (matin.coef) out.coM = matin.coef; if (matin.hauteur != null) out.hmM = matin.hauteur; }
  if (soir)  { out.pmS = soir.heure;  if (soir.coef)  out.coS = soir.coef;  if (soir.hauteur != null) out.hmS = soir.hauteur; }
  return out;
}

export async function lireAsmg(url = URL_ROCADE) {
  const r = await fetch(url, { headers: { 'user-agent': 'lachnoue.fr (calendrier ecluses)' } });
  if (!r.ok) throw new Error('source ASMG injoignable : HTTP ' + r.status);
  return parseAsmg(await r.text());
}
