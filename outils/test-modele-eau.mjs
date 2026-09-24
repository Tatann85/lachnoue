/* =============================================================================
   test-modele-eau.mjs - le filet de securite du modele d'eau.

   POURQUOI CE FICHIER EXISTE
   Le 24/09/2026, trois defauts du modele d'eau (B1, B3, A1) etaient corriges
   dans le code mais encore notes « non pousses » dans le backlog : personne ne
   pouvait le verifier en moins d'une heure de lecture. Un test qui tourne en
   une seconde repond a la question.

   CE QU'IL VERIFIE
   1. Le comportement attendu de chaque etat d'eau : plein, bas, vav,
      renvoiSoir (B3), priseSoir (B1), inconnu (A1), et l'absence de maree (B6).
   2. La fenetre de cote d'hiver (C10).
   3. LA NON-DIVERGENCE ENTRE scraper.mjs ET app.js. Les deux portent les memes
      formules : le serveur les calcule dans data.json (champs nav et lvl),
      le navigateur garde les memes formules en repli pour un data.json ancien
      encore en cache. Si l'une des deux copies bouge sans l'autre, le site et
      les alertes racontent deux histoires differentes. C'est exactement le
      genre de defaut que personne ne voit avant qu'un abonne ne se deplace
      pour rien.

   USAGE
     node outils/test-modele-eau.mjs
   Sortie 0 si tout passe, 1 sinon. Il n'ecrit rien, ne va pas sur le reseau,
   et ne touche a aucun fichier du site. A lancer AVANT chaque push qui touche
   scraper.mjs ou app.js.
   ============================================================================= */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { present, cote, verdictEau, coteSaison } from '../scraper.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..');

let ko = 0, ok = 0;
function t(nom, reel, attendu) {
  const a = JSON.stringify(reel), b = JSON.stringify(attendu);
  if (a === b) { ok++; console.log('  ok   ' + nom); }
  else { ko++; console.log('  KO   ' + nom + '\n       attendu ' + b + '\n       obtenu  ' + a); }
}

/* Journee de reference : pleine mer a 7 h 30 et a 19 h 55, cote d'ete. */
const J = { tides: [7.5, 19.92], fill: 5.2 };

console.log('\nB1 - une PRISE le soir ne remplit le marais qu a la maree du soir');
const b1 = { ...J, water: 'priseSoir' };
t('pas d eau a 7 h',            present(7, b1),  false);
t('pas d eau a 18 h',           present(18, b1), false);
t('de l eau a 20 h',            present(20, b1), true);
t('cote basse a 12 h',          cote(12, b1),    1);
t('cote pleine a 20 h',         cote(20, b1),    5.2);
t('matin vide, soir incertain', verdictEau(b1), { m: 'vide', a: 'vide', s: 'incertain' });

console.log('\nB3 - le soir d un RENVOI est incertain, pas plein');
const b3 = { ...J, water: 'renvoiSoir' };
t('de l eau a 7 h',             present(7, b3),  true);
t('de l eau a 21 h',            present(21, b3), true);
t('la cote baisse apres 20 h',  cote(21, b3) < cote(20, b3), true);
t('plancher de vidange 2,60 m', cote(30, b3), 2.6);
t('matin plein, soir incertain', verdictEau(b3), { m: 'plein', a: 'plein', s: 'incertain' });

console.log('\nA1 - un etat inconnu ne promet rien et n affirme rien');
const a1 = { ...J, water: 'inconnu' };
t('aucune eau, donc aucun creneau GO', present(12, a1), false);
t('les trois creneaux incertains', verdictEau(a1), { m: 'incertain', a: 'incertain', s: 'incertain' });
t('la cote n est pas inventee',   cote(12, a1), 1);

console.log('\nvav - le niveau suit la maree, a deux heures pres');
const vv = { ...J, water: 'vav' };
t('eau a la pleine mer du matin', present(7, vv),  true);
t('eau a 9 h, deux heures apres', present(9, vv),  true);
t('pas d eau a 11 h',             present(11, vv), false);
t('eau a la pleine mer du soir',  present(20, vv), true);
t('verdict incertain partout',    verdictEau(vv), { m: 'incertain', a: 'incertain', s: 'incertain' });

