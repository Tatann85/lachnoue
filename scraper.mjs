// Robot de mise à jour — Chnoue Wing
// Récupère le vent + la météo via Open-Meteo (modèles GFS/ICON/AROME, best-match),
// combine avec le calendrier écluse + marées (calendar.json) et écrit data.json.
// Aucune dépendance npm (fetch natif Node 18+).
import fs from 'node:fs';

const LAT = 46.498, LON = -1.793;
const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
/* B9 — ÉCHANTILLONNAGE. Le robot prélevait le vent toutes les DEUX heures :
   7, 9, 11, 13, 15, 17, 19, 21 h. Un coup de vent d'une heure passait entre les
   mailles, et avec lui le garde-fou rafales A4, qui ne voyait pas la rafale de
   16 h. Open-Meteo publie au pas horaire, il n'y avait aucune raison de jeter
   une heure sur deux. Depuis le 23/09/2026, data.json porte les QUINZE heures de
   7 h à 21 h, et la note, les créneaux GO et le plafond rafales sont calculés
   sur les quinze. Le graphique du site n'affiche les chiffres qu'aux huit heures
   de référence, par lisibilité sur téléphone, mais il colore les quinze barres :
   une rafale d'une heure se voit. */
const HS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
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
/* LES SIX ÉTATS OFFICIELS — point C11, source primaire obtenue le 23/09/2026.
   Mail de l'Agglo du 30/06/2026, resume fidele :
     PRISE   ouverture a maree montante a egalite de niveau, fermeture a
             l'inversion du flux ou a la cote maximale souhaitee. Remplit.
     RENVOI  ouverture a egalite de niveau, mer descendante. Evacue l'eau sale.
     FBM     fermeture basse mer, « l'oppose de la prise », vide au maximum.
     VAV     portes maintenues ouvertes, le niveau suit les marees.
     FERM    « L'ecluse est fermee. Aucune manoeuvre n'est programmee. »
             Hydrauliquement identique a une journee sans manoeuvre : le niveau
             est retenu. C'est un ETAT declare, pas un trou dans le calendrier.
     CHASSE  par forte pluie, ouverture a maree descendante pour vider l'eau
             douce de la Vertonne, fermeture a maree basse, « repetee a chaque
             maree ». Le marais est donc vide en continu : traite comme bas.
   Les deux derniers n'existaient pas dans le code : CHASSE tombait dans la
   branche « aucune manoeuvre » et le site annoncait de l'eau pendant qu'on
   vidangeait le marais a chaque maree. */
const eclLabel = x => x === 'PRISE' ? 'PRISE' : x === 'RENVOI' ? 'RENVOI' : x === 'FBM' ? 'FERMETURE BASSE MER' : x === 'VAV' ? 'VA-ET-VIENT' : x === 'FERM' ? 'FERMETURE' : x === 'CHASSE' ? 'CHASSE' : null;
const ETATS_CONNUS = ['PRISE', 'RENVOI', 'FBM', 'VAV', 'FERM', 'CHASSE'];

/* ---------------------------------------------------------------------------
   NIVEAU D'EAU — remonté ici depuis app.js le 20/09/2026.
   Il tournait dans le navigateur de chaque visiteur. Un robot d'alerte aurait dû
   le refaire de son côté : deux implémentations du même modèle hydraulique, qui
   auraient divergé à la première correction, et un mail qui aurait contredit la
   page sans que personne ne le voie.
   Désormais : ce fichier est le seul endroit où un niveau se calcule. data.json
   porte le résultat, app.js et le robot le lisent. Ne recalculez rien ailleurs.

   PROVENANCE DES CINQ NOMBRES — point Q1 du backlog, RÉPONDU le 23/09/2026 en
   dépouillant les mails de l'Agglo (point C9).
     5,20 m et 5,00 m : SOURCÉS. Mail de Jean-François Chaigneau, technicien
       assainissement, service cycle de l'eau de l'Agglo, du 30/06/2026 :
       « La fermeture se fait à l'inversion du flux (pour une prise maximum) ou à
       la côte maximale souhaitée (5,00 m en hiver ou 5,20 m en été). »
     0,85 m/h de vidange à partir de 20 h, plancher 2,60 m, 0,55 m/h en
       va-et-vient, plancher 0,80 m : NON SOURCÉS. Ces quatre nombres viennent
       tels quels de l'ancien app.js, aucun mail, aucun document, aucune mesure
       ne les porte. Ce sont des valeurs posées à la conception. C'est pour cela
       que le soir d'un renvoi est classé « incertain » et non « vide » (B3) :
       on sait qu'une manœuvre vide, on ne sait pas à quelle vitesse.
     Les déplacer ne les rend pas plus vrais.
   --------------------------------------------------------------------------- */
