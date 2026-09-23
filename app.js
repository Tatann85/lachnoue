/* Chnoue Wing — logique du tableau 9 jours, partagée par toutes les langues.
   Lit window.T (traductions de la langue) et window.LANG. */
(function(){
var T=window.T||{}, LANG=window.LANG||'fr';
var HS=[7,8,9,10,11,12,13,14,15,16,17,18,19,20,21], FILL=5.2;
/* ---------------------------------------------------------------------------
   SEUILS DU SITE, regroupes ici pour n'avoir qu'un seul endroit a modifier.
   ATTENTION : ces valeurs ne sont PAS calibrees sur des sessions reelles.
   C'est le point C5 du backlog. Elles sont volontairement prudentes.
   --------------------------------------------------------------------------- */
var GO_MIN       = 11; /* vent moyen mini (kn) pour afficher un creneau GO.
                          B12 : etait a 10, soit exactement le seuil de 1 etoile,
                          donc un jour note 1/5 affichait quand meme un GO. */
var GO_GUST_MAX  = 30; /* au-dela de cette rafale (kn), aucun creneau GO.
                          A4 : 11 kn de moyen avec 35 kn de rafale donnait un GO vert. */
var NOTE_STRONG  = 30; /* au-dela (kn), la note est plafonnee a 2 etoiles. */
var NOTE_TOOMUCH = 35; /* au-dela (kn), la note tombe a 1 etoile : trop de vent.
                          A5 : la note ne redescendait jamais, 40 kn valait 5 etoiles. */
/* Un creneau GO exige-t-il une certitude sur l'eau ?
   Aujourd'hui NON, et c'est le comportement historique : le GO ne regarde que
   present(), donc un jour de va-et-vient ou le soir d'un renvoi peuvent afficher
   un GO vert alors que data.json classe le creneau « incertain ». Le robot
   d'alerte, lui, respecte « incertain ». Le site et le mail ne racontent donc
   pas tout a fait la meme chose sur ces creneaux.
   Passer cette constante a true aligne les deux : plus aucun GO sur un creneau
   incertain. Mesure sur tout le calendrier avant de basculer, l'effet est
   important les jours de va-et-vient, frequents en novembre. Voir le backlog. */
var GO_EXIGE_CERTITUDE = false;
function eauCre(h,d){ if(!d.eau) return null; return d.eau[h<=12?'m':(h<=17?'a':'s')]; }
function isGo(w,d){
  if(w[0]<7 || w[0]>21) return false;
  if(GO_EXIGE_CERTITUDE){ if(eauCre(w[0],d)!=='plein') return false; }
  else if(!present(w[0],d)) return false;
  return w[1]>=GO_MIN && w[2]<GO_GUST_MAX;
}
var SM={fr:['N','NE','E','SE','S','SO','O','NO'],en:['N','NE','E','SE','S','SW','W','NW'],de:['N','NO','O','SO','S','SW','W','NW'],nl:['N','NO','O','ZO','Z','ZW','W','NW'],es:['N','NE','E','SE','S','SO','O','NO'],it:['N','NE','E','SE','S','SO','O','NO'],zh:['N','NE','E','SE','S','SW','W','NW'],br:['N','NE','E','SE','S','SW','W','NW']};
var SECT=SM[LANG]||SM.en;
function sIdx(d){return Math.round(((d%360)+360)%360/45)%8;}
function sectOf(d){return SECT[sIdx(d)];}
function favIdx(i){return (i===0||i===6||i===7)?'good':i===5?'mid':'bad';}
function favOf(d){return favIdx(sIdx(d));}
var favCls=function(f){return f==='good'?'d-good':f==='mid'?'d-mid':'d-bad';};
function avgDir(ds){var x=0,y=0;ds.forEach(function(d){x+=Math.cos(d*Math.PI/180);y+=Math.sin(d*Math.PI/180);});return (Math.atan2(y,x)*180/Math.PI+360)%360;}
function mean(a){return a.reduce(function(s,v){return s+v;},0)/a.length;}
function wc(k){return k<8?'#eef3f6':k<12?'#cdebd6':k<16?'#83d483':k<20?'#f2df76':k<25?'#f4b657':k<30?'#ef8a4e':k<40?'#e2553f':'#a4508b';}
function wtc(k){return k<25?'#1f2a36':'#fff';}
function stars(n){var s='';for(var i=0;i<5;i++)s+=i<n?'★':'<span class="o">★</span>';return s;}
function favColor(f){return f==='good'?'#0f6e56':f==='mid'?'#c9851a':'#b23b3b';}
// Boussole HTML (colonne DIR.) : cadran + aiguille orientée dans le sens où va le vent.
function compassHTML(deg,col){return '<svg viewBox="0 -8 40 46" style="width:34px;height:39px;display:inline-block;vertical-align:middle" aria-hidden="true">'
 +'<text x="20" y="-1" text-anchor="middle" font-size="8" fill="#5c716d" font-weight="700">N</text>'
 +'<circle cx="20" cy="20" r="18" fill="#fff" stroke="#cfdad7" stroke-width="1.6"/>'
 +'<g transform="rotate('+deg+' 20 20)"><path d="M20 4 L29 33 L20 26.5 L11 33 Z" fill="'+col+'"/></g>'
 +'</svg>';}
// Boussole SVG (dans le graphique) : dessinée en éléments, translatée à (cx,cy).
function chartCompass(cx,cy,r,deg,col){var s='<g transform="translate('+cx.toFixed(1)+','+cy+')">';
 s+='<text x="0" y="'+(-r-3).toFixed(1)+'" text-anchor="middle" font-size="'+(r*0.55).toFixed(1)+'" fill="#5c716d" font-weight="700">N</text>';
 s+='<circle r="'+r+'" fill="#fff" stroke="#cfdad7" stroke-width="1.2"/>';
 s+='<g transform="rotate('+deg+')"><path d="M0 '+(-r+2).toFixed(1)+' L'+(r*0.6).toFixed(1)+' '+(r-1.5).toFixed(1)+' L0 '+(r*0.34).toFixed(1)+' L'+(-r*0.6).toFixed(1)+' '+(r-1.5).toFixed(1)+' Z" fill="'+col+'"/></g>';
 s+='</g>';return s;}
var SDEG={N:0,NE:45,E:90,SE:135,S:180,SO:225,O:270,NO:315,SW:225,W:270,NW:315,ZO:135,Z:180,ZW:225};
function sectDeg(s){return SDEG[s]||0;}
function ecl(state){var t=(state||'').toLowerCase();
  if(t.indexOf('prise')>=0)return [T.eFill,'b-prise',T.eFillD];
  if(t.indexOf('renvoi')>=0)return [T.eDrain,'b-renvoi',T.eDrainD];
  if(t.indexOf('va')>=0)return [T.eTidal,'b-vav',T.eTidalD];
  if(t.indexOf('basse')>=0||t.indexOf('fbm')>=0)return [T.eLow,'b-renvoi',T.eLowD];
  return [T.eClosed,'b-rien',T.eClosedD];}
function eclHTML(state){var e=ecl(state);return '<span class="badge '+e[1]+'">'+e[0]+'</span> '+e[2];}
function wx(c){c=(c||'').toLowerCase();if(/ensoleill|sunny|sonnig|zonnig/.test(c))return '☀️';if(/clair|clear|heiter|helder/.test(c))return '🌤️';if(/peu nuageux|partly|wolkig|bewolkt/.test(c))return '⛅';if(/voil/.test(c))return '🌥️';if(/couvert|nuageux|cloud|overcast|bedeckt|bewolkt/.test(c))return '☁️';if(/averse|pluie|bruine|rain|drizzle|shower|regen/.test(c))return '🌧️';if(/orage|thunder|storm|gewitter|onweer/.test(c))return '⛈️';if(/brum|brouill|fog|mist|nebel/.test(c))return '🌫️';if(/neige|snow|schnee|sneeuw/.test(c))return '🌨️';return '🌤️';}
// 5,20 ou 5.20 selon la langue. L'anglais est la seule a utiliser le point.
function fmtCote(v){ var t=Number(v).toFixed(2); return LANG==='en' ? t : t.replace('.',','); }
var DOW=T.dow||{};
function trDay(s){return String(s).replace(/^(Lun|Mar|Mer|Jeu|Ven|Sam|Dim)/,function(m){return DOW[m]||m;});}

/* A3 : il y avait ici une journee du 30/06/2026 en dur, qui servait de tableau
   de secours. Si data.json ne chargeait pas, le site affichait cette journee
   telle quelle, annoncant de l'eau et un creneau GO, sans aucun message.
   Un visiteur pouvait se deplacer sur la foi d'une donnee de juin.
   Desormais : rien tant que les vraies donnees ne sont pas la, et un message
   explicite si elles n'arrivent pas. Ne jamais remettre de donnees en dur ici. */
var days=[];

/* NIVEAU D'EAU — le calcul a ete remonte dans scraper.mjs le 20/09/2026.
   data.json porte desormais nav[] (y a-t-il de l'eau) et lvl[] (la cote), aux
   heures listees dans hs[]. Le site et le robot d'alerte lisent la meme chose :
   il ne peut plus y avoir deux verdicts differents pour la meme journee.
   Les deux replis ci-dessous servent si le navigateur charge un data.json
   anterieur a ce changement. Ne pas les supprimer sans verifier que plus aucun
   cache ne peut servir l'ancien fichier. */
function lvlIdx(h,d){var t=d.hs||HS;var i=t.indexOf(h);return i;}
/* Ecart a la maree la plus proche. B4 : data.json porte desormais tides[], les
   DEUX pleines mers du jour, en heures decimales (18,92 pour 18 h 55). B5 : plus
   d'arrondi a l'heure. B6 : liste vide = pas de fenetre, on ne repond pas oui. */
function ecartM(h,d){
  var T=(d.tides&&d.tides.length)?d.tides:(d.tideHigh!=null?[d.tideHigh]:[]);
  if(!T.length)return null;
  var e=null;for(var i=0;i<T.length;i++){var v=Math.abs(h-T[i]);if(e===null||v<e)e=v;}
  return e;}
function mareeSoir(d){
  var T=(d.tides&&d.tides.length)?d.tides:(d.tideHigh!=null?[d.tideHigh]:[]);
  var s=T.filter(function(t){return t>=12;});
  if(s.length)return Math.min.apply(null,s);
  return T.length?Math.max.apply(null,T):null;}
function present(h,d){
  if(d.nav){var i=lvlIdx(h,d);if(i>=0&&d.nav[i]!=null)return !!d.nav[i];}
  if(d.water==='plein')return true;
  if(d.water==='renvoiSoir')return h<=21;
  if(d.water==='priseSoir'){var t=mareeSoir(d);return t!==null&&h>=t;}
  if(d.water==='vav'){var e=ecartM(h,d);return e!==null&&e<=2;}
  return false;}
function cote(h,d){
  if(d.lvl){var i=lvlIdx(h,d);if(i>=0&&d.lvl[i]!=null)return d.lvl[i];}
  if(d.water==='plein')return FILL;
  if(d.water==='priseSoir'){var t=mareeSoir(d);return (t!==null&&h>=t)?FILL:1;}
  if(d.water==='renvoiSoir')return h<=20?FILL:Math.max(2.6,FILL-0.85*(h-20));
  if(d.water==='vav'){var e=ecartM(h,d);return e===null?1:Math.max(0.8,FILL-0.55*e);}
  return 1;}
/* B9 — le pas d'echantillonnage etait cable a 2 h dans le regroupement des
   creneaux GO. Avec des donnees horaires, deux heures GO separees par une heure
   sans vent auraient ete fusionnees en une seule plage continue. Le pas est
   desormais lu dans data.json (champ pas), avec repli a 2 h pour un ancien
   fichier encore en cache. */
function pasDe(d){ return (d&&d.hs&&d.hs.length>=12)?1:2; }
function goGroups(hs,pas){pas=pas||2;hs=hs.slice().sort(function(a,b){return a-b;});var g=[],cur=[];for(var i=0;i<hs.length;i++){if(!cur.length||hs[i]-cur[cur.length-1]<=pas)cur.push(hs[i]);else{g.push(cur);cur=[hs[i]];}}if(cur.length)g.push(cur);return g;}
function goText(hs,pas){return goGroups(hs,pas).map(function(g){return g.length>1?g[0]+':00–'+g[g.length-1]+':00':g[0]+':00';}).join(', ');}

var HREF=[7,9,11,13,15,17,19,21];  /* heures qui portent un chiffre dans le graphique */
function daySVG(d){
  var pas=pasDe(d);
  var W=660,H=322,xL=88,xR=636,top=14,bot=158,px=(xR-xL)/14;
  var X=function(h){return xL+(h-7)*px;}, Y=function(L){return bot-(L/6)*(bot-top);};
  var s='<svg viewBox="0 0 '+W+' '+H+'">';
  var goH=d.wind.filter(function(w){return isGo(w,d);}).map(function(w){return w[0];});
  goGroups(goH,pas).forEach(function(g){var a=X(g[0])-px*pas/2,b=X(g[g.length-1])+px*pas/2;
    s+='<rect x="'+a.toFixed(1)+'" y="'+top+'" width="'+(b-a).toFixed(1)+'" height="'+(bot-top)+'" fill="rgba(15,110,86,.14)"/><text x="'+((a+b)/2).toFixed(1)+'" y="'+(top+12)+'" text-anchor="middle" font-size="10" font-weight="700" fill="#0f6e56">GO</text>';});
  for(var m=0;m<=6;m+=2){var y=Y(m);s+='<line x1="'+xL+'" y1="'+y.toFixed(1)+'" x2="'+xR+'" y2="'+y.toFixed(1)+'" stroke="#e7ebf0"/><text x="'+(xL-6)+'" y="'+(y+3).toFixed(1)+'" text-anchor="end" font-size="10" fill="#9aa3ac">'+m+' m</text>';}
  /* C10 : la ligne de reference suit la cote de la saison, portee par data.json
     (champ fill). FILL ne sert plus que de repli pour un ancien data.json. */
  var fillJ = d.fill!=null ? d.fill : FILL;
  var yF=Y(fillJ);
  /* Le libelle de la cote de remplissage etait ancre a droite, exactement la ou
     tombe le trait de pleine mer en fin de journee : les deux textes se
     chevauchaient les jours de maree tardive. Depuis que l'heure de pleine mer
     est donnee a la minute (B5), le cas est frequent. Libelle ancre a gauche. */
  s+='<line x1="'+xL+'" y1="'+yF.toFixed(1)+'" x2="'+xR+'" y2="'+yF.toFixed(1)+'" stroke="#8a4b00" stroke-width="1.2" stroke-dasharray="5 4"/><text x="'+(xL+4)+'" y="'+(yF-4).toFixed(1)+'" font-size="9.5" fill="#8a4b00">'+String(T.svFill||'').replace('{c}',fmtCote(fillJ))+'</text>';
  var tm=d.tideHigh;
  s+='<line x1="'+X(tm).toFixed(1)+'" y1="'+top+'" x2="'+X(tm).toFixed(1)+'" y2="'+bot+'" stroke="#c9851a" stroke-width="1.1" stroke-dasharray="3 3"/><text x="'+(X(tm)+3).toFixed(1)+'" y="'+(top+22)+'" font-size="9.5" fill="#c9851a">'+T.svHigh+'</text>';
  var pts=HS.map(function(h){return X(h).toFixed(1)+','+Y(cote(h,d)).toFixed(1);}).join(' ');
  s+='<polyline points="'+pts+'" fill="none" stroke="#12857f" stroke-width="2.6" stroke-linejoin="round"/>';
  s+='<line x1="'+xL+'" y1="'+bot+'" x2="'+xR+'" y2="'+bot+'" stroke="#cfd6dd"/>';
  [7,9,11,13,15,17,19,21].forEach(function(h){s+='<text x="'+X(h).toFixed(1)+'" y="'+(bot+13)+'" text-anchor="middle" font-size="10" fill="#6b7785">'+h+':00</text>';});
  s+='<text x="'+xL+'" y="'+(top-2)+'" font-size="9.5" fill="#9aa3ac">'+T.svMarsh+'</text>';
  var yw=186;
  s+='<text x="2" y="'+(yw+4)+'" font-size="9" fill="#9aa3ac">'+T.svSky+'</text>';
  var skyByH={}; d.wind.forEach(function(w){ if(w[5]) skyByH[w[0]]=w[5]; });
  [7,9,11,13,15,17,19,21].forEach(function(h){s+='<text x="'+X(h).toFixed(1)+'" y="'+(yw+5)+'" text-anchor="middle" font-size="13">'+wx(skyByH[h]||d.wxc)+'</text>';});
  s+='<text x="2" y="'+(yw+20)+'" font-size="9" fill="#9aa3ac">'+T.svTemp+'</text>';
  var tByH={}; d.wind.forEach(function(w){ if(w[4]!=null) tByH[w[0]]=w[4]; });
  if(Object.keys(tByH).length){ [7,9,11,13,15,17,19,21].forEach(function(h){ if(tByH[h]!=null) s+='<text x="'+X(h).toFixed(1)+'" y="'+(yw+20)+'" text-anchor="middle" font-size="10" font-weight="700" fill="#48535f">'+tByH[h]+'°</text>'; }); }
  else s+='<text x="'+((xL+xR)/2).toFixed(1)+'" y="'+(yw+20)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#48535f">'+d.tmin+'–'+d.tmax+' °C</text>';
  var yc=208,hc=19,yd=252,cr=12,yr=284;
  s+='<text x="2" y="'+(yc+13)+'" font-size="9" fill="#9aa3ac">'+T.svWind+'</text>';
  s+='<text x="2" y="'+(yd+4)+'" font-size="13">🧭</text>';
  s+='<text x="2" y="'+(yr+13)+'" font-size="9" fill="#9aa3ac">'+T.svGust+'</text>';
  /* B9 — UNE BARRE PAR HEURE, un chiffre toutes les deux heures.
     Les donnees sont horaires depuis le 23/09/2026. Afficher quinze nombres de
     deux chiffres dans une largeur de telephone les rendrait illisibles : sur un
     ecran de 390 px le graphique est reduit d'un facteur 0,55, un chiffre de
     11 px tombe a 6 px. Les quinze barres sont donc COLOREES, ce qui montre une
     rafale d'une heure d'un coup d'oeil, et seules les huit heures de reference
     portent le chiffre et la boussole. Rien n'est cache : la rafale maximale de
     la journee, celle qui compte, est affichee dans la ligne du tableau, et elle
     est calculee sur les quinze heures. */
  /* B21 — LES BARRES SE TOUCHENT, la ligne est une bande continue.
     Avec un blanc de 10 % entre elles, les quinze barres se lisaient comme
     quinze CASES, dont sept colorees mais vides puisque seules les huit heures
     de reference portent un chiffre. Signale par Antoine le 23/09/2026 comme un
     bug d'affichage, et c'en etait un au sens ou il voulait dire : ce que l'oeil
     comprend est faux. Barres jointives et coins droits : la ligne devient un
     degrade continu sur lequel les huit chiffres sont poses. L'information
     horaire de D-2 est conservee, la lecture en cases disparait. */
  var lg=px*pas;
  d.wind.filter(function(w){return w[0]>=7&&w[0]<=21;}).forEach(function(w){var k=w[1],g=w[2],cx=X(w[0]),ad=((w[3]||0)+180)%360,f=favOf(w[3]||0);var col=favColor(f);
    var chiffre=HREF.indexOf(w[0])>=0;
    s+='<rect x="'+(cx-lg/2).toFixed(1)+'" y="'+yc+'" width="'+lg.toFixed(1)+'" height="'+hc+'" fill="'+wc(k)+'"/>';
    if(chiffre) s+='<text x="'+cx.toFixed(1)+'" y="'+(yc+13.5)+'" text-anchor="middle" font-size="11" font-weight="800" fill="'+wtc(k)+'">'+k+'</text>';
    if(chiffre){
      s+=chartCompass(cx,yd,cr,ad,col);
      s+='<text x="'+cx.toFixed(1)+'" y="'+(yd+cr+10)+'" text-anchor="middle" font-size="9" font-weight="600" fill="#5c716d">'+sectOf(w[3]||0)+'</text>';
    }
    s+='<rect x="'+(cx-lg/2).toFixed(1)+'" y="'+yr+'" width="'+lg.toFixed(1)+'" height="'+hc+'" fill="'+wc(g)+'"/>';
    if(chiffre) s+='<text x="'+cx.toFixed(1)+'" y="'+(yr+13.5)+'" text-anchor="middle" font-size="11" font-weight="800" fill="'+wtc(g)+'">'+g+'</text>';});
  if(d.partial)s+='<text x="'+((xL+xR)/2).toFixed(1)+'" y="'+(yr+hc+13)+'" text-anchor="middle" font-size="10" fill="#b23b3b">'+T.svPartial+'</text>';
  s+='</svg>';return s;
}
var tb=document.getElementById('tb');
// Sans donnees, le bandeau ne doit pas afficher une date de mise a jour.
function vide(){ var u=document.getElementById('upd'); if(u) u.textContent=''; }
function message(txt,err){ tb.innerHTML='<tr><td colspan="6" class="msgtab'+(err?' msgerr':'')+'">'+txt+'</td></tr>'; }
function render(){
  if(!days.length) return;
  tb.innerHTML='';
  days.forEach(function(d,i){
  var goSlots=d.wind.filter(function(w){return isGo(w,d);});
  var goH=goSlots.map(function(w){return w[0];});
  var anyWater=HS.some(function(h){return present(h,d);});
  /* B8 — LA NOTE ET LE VENT AFFICHE PORTENT DESORMAIS SUR LES MEMES HEURES.
     Avant : la note etait calculee sur les heures AVEC EAU, et le chiffre affiche
     sur les creneaux GO, sinon l'apres-midi. Deux jeux d'heures differents, donc
     deux nombres qui pouvaient se contredire a l'ecran : une journee notee sur un
     pic de 17 noeuds affichait 13 noeuds parce que l'heure du pic etait exclue du
     GO par le plafond rafales. Un seul jeu de reference maintenant : les heures
     ou il y a de l'eau, ou l'apres-midi s'il n'y a pas d'eau du tout, et la note
     comme le vent affiche en decoulent. Le chiffre affiche est donc toujours
     celui qui a fait la note. */
  var aft=d.wind.filter(function(w){return w[0]>=13&&w[0]<=21;});
  var sail=d.wind.filter(function(w){return w[0]>=7&&w[0]<=21&&present(w[0],d);});
  var refSet=sail.length?sail:(aft.length?aft:d.wind);
  var peakK=Math.max.apply(null,refSet.map(function(w){return w[1];})), peakG=Math.max.apply(null,refSet.map(function(w){return w[2];}));
  var peakW=anyWater?peakK:0;
  var note; if(!anyWater||peakW<10)note=0; else if(peakW<11)note=1; else if(peakW<13)note=2; else if(peakW<14)note=3; else if(peakW<15)note=4; else note=5;
  /* A5 : plafond haut. Sans cela la note ne redescendait jamais et 40 kn valait 5 etoiles. */
  if(note>0 && peakW>=NOTE_TOOMUCH) note=1; else if(note>2 && peakW>=NOTE_STRONG) note=2;
  var dom=sectOf(avgDir(d.wind.map(function(w){return w[3];}))), domF=favCls(favOf(avgDir(d.wind.map(function(w){return w[3];}))));
  var eauTxt=d.water==='plein'?T.eauAllday:d.water==='renvoiSoir'?T.eauUntil:d.water==='priseSoir'?T.eauFrom:(anyWater?T.eauTide:T.eauNone);
  var goTxt=goH.length?goText(goH,pasDe(d)):'—';
  var tr=document.createElement('tr');tr.className='day'+(d.today?' today':'');
  tr.innerHTML='<td class="jour">'+trDay(d.d)+(d.today?'<small>'+T.today+'</small>':i===1?'<small>'+T.tomorrow+'</small>':'')+'<span class="wx">'+wx((d.wind.find(function(w){return w[0]===13;})||[])[5]||d.wxc)+' '+d.tmin+'–'+d.tmax+' °C</span><span class="chev">'+T.details+'</span></td>'
   +'<td class="stars">'+stars(note)+'</td>'
   +'<td><span class="eau '+(anyWater?'eau-y':'eau-n')+'">'+eauTxt+'</span></td>'
   +'<td><span class="windcell" style="background:'+wc(peakK)+';color:'+wtc(peakK)+'">'+peakK+' kn</span><span class="gust">'+T.gust+' '+peakG+' kn</span></td>'
   +'<td><span class="dircell">'+compassHTML((sectDeg(dom)+180)%360,favColor(favOf(avgDir(d.wind.map(function(w){return w[3];})))))+'<span class="sect">'+dom+'</span></span></td>'
   +'<td class="go '+(goH.length?'go-y':'go-n')+'">'+goTxt+'</td>';
  var det=document.createElement('tr');det.className='det';det.style.display='none';
  det.innerHTML='<td colspan="6"><div class="detin"><div class="ampm">'
   +'<div class="seg"><b>'+T.morning+'</b><div class="li">'+T.lock+' : '+eclHTML(d.eclM)+'</div><div class="li">'+T.coef+' : '+d.coM+'</div><div class="li">'+T.hightide+' : '+d.pmM+'</div></div>'
   +'<div class="seg"><b>'+T.afternoon+'</b><div class="li">'+T.lock+' : '+eclHTML(d.eclS)+'</div><div class="li">'+T.coef+' : '+d.coS+'</div><div class="li">'+T.hightide+' : '+d.pmS+'</div></div>'
   +'</div>'+daySVG(d)+'<div style="font-size:10.5px;color:#9aa3ac;margin-top:4px">'+T.footNote+'</div></div></td>';
  tr.addEventListener('click',function(){var o=det.style.display!=='none';det.style.display=o?'none':'';tr.classList.toggle('open',!o);tr.querySelector('.chev').textContent=o?T.details:T.hide;});
  tb.appendChild(tr);tb.appendChild(det);
  });
}
function fmtUpd(iso){try{return new Date(iso).toLocaleString(T.updLocale||'fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'});}catch(e){return '';}}
/* Carte Google Maps chargee au clic seulement : aucune requete vers Google
   tant que le visiteur n'a rien demande. */
(function(){
  var bt=document.getElementById('carteBt'), box=document.getElementById('carte');
  if(!bt||!box) return;
  bt.addEventListener('click', function(){
    var f=document.createElement('iframe');
    f.title=box.getAttribute('data-titre')||''; f.src=box.getAttribute('data-src');
    f.setAttribute('style','width:100%;height:360px;border:0;display:block');
    f.setAttribute('referrerpolicy','no-referrer-when-downgrade');
    f.setAttribute('allowfullscreen','');
    box.className='carte on'; box.innerHTML=''; box.appendChild(f);
  });
})();

message(T.dataLoading||'');
fetch('/data.json?v='+Date.now()).then(function(r){return r.ok?r.json():Promise.reject();}).then(function(j){
  if(j&&j.days&&j.days.length){ days=j.days; render(); }
  else { message(T.dataErr||'',1); vide(); }
  var u=document.getElementById('upd');
  if(u&&j&&j.generatedAt&&days.length){ u.textContent=T.updBefore+' '+fmtUpd(j.generatedAt)+' '+T.updAfter; }
}).catch(function(){ message(T.dataErr||'',1); vide(); });
})();