console.log('\nB6 - sans maree, rien n est invente');
const b6 = { water: 'vav', fill: 5.2, tides: [] };
t('pas d eau',            present(12, b6), false);
t('incertain et non vide', verdictEau(b6), { m: 'incertain', a: 'incertain', s: 'incertain' });

console.log('\nplein et bas');
t('plein : eau a toute heure',       present(7, { ...J, water: 'plein' }), true);
t('bas : aucune eau',                present(12, { ...J, water: 'bas' }),  false);
t('bas : les trois creneaux vides',  verdictEau({ ...J, water: 'bas' }), { m: 'vide', a: 'vide', s: 'vide' });

console.log('\nC10 - fenetre d hiver large, du 1er octobre au 30 avril');
t('janvier   = 5,00 m', coteSaison('2026-01-15'), 5.0);
t('avril     = 5,00 m', coteSaison('2026-04-30'), 5.0);
t('mai       = 5,20 m', coteSaison('2026-05-01'), 5.2);
t('septembre = 5,20 m', coteSaison('2026-09-24'), 5.2);
t('octobre   = 5,00 m', coteSaison('2026-10-01'), 5.0);

/* ---------------------------------------------------------------------------
   NON-DIVERGENCE scraper.mjs / app.js
   On extrait du navigateur le bloc qui va de lvlIdx a cote, on l'evalue tel
   quel, et on compare ses reponses a celles du serveur sur toute la grille.
   Aucune donnee du site n'est chargee : on ne compare que des formules.
   Si l'extraction echoue, c'est que le bloc a ete deplace ou renomme : le test
   le dit et echoue, plutot que de passer en silence sur une comparaison vide.
   --------------------------------------------------------------------------- */
console.log('\nLES DEUX COPIES DU MODELE DISENT-ELLES LA MEME CHOSE ?');

const APP = readFileSync(join(RACINE, 'app.js'), 'utf8');
const i0 = APP.indexOf('function lvlIdx');
const i1 = APP.indexOf('function pasDe');
let nav = null;
if (i0 < 0 || i1 < 0 || i1 <= i0) {
  ko++;
  console.log('  KO   extraction impossible : lvlIdx ou pasDe introuvable dans app.js');
} else {
  const bloc = APP.slice(i0, i1);
  /* HS et FILL sont declares en tete d app.js ; on les redonne a l identique. */
  nav = new Function('HS', 'FILL', bloc + '\nreturn { present: present, cote: cote };')(
    [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21], 5.2);
  const HSF = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  const ETATS = ['plein', 'bas', 'vav', 'renvoiSoir', 'priseSoir', 'inconnu', 'PAS_UN_ETAT'];
  const MAREES = [[7.5, 19.92], [19.92], [7.5], [], [13.0, 1.2]];
  let cas = 0, ecarts = [];
  for (const water of ETATS) {
    for (const tides of MAREES) {
      const d = { water, tides, fill: 5.2 };
      for (const h of HSF) {
        cas++;
        const ps = present(h, d), pa = nav.present(h, d);
        if (ps !== pa) ecarts.push('present ' + water + ' t=' + JSON.stringify(tides) + ' h=' + h + ' : serveur ' + ps + ', navigateur ' + pa);
        const cs = +cote(h, d).toFixed(6), ca = +nav.cote(h, d).toFixed(6);
        if (cs !== ca) ecarts.push('cote ' + water + ' t=' + JSON.stringify(tides) + ' h=' + h + ' : serveur ' + cs + ', navigateur ' + ca);
      }
    }
  }
  t(cas + ' cas compares, aucun ecart', ecarts.slice(0, 5), []);
  if (ecarts.length > 5) console.log('       et ' + (ecarts.length - 5) + ' autre(s) ecart(s)');

  /* Le repli data.json a la priorite sur la formule, cote navigateur : c est
     ce qui garantit que le serveur reste la source unique quand il a parle. */
  const dj = { water: 'bas', tides: [], fill: 5.2, hs: [7, 8, 9], nav: [true, true, false], lvl: [4.4, 4.4, 1] };
  t('le navigateur suit nav[] avant sa formule', nav.present(7, dj), true);
  t('le navigateur suit lvl[] avant sa formule', nav.cote(7, dj), 4.4);
}

console.log('\n' + (ko ? 'ECHEC : ' + ko + ' test(s) en defaut, ' + ok + ' passes'
                       : 'TOUT PASSE : ' + ok + ' tests'));
process.exit(ko ? 1 : 0);
