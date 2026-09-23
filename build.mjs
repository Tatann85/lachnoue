// Générateur Chnoue Wing — produit toutes les pages, dans toutes les langues.
// Usage: node build.mjs [dossier_sortie]  (def: _site). FR à la racine, autres langues dans /xx/.
import fs from 'node:fs';
import { META, T } from './i18n.mjs';
const OUT = process.argv[2] || '_site';
const LANGS = Object.keys(T);                 // seules les langues présentes dans i18n
const XDEF = 'fr';
const ORIGIN = 'https://lachnoue.fr';
const FAV = '/Gemini_Generated_Image_fo5ekyfo5ekyfo5e.png';
const FLAG = {
 fr:'<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#fff"/><rect width="1" height="2" fill="#0055A4"/><rect x="2" width="1" height="2" fill="#EF4135"/></svg>',
 en:'<svg viewBox="0 0 60 30"><clipPath id="ukc"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath><rect width="60" height="30" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#ukc)" stroke="#C8102E" stroke-width="4"/><path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/></svg>',
 de:'<svg viewBox="0 0 5 3"><rect width="5" height="3" fill="#000"/><rect y="1" width="5" height="2" fill="#D00"/><rect y="2" width="5" height="1" fill="#FFCE00"/></svg>',
 nl:'<svg viewBox="0 0 9 6"><rect width="9" height="6" fill="#21468B"/><rect width="9" height="4" fill="#fff"/><rect width="9" height="2" fill="#AE1C28"/></svg>',
 es:'<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#c60b1e"/><rect y="0.5" width="3" height="1" fill="#ffc400"/></svg>',
 it:'<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#fff"/><rect width="1" height="2" fill="#009246"/><rect x="2" width="1" height="2" fill="#ce2b37"/></svg>',
 zh:'<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#de2910"/><text x="9" y="12" font-size="9" fill="#ffde00" text-anchor="middle">★</text></svg>',
 br:'<svg viewBox="0 0 90 60"><rect width="90" height="60" fill="#fff"/><g fill="#000"><rect y="0" width="90" height="6.7"/><rect y="13.3" width="90" height="6.7"/><rect y="26.7" width="90" height="6.7"/><rect y="40" width="90" height="6.7"/><rect y="53.3" width="90" height="6.7"/></g><rect width="40" height="33.3" fill="#fff"/></svg>'
};
const CSS = fs.readFileSync('./styles.css','utf8');
function url(lang,pg){ const base = lang===XDEF ? '' : '/'+lang; if(pg==='index') return (base||'')+'/'; return base+'/'+PAGES[pg].file; }
function abs(lang,pg){ return ORIGIN+url(lang,pg); }
const PAGES = { index:{file:'index.html'}, alerts:{file:'alertes.html'}, club:{file:'association.html'}, lessons:{file:'cours.html'}, contact:{file:'contact.html'} };
// Feuille de style propre a l'onglet alertes : injectee sur cette seule page.
// styles.css est inline dans les 40 pages du site, y mettre ce bloc alourdirait
// chaque page pour une seule d'entre elles.
const CSSAL = fs.readFileSync('./alertes.css','utf8');
function hreflangs(pg){ let s=''; for(const l of LANGS) s+='<link rel="alternate" hreflang="'+META[l].htmlLang+'" href="'+abs(l,pg)+'">\n'; s+='<link rel="alternate" hreflang="x-default" href="'+abs(XDEF,pg)+'">\n'; return s; }
function langSwitch(lang,pg){
 // Menu deroulant "Language" : drapeau + nom de la langue. Sans JavaScript (element <details>).
 let s='<details class="lang"><summary aria-label="Language"><span class="lang-cur">'+FLAG[lang]+'</span><span class="lang-lbl">Language</span><span class="lang-car" aria-hidden="true">&#9662;</span></summary><div class="lang-menu">';
 for(const l of LANGS){ s+='<a'+(l===lang?' class="on" aria-current="true"':'')+' href="'+url(l,pg)+'" hreflang="'+META[l].htmlLang+'" lang="'+META[l].htmlLang+'"><span class="lang-fl">'+FLAG[l]+'</span><span class="lang-nm">'+META[l].name+'</span></a>'; }
 return s+'</div></details>';
}
function head(lang,pg,extra){ const t=T[lang]; extra=extra||{}; const title=extra.title||t.title; const desc=extra.desc||t.desc; const robots=extra.robots||'index, follow';
 return '<!DOCTYPE html>\n<html lang="'+META[lang].htmlLang+'">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
 +'<title>'+title+'</title>\n<meta name="description" content="'+desc+'">\n'
 +(extra.keywords!==false?'<meta name="keywords" content="'+t.keywords+'">\n':'')
 +'<meta name="robots" content="'+robots+'">\n<meta name="theme-color" content="#12857f">\n'
 +'<link rel="icon" type="image/png" href="'+FAV+'">\n<link rel="apple-touch-icon" href="'+FAV+'">\n'
 +'<link rel="preload" as="font" type="font/woff2" href="/fonts/anton-latin-400.woff2" crossorigin>\n'
 +'<link rel="canonical" href="'+abs(lang,pg)+'">\n'+hreflangs(pg)
 +'<meta property="og:type" content="website">\n<meta property="og:locale" content="'+META[lang].ogLocale+'">\n<meta property="og:url" content="'+abs(lang,pg)+'">\n'
 +'<meta property="og:title" content="'+t.ogtitle+'">\n<meta property="og:description" content="'+desc+'">\n<meta property="og:image" content="'+ORIGIN+'/banniere.jpg">\n'
 +(extra.jsonld?'<script type="application/ld+json">'+extra.jsonld+'</script>\n':'')
 +'<style>'+CSS+'</style>\n'
 +(extra.css?'<style>'+extra.css+'</style>\n':'')+'</head>\n';
}
function shell(lang,pg,active,body,extra){ const t=T[lang];
 // L'onglet alertes est en 2e position, demande d'Antoine le 20/09/2026.
 const tabs='<nav class="tabs" aria-label="nav"><a class="tab'+(active==='index'?' active':'')+'" href="'+url(lang,'index')+'">'+t.tabHome+'</a>'
  +'<a class="tab'+(active==='alerts'?' active':'')+'" href="'+url(lang,'alerts')+'">'+t.tabAlerts+'</a>'
  +'<a class="tab'+(active==='club'?' active':'')+'" href="'+url(lang,'club')+'">'+t.tabClub+'</a>'
  +'<a class="tab'+(active==='lessons'?' active':'')+'" href="'+url(lang,'lessons')+'">'+t.tabLessons+'</a>'
  +'<a class="tab'+(active==='contact'?' active':'')+'" href="'+url(lang,'contact')+'">'+t.tabContact+'</a></nav>';
 const banner='<div class="banner"><img src="/banniere.jpg" alt="Les Sables-d\'Olonne &mdash; La Ch\'noue" fetchpriority="high">'
  +langSwitch(lang,pg)
  +'<div class="banner-cap"><p class="eyebrow">Les Sables-d\'Olonne &middot; Vend&eacute;e</p><span class="brand">La Ch\'noue</span></div>'
  +'<svg class="wave" viewBox="0 0 1000 32" preserveAspectRatio="none"><path d="M0 20 C180 4 340 4 520 15 C700 27 860 20 1000 11 L1000 32 L0 32 Z" fill="#f6fbfb"></path></svg>'
  +'</div>';
 return head(lang,pg,extra)+'<body>\n'+banner+'\n<div class="wrap">\n'+tabs+'\n'+body+'\n</div>\n'
  +(extra&&extra.tail?extra.tail:'')
  +'<script data-goatcounter="https://lachnoue.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>\n</body>\n</html>\n';
}
/* L'objet T entier est inline dans la page pour le JavaScript. Les textes de
   l'onglet alertes (prefixe al) pesent environ 4 ko et ne servent qu'a
   alertes.js : on les retire de la page d'accueil, qui est la plus visitee.
   A l'inverse alertes.js n'a pas besoin des textes du tableau 9 jours. */