/* C10 — LA COTE N'EST PAS CONSTANTE.
   Mail de l'Agglo du 01/07/2026 : « la hauteur d'eau de 5.20 est un maximum ».
   La cote maximale de saison vaut 5,20 m en été et 5,00 m en hiver. Le code
   appliquait 5,20 m toute l'année : en décembre, le graphique annonçait donc
   20 cm d'eau de plus qu'il n'y en a.

   SECONDE MOITIÉ FAITE LE 23/09/2026. Mail de l'Agglo du 01/07/2026, mot pour
   mot : « A noter que la hauteur d'eau de 5.20 est un maximum. Exemple : pour la
   prise de ce soir, le niveau maxi est de 4.93 à 18h35. Les portes se fermeront
   donc à marée haute. La hauteur d'eau dans la partie marais sera proche des
   4.93. » Le niveau atteint par une PRISE vaut donc
        min(cote de saison, hauteur de la pleine mer de cette prise)
   et il est RETENU jusqu'à la manœuvre suivante, toujours d'après le même mail :
   « Après une prise le niveau est maintenu jusqu'à la manœuvre suivante. »
   D'où le champ fill porté jour par jour, calculé à la prise et reporté ensuite,
   et non recalculé chaque jour sur la marée du jour, qui n'a rien à voir avec le
   niveau du marais les jours de rétention.
   Ce mail confirme aussi que 4,93 m de pleine mer donne 4,93 m dans le marais :
   la cote du marais et la hauteur de marée sont donc dans le MÊME système de
   référence, le min() ci-dessus a un sens physique.

   LES DATES DE BASCULE ÉTÉ / HIVER NE SONT TOUJOURS PAS SOURCÉES. L'Agglo donne
   les deux valeurs, pas le calendrier. La fenêtre d'hiver retenue ici est
   volontairement LARGE (1er octobre au 30 avril) : se tromper vers l'hiver fait
   annoncer moins d'eau qu'il n'y en a, jamais l'inverse. C'est le sens de la
   règle G-33 et de la loi du minimum d'eau (C8). */
const COTE_ETE = 5.2;
const COTE_HIVER = 5.0;
export function coteSaison(iso) {
  const mois = +iso.slice(5, 7);
  return (mois >= 10 || mois <= 4) ? COTE_HIVER : COTE_ETE;
}
const HS_LVL = HS; // meme liste depuis B9 : le vent et le niveau sont echantillonnes ensemble
const CRENEAUX = { m: [7, 8, 9, 10, 11, 12], a: [13, 14, 15, 16, 17], s: [18, 19, 20, 21] };

/* LES MARÉES DU JOUR — lot B4/B5/B6, corrigé le 23/09/2026.
   d.tides est la liste des heures de pleine mer de la journée, en heures
   DÉCIMALES (18,92 pour 18 h 55), dans l'ordre. Elle peut être vide.
     B5 — tideHigh était arrondi à l'heure entière : une pleine mer à 18 h 55
          devenait 18 h 00, soit 55 minutes d'erreur sur la fenêtre d'eau.
     B4 — seule la pleine mer du SOIR était retenue. Or l'Agglo décrit le
          va-et-vient ainsi (mail du 30/06/2026) : « les portes de l'écluse sont
          maintenues en position ouvertes et le niveau de l'eau des marais
          fluctue au gré des marées. » Au pluriel : les DEUX pleines mers
          remplissent, pas seulement celle du soir.
     B6 — tideHigh valait 15 h par défaut quand les marées manquaient : la
          fenêtre d'eau était alors entièrement inventée. Désormais, pas de
          marée = pas de fenêtre, et le verdict du jour devient « incertain »
          sur les trois créneaux, jamais « plein », jamais « vide ». */
