/* outils/maj-calendrier.mjs — regenere calendar.json depuis la source ASMG.
   Ajoute le 24/10/2026 (points C7 et C13).

   POURQUOI CET OUTIL EXISTE. calendar.json etait tenu A LA MAIN et s'arretait
   le 28/10/2026, soit quatre jours apres qu'on s'en apercoive. Passe cette
   date, le modele d'eau n'a plus aucun etat d'ecluse et retombe sur sa regle
   de niveau retenu : le site aurait continue d'annoncer un verdict d'eau sans
   dire qu'il ne savait plus. C'est le defaut le plus grave qu'un site de
   conditions puisse produire.

   POURQUOI CE N'EST PAS DANS LE BUILD HORAIRE. Le build tourne toutes les
   heures ; s'il allait chercher l'ASMG a chaque passage, une panne de leur
   serveur ou un changement de leur page casserait le site toutes les heures.
   calendar.json reste donc l'entree du build, versionnee dans le depot, et cet
   outil la rafraichit quand on le lance. Panne de l'ASMG = le site continue
   sur le dernier calendrier connu.

   PAR DEFAUT IL N'ECRIT RIEN. Il affiche ce qu'il changerait. Il faut
   --ecrire pour qu'il touche calendar.json. */

import fs from 'node:fs';
import path from 'node:path';
import { lireAsmg, demiJournees, mareesJour, URL_ROCADE } from '../asmg.mjs';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const FICHIER = path.join(RACINE, 'calendar.json');
const ECRIRE = process.argv.includes('--ecrire');

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function main(jours) {
  const avant = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
  const ecluseAv = avant.ecluse || {}, mareesAv = avant.marees || {};

  /* DEUX POLITIQUES DIFFERENTES, ET C'EST VOULU.
     ECLUSES : la source ASMG fait foi. C'est la decision du 24/10/2026, et la
     confrontation lui donne raison : sur 61 jours saisis a la main, un seul
     etat differe vraiment, et c'est la saisie humaine qui est incoherente avec
     ses propres journees voisines.
     MAREES : la saisie existante est CONSERVEE. Elle vient du SHOM via
     maree.info, qui est une meilleure source d'heures de maree que le tableau
     de l'ASMG. La source ne sert qu'a COMPLETER : les jours que nous n'avions
     pas, et la hauteur de pleine mer, qui n'existait nulle part jusqu'ici et
     que le point C10 attendait. Les divergences d'heure sont affichees, pas
     appliquees. */
  const ecluse = {}, marees = {};
  const divHeure = [], divCoef = [];
  let hAjout = 0;
  for (const j of jours) {
    const d = demiJournees(j, 'rocade');
    if (d.m != null || d.s != null) ecluse[j.date] = { m: d.m, s: d.s };

    const neuf = mareesJour(j);
    const vieux = mareesAv[j.date];
    if (!vieux) { if (Object.keys(neuf).length) marees[j.date] = neuf; continue; }

    const fusion = { ...vieux };
    for (const k of ['pmM', 'pmS']) if ((vieux[k] || null) !== (neuf[k] || null) && vieux[k] && vieux[k] !== '—' && neuf[k]) divHeure.push([j.date, k, vieux[k], neuf[k]]);
    for (const k of ['coM', 'coS']) if ((vieux[k] || null) !== (neuf[k] || null) && vieux[k] && vieux[k] !== '—' && neuf[k]) divCoef.push([j.date, k, vieux[k], neuf[k]]);
    for (const k of ['hmM', 'hmS']) if (vieux[k] == null && neuf[k] != null) { fusion[k] = neuf[k]; hAjout++; }
    marees[j.date] = fusion;
  }

  /* Les journees de calendar.json hors de la portee de la source sont
     conservees : la source couvre le 01/04 au 31/12/2026 et rien ne dit
     qu'elle couvrira toujours tout ce que nous avons deja. */
  const d0 = jours[0].date, d1 = jours[jours.length - 1].date;
  let gardes = 0;
  for (const [k, v] of Object.entries(ecluseAv)) if (k < d0 || k > d1) { ecluse[k] = v; gardes++; }
  for (const [k, v] of Object.entries(mareesAv)) if (k < d0 || k > d1) marees[k] = v;

  const trie = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
  const apres = {
    _note: 'Calendrier des ecluses et marees, regenere depuis la source ASMG par outils/maj-calendrier.mjs. NE PAS EDITER A LA MAIN : la prochaine mise a jour ecraserait la correction. Source : ' + URL_ROCADE + '. Valeurs m (matin) / s (soir) : PRISE, RENVOI, FBM (fermeture basse mer), VAV (va-et-vient), ou null.',
    ecluse: trie(ecluse),
    marees: trie(marees)
  };

  // ---- ce qui change
  const cles = [...new Set([...Object.keys(ecluseAv), ...Object.keys(apres.ecluse)])].sort();
  const ajouts = [], retraits = [], modifs = [];
  for (const k of cles) {
    const a = ecluseAv[k], b = apres.ecluse[k];
    if (a && !b) retraits.push(k);
    else if (!a && b) ajouts.push(k);
    else if (!eq({ m: a.m ?? null, s: a.s ?? null }, { m: b.m ?? null, s: b.s ?? null })) modifs.push([k, a, b]);
  }
  const marAjout = Object.keys(apres.marees).filter(k => !mareesAv[k]).length;

  console.log('\nMISE A JOUR DU CALENDRIER DEPUIS LA SOURCE ASMG');
  console.log('  source   : ' + URL_ROCADE);
  console.log('  lus      : ' + jours.length + ' jours, du ' + d0 + ' au ' + d1);
  console.log('  avant    : ' + Object.keys(ecluseAv).length + ' jours de manoeuvre, dernier ' + (Object.keys(ecluseAv).sort().pop() || 'aucun'));
  console.log('  apres    : ' + Object.keys(apres.ecluse).length + ' jours de manoeuvre, dernier ' + (Object.keys(apres.ecluse).sort().pop() || 'aucun'));
  console.log('  conserves hors portee de la source : ' + gardes);
  console.log('\n  jours ajoutes   : ' + ajouts.length);
  console.log('  jours retires   : ' + retraits.length + (retraits.length ? '  (' + retraits.join(', ') + ')' : ''));
  console.log('  jours modifies  : ' + modifs.length);
  for (const [k, a, b] of modifs) console.log('      ' + k + '   avant {m:' + a.m + ', s:' + a.s + '}   apres {m:' + b.m + ', s:' + b.s + '}');

  console.log('\n  MAREES');
  console.log('    jours ajoutes                 : ' + marAjout);
  console.log('    hauteurs de pleine mer posees : ' + hAjout + '   (champ nouveau, attendu par C10)');
  console.log('    divergences d\'heure NON appliquees : ' + divHeure.length);
  for (const [d, k, a, b] of divHeure) console.log('      ' + d + ' ' + k + '   nous ' + a + '   ASMG ' + b);
  console.log('    divergences de coefficient NON appliquees : ' + divCoef.length);
  for (const [d, k, a, b] of divCoef) console.log('      ' + d + ' ' + k + '   nous ' + a + '   ASMG ' + b);

  const aujourd = new Date().toISOString().slice(0, 10);
  const devant = Object.keys(apres.ecluse).filter(k => k >= aujourd).length;
  console.log('\n  jours de manoeuvre encore devant nous : ' + devant);

  if (!ECRIRE) { console.log('\n  RIEN N\'A ETE ECRIT. Relancer avec --ecrire pour appliquer.\n'); return 0; }
  fs.writeFileSync(FICHIER, JSON.stringify(apres, null, 1) + '\n');
  console.log('\n  calendar.json reecrit. La version precedente reste dans l\'historique git.\n');
  return 0;
}

try {
  process.exit(main(await lireAsmg()));
} catch (e) {
  console.error('\nECHEC : ' + e.message);
  console.error('calendar.json n\'a pas ete touche.\n');
  process.exit(1);
}