function sansAl(t){ const o={}; for(const k in t) if(!/^al[A-Z]/.test(k)) o[k]=t[k]; return o; }
function faqHtml(t){ let s='<div class="faq">'; for(const q of t.faq) s+='<details><summary>'+q[0]+'</summary><p>'+q[1]+'</p></details>'; return s+'</div>'; }
function faqLd(lang){ const t=T[lang]; return JSON.stringify({"@context":"https://schema.org","@type":"FAQPage",mainEntity:t.faq.map(q=>({"@type":"Question",name:q[0],acceptedAnswer:{"@type":"Answer",text:q[1].replace(/<[^>]+>/g,'')}}))}); }
function legalHtml(t){ return '<details class="legal"><summary>'+t.legalSummary+'</summary><p>'+t.legal+'</p></details>'; }
/* true : la carte ne se charge qu'apres un clic du visiteur. Voir renderIndex. */
const CARTE_AU_CLIC = true;
const MAPS='https://www.google.com/maps/dir/?api=1&destination=Bassin+de+la+Chnoue,+85100+Les+Sables-d%27Olonne&waypoints=46.50528,-1.80045%7CGymnase+des+Sauniers,+8+Impasse+de+la+Salle+des+Sauniers,+85100+Les+Sables-d%27Olonne';
const MAPSEMBED='https://www.google.com/maps?q=Gymnase+des+Sauniers,+8+Impasse+de+la+Salle+des+Sauniers,+85100+Les+Sables-d%27Olonne&z=16&output=embed';