function ecartMaree(h, d) {
  const T = Array.isArray(d.tides) && d.tides.length ? d.tides
          : (d.tideHigh != null ? [d.tideHigh] : []);
  if (!T.length) return null;              // B6 : rien a inventer
  return Math.min(...T.map(t => Math.abs(h - t)));
}
// Y a-t-il de l'eau à l'heure h ?
export function present(h, d) {
  if (d.water === 'plein') return true;
  if (d.water === 'renvoiSoir') return h <= 21;
  // B1 : le marais se remplit a la maree du soir, rien avant.
  if (d.water === 'priseSoir') { const t = premiereMareeSoir(d); return t == null ? false : h >= t; }
  if (d.water === 'vav') { const e = ecartMaree(h, d); return e != null && e <= 2; }
  return false;
}
// Heure de la maree qui remplit le marais le soir d'une PRISE tardive.
function premiereMareeSoir(d) {
  const T = Array.isArray(d.tides) && d.tides.length ? d.tides
          : (d.tideHigh != null ? [d.tideHigh] : []);
  const soir = T.filter(t => t >= 12);
  if (soir.length) return Math.min(...soir);
  return T.length ? Math.max(...T) : null;
}
// Cote du marais à l'heure h, en mètres.
export function cote(h, d) {
  const FILL = d.fill != null ? d.fill : COTE_ETE;
  if (d.water === 'plein') return FILL;
  if (d.water === 'priseSoir') { const t = premiereMareeSoir(d); return (t != null && h >= t) ? FILL : 1; }
  if (d.water === 'renvoiSoir') return h <= 20 ? FILL : Math.max(2.6, FILL - 0.85 * (h - 20));
  if (d.water === 'vav') { const e = ecartMaree(h, d); return e == null ? 1 : Math.max(0.8, FILL - 0.55 * e); }
  return 1;
}

/* Verdict par créneau, écrit dans data.json pour le site ET pour les alertes.
   Trois états seulement, et c'est volontaire :
     'plein'     de l'eau sur tout le créneau ;
     'incertain' jour de va-et-vient. Le niveau colle à la marée, et l'heure de
                 pleine mer est la donnée la moins fiable du modèle (B4, B5, B6).
                 Promettre de l'eau là-dessus serait envoyer quelqu'un pour rien ;
     'vide'      aucune eau sur le créneau. Couvre le marais vidangé et le marais
                 bas : le modèle sait qu'un renvoi a eu lieu, il ne sait pas quelle
                 hauteur il reste. D'où le libellé « bas ou à sec », jamais « à sec ».
   Pas de quatrième état tant que C4 (seuil foil métrique) n'est pas tranché :
   aujourd'hui la navigabilité est binaire, inventer un « petit fond » serait faux. */
export function verdictEau(d) {
  const out = {};
  for (const [k, hs] of Object.entries(CRENEAUX)) {
    /* B6 — l'ORDRE DE CES TESTS COMPTE. Un jour de va-et-vient est « incertain »
       AVANT d'etre juge sur le nombre d'heures avec eau : si les marees du jour
       manquent, present() est faux partout et l'ancien ordre concluait « vide »,
       c'est-a-dire une affirmation, sur une absence de donnee. */
    if (d.water === 'vav') { out[k] = 'incertain'; continue; }
    /* A1 — meme raisonnement pour l'etat inconnu, et pour la meme raison : une
       absence de donnee n'est pas une affirmation. present() renvoie faux, donc
       aucun creneau GO n'est propose ; mais le VERDICT dit « incertain » et non
       « vide », parce que « vide » affirmerait qu'il n'y a pas d'eau. */
    if (d.water === 'inconnu') { out[k] = 'incertain'; continue; }
    const avec = hs.filter(h => present(h, d));
    if (!avec.length) { out[k] = 'vide'; continue; }
    /* B3 — Le soir d'un jour de renvoi, l'ecluse est en train de vider le
       marais. Le code annoncait « plein » comme n'importe quel autre creneau,
       parce que present() reste vrai jusqu'a 21 h et que le plancher de vidange
       est a 2,60 m. On sait qu'une manoeuvre vide, on ne sait pas a quelle
       vitesse : la vitesse de vidange est l'un des cinq nombres non sources
       (Q1). « incertain » dit exactement ce qu'on sait, sans inventer un chiffre.
       Meme raisonnement pour le soir d'une prise tardive (B1) : le remplissage
       est en cours, l'heure exacte depend de la maree. */
    if (k === 's' && (d.water === 'renvoiSoir' || d.water === 'priseSoir')) { out[k] = 'incertain'; continue; }
    out[k] = 'plein';
  }
  return out;
}

// Calcule l'état de l'écluse jour par jour avec rétention (report du dernier état)
function ecluseStates(cal, fromISO, toISO, marees, avert) {
  const evDates = Object.keys(cal.ecluse).sort();
  let start = evDates.length && evDates[0] < fromISO ? evDates[0] : fromISO;
  const out = {};
  /* A1 — L'ETAT INCONNU. Le modele demarrait ici sur « plein », ECRIT EN DUR,
     c'est-a-dire une affirmation tiree de rien. Mesure le 24/09/2026 : 28 % des
     journees n'ont aucune manoeuvre, donc si la saisie d'un mois commence sur
     l'une d'elles, le site annoncait « eau toute la journee » sans source.
     Une chance sur quatre a chaque nouveau mois saisi.
     Desormais on part de « inconnu », qui ne promet rien et n'interdit rien. */
  let held = 'inconnu';
  let fillHeld = null;   // C10 : cote atteinte a la derniere prise, reportee ensuite
  for (let cur = start; cur <= toISO; cur = addDays(cur, 1)) {
    const ev = cal.ecluse[cur] || {};
    const m = ev.m, s = ev.s;
    /* DÉFAUT PRUDENT SUR UN ÉTAT INCONNU. Avant le 23/09/2026, un libellé non
       reconnu dans calendar.json tombait dans la branche « aucune manœuvre » et
       le niveau était donc RETENU, c'est-à-dire que le site annonçait de l'eau
       sur une chaîne de caractères qu'il ne comprenait pas. Désormais il retient
       le minimum d'eau (loi C8) et l'écrit dans les avertissements de data.json.
       C'est la seule façon de ne pas envoyer quelqu'un sur un état non modélisé. */
    for (const [ou, v] of [['matin', m], ['soir', s]]) {
      if (v != null && !ETATS_CONNUS.includes(v)) {
        avert.push('etat d\'ecluse non reconnu le ' + cur + ' au ' + ou + ' : "' + String(v).slice(0, 40) + '" — journee classee « incertaine »');
      }
    }
    const inconnu = (m != null && !ETATS_CONNUS.includes(m)) || (s != null && !ETATS_CONNUS.includes(s));
    const heldLabel = held === 'plein' ? 'aucune (retenu plein)'
                    : held === 'bas'   ? 'aucune (retenu bas)'
                    : 'aucune (niveau inconnu)';
    let water, eclM, eclS, newHeld = held;
    if (inconnu) {
      /* A1 : un libelle non reconnu devient « inconnu » et non « bas ». La
         nuance compte : « bas » AFFIRME qu'il n'y a pas d'eau, « inconnu »
         reconnait qu'on ne sait pas. Aucun creneau GO n'est propose dans les
         deux cas, puisque present() renvoie faux pour « inconnu ». */
      water = 'inconnu'; newHeld = 'inconnu';
      /* A1 : ne PAS retomber sur heldLabel ici. Il aurait affiche « aucune
         (retenu plein) », donc le panneau aurait annonce « Ecluse : FERMEE,
         niveau maintenu plein » sur une journee qu'on ne comprend pas. Deux
         affirmations fausses d'un coup, exactement ce que A1 doit supprimer. */
      eclM = (m != null && !ETATS_CONNUS.includes(m)) ? 'ETAT NON RECONNU' : (eclLabel(m) || heldLabel);
      eclS = (s != null && !ETATS_CONNUS.includes(s)) ? 'ETAT NON RECONNU' : (eclLabel(s) || heldLabel);
    } else if (m === 'CHASSE' || s === 'CHASSE') {
      /* C11 — CHASSE : vidange de l'eau douce de la Vertonne a chaque maree
         descendante, repetee maree apres maree. Le marais n'est jamais tenu. */
      water = 'bas'; newHeld = 'bas';
      eclM = eclLabel(m) || heldLabel; eclS = eclLabel(s) || heldLabel;
    } else if (m === 'PRISE') {
      // Prise le matin : le marais se remplit tot, la journee compte comme pleine.
      if (s === 'RENVOI' || s === 'FBM') { water = 'renvoiSoir'; newHeld = 'bas'; }
      else { water = 'plein'; newHeld = 'plein'; }
      eclM = eclLabel(m) || heldLabel; eclS = eclLabel(s) || 'aucune (retenu plein)';
      fillHeld = cotePrise(cur, marees, s === 'PRISE' ? 's' : 'm');
    } else if (s === 'PRISE') {
      /* B1 — La prise a lieu LE SOIR, et elle seule. Le code annoncait la
         journee entiere pleine des 7 h : un jour {matin: RENVOI, soir: PRISE}
         promettait de l'eau au petit matin alors que le marais venait d'etre
         vide. Symetrique exact de renvoiSoir. */
      water = 'priseSoir'; newHeld = 'plein';
      eclM = eclLabel(m) || heldLabel; eclS = eclLabel(s) || heldLabel;
      fillHeld = cotePrise(cur, marees, 's');
    } else if (m === 'RENVOI' || m === 'FBM' || s === 'RENVOI' || s === 'FBM') {
      water = 'bas'; newHeld = 'bas'; eclM = eclLabel(m) || heldLabel; eclS = eclLabel(s) || 'aucune (retenu bas)';
    } else if (m === 'VAV' || s === 'VAV') {
      /* B2 NON CORRIGE ICI, ET C'EST DELIBERE. Le defaut est reel : newHeld
         reste inchange, donc un va-et-vient apres une prise laisse « retenu
         plein » et le lendemain sans manoeuvre est annonce plein. Mais la
         correction naive (newHeld = 'bas') fait basculer SIX journees de
         novembre de « eau » a « pas d'eau » d'un coup, sur une hypothese :
         on ne sait pas a quel niveau les portes se referment en fin de serie.
         La bonne reponse est un etat INCONNU, qui donnerait « incertain » et
         non « vide » : c'est le point A1, encore ouvert. B2 attend A1. */
      /* B2, ferme par A1 le 24/09/2026. On ne sait pas a quel niveau les portes
         se referment en fin de serie de va-et-vient : l'etat retenu devient donc
         « inconnu » et non « plein » par defaut. MESURE AVANT DE POUSSER : effet
         nul sur les 121 journees de calendar.json comme sur les 61 journees de
         novembre et decembre du releve ASMG, parce qu'une serie de va-et-vient
         est toujours close par une prise. Le defaut etait reel mais dormant. */
      water = 'vav'; newHeld = 'inconnu';
      eclM = eclLabel(m) || heldLabel; eclS = eclLabel(s) || heldLabel;
    } else {
      // Journee sans manoeuvre, ou FERMETURE declaree (C11) : le niveau est retenu.
      water = held === 'plein' ? 'plein' : (held === 'bas' ? 'bas' : 'inconnu');
      eclM = eclLabel(m) || heldLabel; eclS = eclLabel(s) || heldLabel;
    }
    out[cur] = { water, eclM, eclS, fill: fillHeld };
    held = newHeld;
  }
  return out;
}