function card(cls,href,hd,grad,ti,su,t){ return '<a class="lcard" href="'+href+'" target="_blank" rel="noopener"><div class="hd" style="background:'+grad+'">'+hd+'</div><div class="bd"><div class="t">'+ti+'</div><div class="s">'+su+'</div><div class="go2">'+t.open+'</div></div></a>'; }

function renderIndex(lang){ const t=T[lang];
 const jsonld=JSON.stringify({"@context":"https://schema.org","@type":["SportsActivityLocation","TouristAttraction"],name:"La Ch'noue — Les Sables-d'Olonne",url:abs(lang,'index'),description:t.desc,sport:["Wingfoil","Windsurf","Windfoil"],address:{"@type":"PostalAddress",addressLocality:"Les Sables-d'Olonne",postalCode:"85100",addressRegion:"Vendée",addressCountry:"FR"},geo:{"@type":"GeoCoordinates",latitude:46.498,longitude:-1.793}});
 const cards='<div class="cards">'
  +card('','https://www.winds-up.com/spot-saint-gilles-croix-de-vie-windsurf-kitesurf-133-observations-releves-vent.html',t.cLiveWind,'linear-gradient(135deg,#0891b2,#22c1d6)',t.cSgT,t.cSgS,t)
  +card('','https://www.winds-up.com/spot-les-sables-dolonnes-windsurf-kitesurf-1658-observations-releves-vent.html',t.cLiveWind,'linear-gradient(135deg,#0e7490,#0891b2)',t.cLsT,t.cLsS,t)
  +card('','https://www.windguru.cz/48522',t.cWindguru,'linear-gradient(135deg,#2b6cb0,#1f9b8e)',t.cWgT,t.cWgS,t)
  +card('','https://www.asmg85.fr/page-calendrier-rocade/',t.cLock,'linear-gradient(135deg,#1f8f4e,#3aa76d)',t.cLoT,t.cLoS,t)
  +card('','https://maree.info/125',t.cTides,'linear-gradient(135deg,#c9851a,#e0a93c)',t.cTiT,t.cTiS,t)
  +card('','https://meteofrance.com/previsions-meteo-france/les-sables-d-olonne/85100',t.cWeather,'linear-gradient(135deg,#0a6bb3,#37a0dd)',t.cWeT,t.cWeS,t)
  +'</div>';
 const cams='<div class="cams">'
  +'<a class="cam" href="https://www.skaping.com/sables-d-olonne/port-olona/panoramique" target="_blank" rel="noopener"><div class="view"><span class="live">'+t.live+'</span><span class="play">▶</span></div><div class="bd"><div class="t">'+t.camPort+'</div><div class="s">'+t.camPortS+'</div></div></a>'
  +'<a class="cam" href="https://viewsurf.com/univers/surf/vue/4511-france-pays-de-la-loire-les-sables-dolonne-baie-des-sables" target="_blank" rel="noopener"><div class="view"><span class="live">'+t.live+'</span><span class="play">▶</span></div><div class="bd"><div class="t">'+t.camBay+'</div><div class="s">'+t.camBayS+'</div></div></a>'
  +'</div>';
 /* CARTE AU CLIC (22/09/2026). L'iframe Google Maps declenchait 18 requetes
    vers Google des l'ouverture de la page d'accueil : chaque visiteur y laissait
    son adresse IP sans rien demander. Elle n'est plus chargee qu'apres un clic.
    Le bouton d'itineraire reste un simple lien : rien ne part tant qu'on ne
    clique pas dessus non plus.
    Pour revenir a la carte affichee d'emblee : passer CARTE_AU_CLIC a false,
    et corriger la phrase des mentions legales, qui dit aujourd'hui que rien ne
    part avant le clic. Les deux vont ensemble. */
 const carte = CARTE_AU_CLIC
  ? '<div class="carte" id="carte" data-src="'+MAPSEMBED+'" data-titre="'+t.accessIframe+'">'
    +'<button type="button" class="carte-bt" id="carteBt">&#128506;&#65039; '+t.mapShow+'</button>'
    +'<p class="carte-note">'+t.mapNote+'</p></div>'
  : '<div style="border:1px solid var(--line);border-radius:10px;overflow:hidden"><iframe title="'+t.accessIframe+'" src="'+MAPSEMBED+'" style="width:100%;height:360px;border:0;display:block" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>';
 const access='<h2>'+t.h2Access+'</h2>'+carte+'<div style="font-size:12px;color:#48535f;margin-top:6px">'+t.accessHtml+'<a href="'+MAPS+'" target="_blank" rel="noopener" style="display:block;text-align:center;background:var(--water);color:#fff;font-weight:800;font-size:15px;padding:14px 16px;border-radius:10px;text-decoration:none;margin-top:10px;box-shadow:0 3px 12px rgba(18,133,127,.32)">'+t.accessBtn+'</a></div>';
 const body='<h1>'+t.h1+'</h1>\n<div class="explain">'+t.explain+'</div>\n'
  +'<div class="hint"><span>👆</span><span>'+t.hint+'<br><span class="upd" id="upd">'+t.updBefore+' <b>—</b> '+t.updAfter+'</span></span></div>\n'
  +'<table><thead><tr><th class="jour" style="text-align:left">'+t.thDay+'</th><th>'+t.thRating+'</th><th>'+t.thWater+'</th><th>'+t.thWind+'</th><th>'+t.thDir+'</th><th>'+t.thGo+'</th></tr></thead><tbody id="tb"></tbody></table>\n'
  +'<div class="nota">'+t.nota+'</div>\n'
  +'<h2>'+t.h2Links+'</h2>'+cards
  +'<h2>'+t.h2Cams+'</h2>'+cams
  +access
  +'<h2>'+t.h2Faq+'</h2>'+faqHtml(t)
  +'<script type="application/ld+json">'+faqLd(lang)+'</script>'
  +legalHtml(t);
 const tail='<script>window.LANG='+JSON.stringify(lang)+';window.T='+JSON.stringify(sansAl(t))+';</script>\n<script src="/app.js" defer></script>\n';
 return shell(lang,'index','index',body,{jsonld:jsonld,tail:tail});
}
/* ---- Onglet « Mes alertes conditions par mail » (20/09/2026) ----
   Le balisage est produit ici, traduit, et alertes.js ne fait qu'y accrocher
   le comportement : la page reste lisible et indexable sans JavaScript.
   Les identifiants sont contractuels avec alertes.js, ne pas les renommer. */