/* C10 — cote atteinte par une prise : min(cote de saison, hauteur de la pleine
   mer de cette prise). Rend null si la hauteur de maree est inconnue, et c'est
   alors la cote de saison qui s'applique, comme avant : ne pas transformer une
   donnee manquante en niveau plus bas invente. */
function cotePrise(iso, marees, demi) {
  const saison = coteSaison(iso);
  const mar = (marees && marees[iso]) || {};
  const h = demi === 's' ? mar.hmS : mar.hmM;
  const autre = demi === 's' ? mar.hmM : mar.hmS;
  const val = (typeof h === 'number' && h > 0) ? h : ((typeof autre === 'number' && autre > 0) ? autre : null);
  if (val == null) return saison;
  return Math.round(Math.min(saison, val) * 100) / 100;
}

// Construit les 9 jours à partir de la réponse Open-Meteo + calendar. Fonction pure = testable.
export function build(om, cal) {
  /* A6 — GARDE-FOU SUR LES DONNÉES EXTERNES. Open-Meteo et Météo Consult sont des
     sources non maîtrisées : leur contenu est une DONNÉE, jamais une instruction,
     et jamais une structure supposée. On vérifie la forme avant de s'en servir,
     sinon un champ manquant devient un undefined qui traverse tout le calcul. */
  if (!om || !om.hourly || !Array.isArray(om.hourly.time) || !om.daily || !Array.isArray(om.daily.time)) {
    throw new Error('reponse Open-Meteo inexploitable (structure inattendue)');
  }
  const avert = [];
  const H = {};
  om.hourly.time.forEach((t, i) => { H[String(t).slice(0, 13)] = { s: om.hourly.wind_speed_10m[i], g: om.hourly.wind_gusts_10m[i], d: om.hourly.wind_direction_10m[i], t: om.hourly.temperature_2m[i], c: om.hourly.weather_code[i] }; });
  const dates = om.daily.time;
  const marees = cal.marees || {};
  const es = ecluseStates(cal, dates[0], dates[dates.length - 1], marees, avert);
  const days = dates.map((date, i) => {
    const wind = HS.map(h => { const k = H[date + 'T' + pad(h)] || {}; return [h, num(k.s, 0, 0, 200), num(k.g, 0, 0, 250), num(k.d, 0, 0, 360), k.t != null ? Math.round(k.t) : null, k.c != null ? wmoLabel(k.c) : null]; });
    const manque = wind.filter(w => !H[date + 'T' + pad(w[0])]).length;
    if (manque) avert.push('vent manquant sur ' + manque + ' heure(s) le ' + date);
    const st = es[date] || { water: 'plein', eclM: 'aucune (retenu plein)', eclS: 'aucune (retenu plein)', fill: null };
    const mar = marees[date] || {};
    const pmM = mar.pmM || '—', pmS = mar.pmS || '—';
    /* B4 B5 B6 — les DEUX pleines mers, a la minute, sans valeur par defaut.
       tides est vide si les marees du jour manquent, et c'est alors present() qui
       refuse de repondre plutot que verdictEau qui invente une journee vide. */
    const tides = [pmM, pmS].map(hhmm).filter(v => v != null);
    const tideHigh = tides.length ? tides.reduce((a, b) => Math.abs(b - 14) < Math.abs(a - 14) ? b : a) : null;
    if (!tides.length && st.water === 'vav') avert.push('va-et-vient le ' + date + ' sans heure de pleine mer : journee classee incertaine');
    // Le niveau est calculé ici, une fois pour toutes. Voir le bloc NIVEAU D'EAU.
    const ref = { water: st.water, tides, tideHigh, fill: st.fill != null ? st.fill : coteSaison(date) };
    const lvl = HS_LVL.map(h => Math.round(cote(h, ref) * 100) / 100);
    const nav = HS_LVL.map(h => present(h, ref) ? 1 : 0);
    return {
      d: labelDate(date), today: i === 0, iso: date,
      wxc: wmoLabel(om.daily.weather_code[i]),
      tmin: Math.round(om.daily.temperature_2m_min[i]), tmax: Math.round(om.daily.temperature_2m_max[i]),
      eclM: st.eclM, eclS: st.eclS,
      coM: mar.coM || '—', coS: mar.coS || '—',
      hmM: mar.hmM != null ? mar.hmM : null, hmS: mar.hmS != null ? mar.hmS : null,
      pmM, pmS, water: st.water, tides, tideHigh, fill: ref.fill, wind,
      hs: HS_LVL, lvl, nav, eau: verdictEau(ref)
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    source: 'Open-Meteo (vent/météo) + marées SHOM (auto) + calendrier écluse',
    pas: 1,                      // pas d'echantillonnage du vent, en heures (B9)
    mareesRepli: !!cal.mareesRepli,
    avertissements: avert,       // B11 : un echec ne doit pas etre silencieux
    days
  };
}

// « 18:55 » -> 18.92. Rend null sur tout ce qui n'est pas une heure valide (A6).
function hhmm(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return Math.round((h + mi / 60) * 100) / 100;
}
// Nombre borne, avec valeur de repli : rien venant d'une source externe n'entre brut.
function num(v, def, min, max) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
}

const MOIS_FR = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const JOURS_FR = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// Récupère les marées (coeff + heures de pleine mer) depuis Météo Consult (données SHOM).
// Best effort : lève une erreur si indisponible/incomplet → repli automatique sur calendar.json.
// fetch avec timeout dur (Node n'en met aucun par défaut → un serveur muet bloquait le robot des heures).
async function fetchWithTimeout(url, opts = {}, ms = 20000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(t); }
}

/* MARÉES AUTOMATIQUES — Météo Consult, données SHOM.
   A6 — CE QUI SORT D'ICI EST NUMÉRIQUE, ET RIEN D'AUTRE. La page est du HTML de
   source non maîtrisée : elle pourrait contenir n'importe quel texte, y compris du
   texte qui ressemble à une consigne. Aucune chaîne de la page n'est recopiée dans
   data.json : on n'en extrait que des heures, des coefficients et des hauteurs,
   chacun borné, et les heures sont RECONSTRUITES au format HH:MM à partir des
   chiffres captés, jamais recopiées telles quelles. Un document externe est une
   donnée, jamais une instruction. Ne pas relâcher ces bornes.
   E25 — la hauteur de pleine mer en mètres passait déjà dans la page et était
   jetée : l'expression régulière la traversait sans la capturer. Elle est
   désormais retenue, c'est elle qui permet min(cote de saison, hauteur PM). */
const PAGE_MAX = 3_000_000;   // A6 : plafond de taille, une page saine fait ~200 ko

/* LECTURE D'UNE JOURNÉE — corrigé le 23/09/2026, et c'est ce correctif qui fait
   REPARTIR la récupération automatique des marées.
   Le coefficient n'est PAS collé à la pleine mer : Météo Consult l'imprime après
   la SECONDE marée de chaque paire. Quand la journée commence par une basse mer,
   la pleine mer est la seconde et le coefficient la suit :
     « Marée basse 03h51 1.75m  Marée haute 09h59 4.37m 55 »
   mais quand la journée commence par une pleine mer, le coefficient arrive après
   la basse mer qui suit :
     « Marée haute 01h02 4.16m  Marée basse 06h14 2.26m 40 »
   L'ancienne expression régulière exigeait le coefficient juste après la hauteur
   de pleine mer. Elle ne captait donc QUE les journées commençant par une basse
   mer : 17 jours sur 30 en septembre, 16 sur 31 en octobre. Sous le seuil de 20,
   le robot basculait sur calendar.json À CHAQUE EXÉCUTION, sans le dire. Le site
   tournait donc depuis des semaines sur des marées figées à la saisie, et sans
   aucune hauteur de pleine mer. C'est exactement le défaut décrit au point B11 :
   ce n'est pas la panne qui coûte, c'est le silence.
   On lit donc les marées dans l'ordre, et le coefficient qui clôt une paire est
   attribué à la pleine mer de cette paire. */