function renderAlertes(lang){ const t=T[lang];
 const cur=(cle,lbl,txt,lo,hi)=>'<div class="cur"><div class="cur-hd"><span>'+lbl+'</span><b><span id="'+cle+'Txt">'+txt+'</span></b></div>'
  +'<div class="rail" id="rail'+cle.toUpperCase()+'"><div class="fond"></div><div class="plein" id="pl'+cle.toUpperCase()+'"></div>'
  +'<button type="button" class="poi" id="'+cle+'MinP" aria-label="'+lbl+' min"></button>'
  +'<button type="button" class="poi" id="'+cle+'MaxP" aria-label="'+lbl+' max"></button></div>'
  +'<div class="bornes"><span>'+lo+'</span><span>'+hi+'</span></div></div>';
 const gauche='<div class="al-reglages">'
  +'<section class="bloc"><h2>'+t.alNameH+'</h2>'
   +'<label for="alNom">'+t.alNameLbl+'</label>'
   +'<input id="alNom" type="text" maxlength="48" value="'+t.alNameDef+'">'
   +'<p class="aide">'+t.alNameHelp+'</p>'
   +'<p class="aide" style="margin-top:14px"><b>'+t.alWhatH+'</b></p>'
   +'<div class="pils"><button type="button" class="pil mode on" id="mNav" aria-pressed="true">'+t.alModeNav+'</button>'
   +'<button type="button" class="pil mode" id="mSec" aria-pressed="false">'+t.alModeSec+'</button></div>'
   +'<p class="aide" id="noteSec" hidden>'+t.alSecNote+'</p></section>'
  +'<section class="bloc" id="bVent"><h2>'+t.alWindH+' <small>'+t.alWindSub+'</small><span class="badge-off" id="offV" hidden>'+t.alNeutral+'</span></h2>'
   +cur('v',t.alWindAvg,'12 – 28',5,40)+cur('r',t.alWindGust,'12 – 34',5,50)
   +'<div class="recap" id="recap"></div></section>'
  +'<section class="bloc" id="bRose"><h2>'+t.alDirH+' <small>'+t.alDirSub+'</small><span class="badge-off" id="offR" hidden>'+t.alNeutral+'</span></h2>'
   +'<button type="button" class="pil grand" id="btTout" aria-pressed="false">'+t.alDirAll+'</button>'
   +'<svg class="rose" id="rose" viewBox="0 0 320 320" role="img" aria-label="'+t.alDirH+'"></svg>'
   +'<label>'+t.alDirStart+'</label><div class="dirs"><button type="button" class="fl" id="aM" aria-label="&minus;">&#8592;</button>'
   +'<span class="nom" id="nomA">SO</span><button type="button" class="fl" id="aP" aria-label="+">&#8594;</button></div>'
   +'<label style="margin-top:10px">'+t.alDirEnd+'</label><div class="dirs"><button type="button" class="fl" id="bM" aria-label="&minus;">&#8592;</button>'
   +'<span class="nom" id="nomB">NE</span><button type="button" class="fl" id="bP" aria-label="+">&#8594;</button></div>'
   +'<p class="aide" id="aideRose"></p></section>'
  +'<section class="bloc"><h2>'+t.alWaterH+'</h2>'
   +'<div class="pils"><button type="button" class="pil" id="btFlou" aria-pressed="false">'+t.alFlou+'</button></div>'
   +'<p class="aide">'+t.alWaterNote+'</p><p class="aide">'+t.alFoilNote+'</p></section>'
  +'<section class="bloc"><h2>'+t.alWhenH+'</h2>'
   +'<label>'+t.alSlots+'</label><div class="pils" id="pCre"></div>'
   +'<label style="margin-top:14px">'+t.alDaysL+'</label><div class="pils" id="pJours"></div></section>'
  +'<section class="bloc"><h2>'+t.alNotifH+'</h2><div class="pils" id="pRyt"></div>'
   +'<div class="dirs" id="zoneX" hidden style="max-width:240px;margin-top:10px">'
   +'<button type="button" class="fl" id="xM" aria-label="&minus;">&minus;</button>'
   +'<span class="nom" id="xTxt">3</span><button type="button" class="fl" id="xP" aria-label="+">+</button></div>'
   +'<p class="aide" id="noteRyt"></p></section>'
  +'</div>';
 const apercu='<div class="al-apercu"><div class="apercu" id="apercu"><p class="eyebrow">'+t.alPrevH+'</p><p class="nomal" id="apTitre"></p>'
   +'<div style="display:flex;align-items:baseline;gap:9px"><span class="gros" id="nbJ">0</span>'
   +'<span style="font-size:13.5px" id="motJ"></span></div><div class="sep"></div><div id="liste"></div></div></div>';
 const formulaire='<div class="al-form">'
  +'<section class="bloc" id="alForm"><h2>'+t.alWhereH+'</h2>'
   +'<label for="alMail">'+t.alEmail+'</label><input id="alMail" type="email" placeholder="'+t.alEmailP+'">'
   +'<div class="coche"><input id="alOk" type="checkbox"><label for="alOk">'+t.alConsent+'</label></div>'
   +'<div class="coche"><input id="alNews" type="checkbox"><label for="alNews">'+t.alNews+' <span class="opt">'+t.alOptional+'</span></label></div>'
   +'<p class="aide">'+t.alNewsHelp+'</p>'
   +'<button type="button" class="envoi" id="creer">'+t.alSend+'</button>'
   +'<p class="aide">'+t.alAfterSend+'</p></section>'
  +'<div class="alok" id="alDone"><b>'+t.alOkTitle+'</b>'+t.alOkBody+'</div>'
  +'<div class="garde"><b>'+t.alGuardT+'</b><p>'+t.alGuardP+'</p></div>'
  +'</div>';
 const body='<h1>'+t.alH1+'</h1><p class="al-lead">'+t.alLead+'</p>'
  +'<p class="al-fronly">'+t.alFrOnly+'</p>'
  +'<div class="al" id="alPage">'+apercu+gauche+formulaire+'</div>'
  +legalHtml(t);
 const tail='<script>window.LANG='+JSON.stringify(lang)+';window.T='+JSON.stringify(t)+';</script>\n<script src="/alertes.js" defer></script>\n';
 return shell(lang,'alerts','alerts',body,{title:t.alTitle,desc:t.alDesc,keywords:false,css:CSSAL,tail:tail});
}
function visu(href,badge,shot,ctaHost,t){ return '<div class="visu"><a href="'+href+'" target="_blank" rel="noopener"><div class="visu-frame"><img src="https://s.wordpress.com/mshots/v1/'+encodeURIComponent(href)+'?w=1200&h=750" alt="'+badge+'" loading="lazy"><span class="visu-badge">'+badge+' ↗</span></div><span class="visu-cta">'+t.visit+' '+ctaHost+' →</span></a></div>'; }
function renderClub(lang){ const t=T[lang];
 const body='<h1>'+t.clubH1+'</h1><p class="lead">'+t.clubLead+'</p>'+visu('https://wingfoil-sablais.fr/','Wingfoil Sablais','','wingfoil-sablais.fr',t)
  +'<h2>'+t.h2Faq+'</h2>'+faqHtml(t)+legalHtml(t);
 return shell(lang,'club','club',body,{title:t.clubTitle,desc:t.clubDesc,keywords:false});
}
function renderLessons(lang){ const t=T[lang];
 const body='<h1>'+t.lesH1+'</h1><p class="lead">'+t.lesLead+'</p><div class="schools">'
  +visu('https://vertimewingfoil.com/','Vertime Wingfoil','','vertimewingfoil.com',t)
  +visu('https://initiawing.fr/',"Initia'Wing",'','initiawing.fr',t)
  +'</div><h2>'+t.h2Faq+'</h2>'+faqHtml(t)+legalHtml(t);
 return shell(lang,'lessons','lessons',body,{title:t.lesTitle,desc:t.lesDesc,keywords:false});
}
function renderContact(lang){ const t=T[lang];
 const form='<form class="cform" id="cform" action="https://formspree.io/f/mgogleqp" method="POST"><input type="hidden" name="_subject" value="Nouveau message via lachnoue.fr"><input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off">'
  +'<label for="c-nom">'+t.conName+'</label><input id="c-nom" name="name" type="text" placeholder="'+t.conNameP+'" required>'
  +'<label for="c-email">'+t.conEmail+' <span style="font-weight:400;color:var(--muted)">'+t.conEmailHint+'</span></label><input id="c-email" name="email" type="email" placeholder="'+t.conEmailP+'" required>'
  +'<label for="c-msg">'+t.conMsg+'</label><textarea id="c-msg" name="message" placeholder="'+t.conMsgP+'" required></textarea>'
  +'<button class="csend" type="submit">'+t.conSend+'</button><div class="cnote">'+t.conNote+'</div></form>'
  +'<div class="cok" id="cok">'+t.conOk+'</div>';
 const body='<h1>'+t.conH1+'</h1><p class="cintro">'+t.conIntro+'</p>'+form+'<h2>'+t.h2Faq+'</h2>'+faqHtml(t)+legalHtml(t);
 const tail='<script>(function(){var f=document.getElementById("cform");if(!f)return;f.addEventListener("submit",function(e){e.preventDefault();var b=f.querySelector(".csend");b.textContent='+JSON.stringify(t.conSending)+';b.disabled=true;fetch(f.action,{method:"POST",body:new FormData(f),headers:{"Accept":"application/json"}}).then(function(r){if(r.ok){f.style.display="none";var k=document.getElementById("cok");k.style.display="block";k.scrollIntoView({behavior:"smooth",block:"center"});}else{b.textContent='+JSON.stringify(t.conSend)+';b.disabled=false;alert('+JSON.stringify(t.conErr)+');}}).catch(function(){b.textContent='+JSON.stringify(t.conSend)+';b.disabled=false;alert('+JSON.stringify(t.conErr)+');});});})();</script>\n';
 return shell(lang,'contact','contact',body,{title:t.conTitle,desc:t.conDesc,keywords:false,tail:tail});
}
// écrire
for(const lang of LANGS){ const dir = lang===XDEF ? OUT : OUT+'/'+lang; fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(dir+'/index.html',renderIndex(lang));
 fs.writeFileSync(dir+'/alertes.html',renderAlertes(lang));
 fs.writeFileSync(dir+'/association.html',renderClub(lang));
 fs.writeFileSync(dir+'/cours.html',renderLessons(lang));
 fs.writeFileSync(dir+'/contact.html',renderContact(lang));
}
fs.copyFileSync('./app.js', OUT + '/app.js');
fs.copyFileSync('./alertes.js', OUT + '/alertes.js');
// Les polices sont servies par le site : le workflow ne copie que les images,
// c'est donc ici qu'on les recopie, comme app.js.
fs.mkdirSync(OUT + '/fonts', { recursive: true });
for (const f of ['anton-latin-400.woff2','OFL.txt']) fs.copyFileSync('./fonts/'+f, OUT + '/fonts/' + f);
// sitemap multilingue
(function(){
  const smPages = ['index','alerts','club','lessons','contact'];
  let sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  for (const pg of smPages) {
    for (const l of LANGS) {
      sm += '  <url>\n    <loc>' + abs(l, pg) + '</loc>\n';
      for (const a of LANGS) sm += '    <xhtml:link rel="alternate" hreflang="' + META[a].htmlLang + '" href="' + abs(a, pg) + '"/>\n';
      sm += '    <xhtml:link rel="alternate" hreflang="x-default" href="' + abs(XDEF, pg) + '"/>\n';
      sm += '    <changefreq>' + (pg === 'index' || pg === 'alerts' ? 'daily' : 'monthly') + '</changefreq>\n';
      sm += '    <priority>' + (pg === 'index' ? (l === XDEF ? '1.0' : '0.9') : (pg === 'alerts' ? '0.8' : '0.6')) + '</priority>\n  </url>\n';
    }
  }
  sm += '</urlset>\n';
  fs.writeFileSync(OUT + '/sitemap.xml', sm);
})();
console.log('Généré:', LANGS.join(','), '→', OUT);