function lisJournee(bloc) {
  const re = /mar[ée]e\s+(haute|basse)\s+(\d{1,2})h(\d{2})\s+(\d{1,2})[.,](\d{1,2})\s*m(?:\s+(\d{2,3})\b)?/gi;
  const tides = [];
  let m;
  while ((m = re.exec(bloc))) {
    const hh = +m[2], mi = +m[3], haut = +(m[4] + '.' + m[5]);
    if (hh > 23 || mi > 59) continue;
    if (!(haut > 0.2 && haut < 8)) continue;              // A6 : borne physique
    const coef = m[6] != null ? +m[6] : null;
    if (coef != null && (coef < 20 || coef > 121)) continue; // A6 : borne de definition
    tides.push({ type: m[1].toLowerCase(), time: pad(hh) + ':' + pad(mi), hh, haut, coef });
  }
  // le coefficient qui cloture une paire vaut pour la pleine mer de cette paire
  const highs = [];
  for (let i = 0; i < tides.length; i++) {
    const t = tides[i];
    if (t.type !== 'haute') continue;
    let coef = t.coef;
    if (coef == null && i + 1 < tides.length && tides[i + 1].type === 'basse') coef = tides[i + 1].coef;
    highs.push({ time: t.time, hh: t.hh, haut: t.haut, coef: coef != null ? coef : null });
  }
  return highs;
}

async function fetchMareesAuto(dates) {
  const need = [...new Set(dates.map(d => d.slice(0, 7)))]; // ["YYYY-MM", ...]
  const out = {};
  for (const ym of need) {
    const [y, mo] = ym.split('-');
    const url = 'https://marine.meteoconsult.fr/meteo-marine/horaires-des-marees/les-sables-d-olonne-1025/' + MOIS_FR[+mo - 1] + '-' + y;
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0 (chnoue-wing)' } }, 15000);
    if (!res.ok) throw new Error('marées HTTP ' + res.status + ' ' + ym);
    let brut = await res.text();
    if (brut.length > PAGE_MAX) throw new Error('page marées anormalement grosse (' + brut.length + ' o, ' + ym + ')');
    const txt = brut.replace(/<[^>]+>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ');
    brut = null;
    const dayRe = new RegExp('(?:' + JOURS_FR.join('|') + ')\\s+(\\d{1,2})\\b([\\s\\S]*?)(?=(?:' + JOURS_FR.join('|') + ')\\s+\\d{1,2}\\b|$)', 'gi');
    let dm, count = 0;
    while ((dm = dayRe.exec(txt))) {
      const day = +dm[1];
      if (day < 1 || day > 31) continue;
      const highs = lisJournee(dm[2]);
      if (!highs.length) continue;
      const am = highs.find(x => x.hh < 12), pm = highs.find(x => x.hh >= 12);
      out[ym + '-' + pad(day)] = {
        coM: am && am.coef ? String(am.coef) : '—', coS: pm && pm.coef ? String(pm.coef) : '—',
        pmM: am ? am.time : '—', pmS: pm ? pm.time : '—',
        hmM: am ? am.haut : null, hmS: pm ? pm.haut : null
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
  const res = await fetchWithTimeout(url, {}, 25000);
  if (!res.ok) throw new Error('Open-Meteo HTTP ' + res.status);
  const om = await res.json();
  let marees = cal.marees || {};
  let repli = null;
  try {
    const auto = await fetchMareesAuto(om.daily.time);
    marees = { ...marees, ...auto };
    console.log('Marées auto OK —', Object.keys(auto).length, 'jours (SHOM / Météo Consult).');
  } catch (e) {
    /* B11 — L'ÉCHEC N'EST PLUS SILENCIEUX. Avant le 23/09/2026, la récupération
       des marées pouvait basculer entièrement sur calendar.json sans que rien ne
       le dise : aucune ligne visible dans le journal de l'Action, rien dans
       data.json. Or calendar.json ne porte pas les hauteurs de pleine mer, donc
       la moitié du modèle C10 tombe en silence, et ses heures sont figées à la
       saisie. Désormais le repli laisse une trace dans data.json (mareesRepli et
       avertissements) et une ligne préfixée AVERTISSEMENT dans le journal, que la
       routine hebdomadaire D2 peut chercher. On ne fait toujours PAS échouer le
       robot : publier le site avec des marées de secours vaut mieux que ne rien
       publier, mais l'exploitant doit le savoir. */
    repli = e.message;
    console.log('AVERTISSEMENT — marées auto indisponibles (' + e.message + ') : repli sur calendar.json, sans hauteurs de pleine mer.');
  }
  const data = build(om, { ecluse: cal.ecluse, marees, mareesRepli: repli != null });
  if (repli) data.avertissements.unshift('marées auto indisponibles : ' + repli);
  fs.writeFileSync('data.json', JSON.stringify(data, null, 1));
  console.log('data.json écrit —', data.days.length, 'jours, generatedAt', data.generatedAt);
  for (const a of data.avertissements) console.log('AVERTISSEMENT —', a);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scraper.mjs')) {
  main().catch(e => { console.error('Échec robot :', e.message); process.exit(1); });
}
