/* Chnoue Wing — onglet « Mes alertes conditions par mail ».
   Lit window.T (traductions) et window.LANG, comme app.js.

   RÈGLE À NE PAS CASSER, no 1 : la fonction evalue() ci-dessous doit rester
   identique à celle du robot Apps Script. C'est elle qui produit l'Aperçu que
   le visiteur voit AVANT de s'inscrire. Si les deux divergent, l'abonné reçoit
   autre chose que ce qu'il a réglé, et personne ne s'en aperçoit.

   RÈGLE À NE PAS CASSER, no 2 : le POST part en Content-Type text/plain.
   Apps Script ne sait pas répondre à une requête préliminaire CORS, et un
   fetch en application/json en déclenche une. Vérifié le 20/09/2026 depuis une
   page servie par un vrai serveur. Ne pas changer sans refaire ce test.

   Aucun niveau d'eau n'est recalculé ici : data.json porte déjà le verdict
   par créneau (champ eau), écrit par scraper.mjs. */
(function(){
"use strict";
var T = window.T || {}, LANG = window.LANG || 'fr';
var EXEC = 'https://script.google.com/macros/s/AKfycbw5tcCEM_m7tDK6WXO8Cn0C7VZBt1ncDXbSf3wNAneQYmSkyElHn0bHSDs94okHjlhD/exec';
var $ = function(id){ return document.getElementById(id); };
if(!$('alPage')) return;

var E = {
  nom: T.alNameDef || 'Alerte',
  mode: 'nav',
  vMin: 12, vMax: 28, rMin: 12, rMax: 34,
  dirA: 225, dirB: 45, tout: false,
  flou: false,
  cre: { m:true, a:true, s:true },
  jours: { lun:true, mar:true, mer:true, jeu:true, ven:true, sam:true, dim:true },
  ryt: 'veille', xJours: 3
};
var DAYS = [];

/* ---------- géométrie et secteurs ---------- */
var N16 = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
var N16EN = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
var SECT = (LANG==='en'||LANG==='de'||LANG==='nl'||LANG==='zh'||LANG==='br') ? N16EN : N16;
function cw(a,b){ return ((b-a)%360+360)%360; }
function nomSect(b){ return SECT[Math.round((((b%360)+360)%360)/22.5)%16]; }
function pt(b,r){ var a=(b-90)*Math.PI/180; return { x:160+r*Math.cos(a), y:160+r*Math.sin(a) }; }
function dansPlage(b){ return E.tout || cw(E.dirA,b) <= cw(E.dirA,E.dirB)+0.001; }
function creneau(h){ return h<=12 ? 'm' : (h<=17 ? 'a' : 's'); }
function dirMoy(ds){ var x=0,y=0; ds.forEach(function(d){ x+=Math.cos(d*Math.PI/180); y+=Math.sin(d*Math.PI/180); });
  return (Math.atan2(y,x)*180/Math.PI+360)%360; }
function liste(t){ return t.length<2 ? (t[0]||'') : t.slice(0,-1).join(', ')+' '+(T.alAnd||'·')+' '+t[t.length-1]; }
function fmt(s,o){ return String(s).replace(/\{(\w+)\}/g, function(_,k){ return o[k]!=null ? o[k] : ''; }); }
var JS_COURT = ['dim','lun','mar','mer','jeu','ven','sam'];
// Deux jeux de libellés : celui des pastilles, et celui qui entre dans une
// phrase. « L'après-midi et Le soir » au milieu d'une ligne était fautif.
var LIB_PIL = function(){ return { m:T.alMorning, a:T.alAfternoon, s:T.alEvening }; };
var LIB_CRE = function(){ return { m:T.alInMorning, a:T.alInAfternoon, s:T.alInEvening }; };

/* ---------- LE CŒUR : identique au robot Apps Script ----------
   tout=true  : l'Aperçu montre toutes les journées qui correspondent aux
   critères, sans filtrer sur le délai de prévenance. Le visiteur veut voir ce
   que ses réglages attrapent ; le délai ne décide que de la date d'envoi. */
function evalue(days, c, ignorerRythme){
  var out = [];
  var auj = new Date(); auj.setHours(12,0,0,0);
  for(var i=0;i<days.length;i++){
    var d = days[i];
    if(!d.iso || !d.eau) continue;
    var dt = new Date(d.iso+'T12:00:00');
    var ecart = Math.round((dt-auj)/86400000);
    if(ecart < 0) continue;
    if(!ignorerRythme){
      if(c.ryt==='veille' && ecart!==1) continue;
      if(c.ryt==='avance' && ecart!==c.xJours) continue;
    }
    if(!c.jours[JS_COURT[dt.getDay()]]) continue;

    if(c.mode==='sec'){
      var creSecs = ['m','a','s'].filter(function(k){
        if(!c.cre[k]) return false;
        return d.eau[k]==='vide' || (c.flou && d.eau[k]==='incertain');
      });
      if(!creSecs.length) continue;
      var douteux = creSecs.some(function(k){ return d.eau[k]==='incertain'; });
      out.push({ iso:d.iso, jour:d.d, creneaux:creSecs, flou:douteux, sec:true });
      continue;
    }

    var bons = [], creOK = {};
    for(var j=0;j<d.wind.length;j++){
      var w = d.wind[j], h = w[0], k2 = creneau(h);
      if(!c.cre[k2]) continue;
      var etat = d.eau[k2];
      if(etat==='vide') continue;
      if(etat==='incertain' && !c.flou) continue;
      if(w[1] < c.vMin || w[1] > c.vMax) continue;
      if(w[2] < c.rMin || w[2] > c.rMax) continue;
      if(!(c.tout || cw(c.dirA,w[3]) <= cw(c.dirA,c.dirB)+0.001)) continue;
      bons.push(w); creOK[k2] = etat;
    }
    if(!bons.length) continue;
    var vits = bons.map(function(w){ return w[1]; });
    var incertain = Object.keys(creOK).some(function(k){ return creOK[k]==='incertain'; });
    out.push({
      iso:d.iso, jour:d.d, creneaux:Object.keys(creOK), sec:false, flou:incertain,
      vMin:Math.min.apply(null,vits), vMax:Math.max.apply(null,vits),
      dir:dirMoy(bons.map(function(w){ return w[3]; }))
    });
  }
  return out;
}

/* ---------- rose des vents ---------- */
function fleche(b){
  var p = function(r,off){
    var a=(b-90)*Math.PI/180, x=160+r*Math.cos(a), y=160+r*Math.sin(a);
    return (x+Math.cos(a+Math.PI/2)*off).toFixed(1)+','+(y+Math.sin(a+Math.PI/2)*off).toFixed(1);
  };
  return [p(126,0),p(140,7.5),p(140,3),p(156,3),p(156,-3),p(140,-3),p(140,-7.5)].join(' ');
}
function arc(){
  if(E.tout) return 'M 160 56 A 104 104 0 1 1 159.9 56 Z';
  var span = cw(E.dirA,E.dirB);
  if(span<0.5) span=0.5; if(span>359.5) span=359.5;
  var p1=pt(E.dirA,104), p2=pt(E.dirA+span,104);
  return 'M '+p1.x.toFixed(2)+' '+p1.y.toFixed(2)+' A 104 104 0 '+(span>180?1:0)+' 1 '+p2.x.toFixed(2)+' '+p2.y.toFixed(2);
}
function css(n,def){ var v=getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v||def; }
function dessineRose(){
  var go=css('--water','#12857f'), line=css('--line','#e2e9e7'), card=css('--card','#fff'),
      ink=css('--ink','#12302e'), muted=css('--muted','#5c716d'), pale='#d5e0dd';
  var s = '<circle cx="160" cy="160" r="104" fill="none" stroke="'+line+'" stroke-width="24"/>';
  s += '<path d="'+arc()+'" fill="none" stroke="'+go+'" stroke-width="24"/>';
  for(var i=0;i<16;i++){ var b=i*22.5; s+='<polygon points="'+fleche(b)+'" fill="'+(dansPlage(b)?go:pale)+'"/>'; }
  s += '<circle cx="160" cy="160" r="74" fill="'+card+'" stroke="'+line+'"/>';
  var card4 = SECT === N16EN ? ['N','E','S','W'] : ['N','E','S','O'];
  s += '<text x="160" y="103" text-anchor="middle" font-size="15" font-weight="700" fill="'+ink+'">'+card4[0]+'</text>';
  s += '<text x="217" y="166" text-anchor="middle" font-size="15" font-weight="700" fill="'+ink+'">'+card4[1]+'</text>';
  s += '<text x="160" y="228" text-anchor="middle" font-size="15" font-weight="700" fill="'+ink+'">'+card4[2]+'</text>';
  s += '<text x="103" y="166" text-anchor="middle" font-size="15" font-weight="700" fill="'+ink+'">'+card4[3]+'</text>';
  s += '<text x="160" y="152" text-anchor="middle" font-size="12" fill="'+muted+'">'+esc(T.alDirZone||'')+'</text>';
  s += '<text x="160" y="176" text-anchor="middle" font-size="17" font-weight="700" fill="'+go+'">'
     + (E.tout ? '100 %' : nomSect(E.dirA)+' → '+nomSect(E.dirB)) + '</text>';
  if(!E.tout){
    var A=pt(E.dirA,104), B=pt(E.dirB,104);
    s += '<circle class="gA" cx="'+A.x.toFixed(1)+'" cy="'+A.y.toFixed(1)+'" r="15" fill="'+card+'" stroke="'+go+'" stroke-width="4" style="cursor:grab"/>';
    s += '<circle class="gB" cx="'+B.x.toFixed(1)+'" cy="'+B.y.toFixed(1)+'" r="15" fill="'+card+'" stroke="'+go+'" stroke-width="4" style="cursor:grab"/>';
  }
  var rose = $('rose');
  rose.innerHTML = s;
  var pose = function(e,quoi){
    var r = rose.getBoundingClientRect();
    var x = (e.clientX-r.left)/r.width*320-160, y = (e.clientY-r.top)/r.height*320-160;
    var a = Math.atan2(y,x)*180/Math.PI+90;
    var v = Math.round((((a%360)+360)%360)/22.5)*22.5%360;
    var na = quoi==='a' ? v : E.dirA, nb = quoi==='b' ? v : E.dirB;
    if(cw(na,nb) < 22.4) return;     // la plage ne peut pas se refermer sur elle-même
    E.dirA=na; E.dirB=nb; E.tout=false; rend();
  };
  [['gA','a'],['gB','b']].forEach(function(p){
    var el = rose.querySelector('.'+p[0]); if(!el) return;
    el.addEventListener('pointerdown', function(e){
      e.preventDefault();
      var move = function(ev){ pose(ev,p[1]); };
      var up = function(){ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); };
      window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
    });
  });
}

/* ---------- barre à deux poignées ---------- */
function barre(railId, pleinId, minId, maxId, cleMin, cleMax, lo, hi){
  var rail=$(railId), plein=$(pleinId), bMin=$(minId), bMax=$(maxId), etendue=hi-lo;
  function place(){
    var pMin=(E[cleMin]-lo)/etendue*100, pMax=(E[cleMax]-lo)/etendue*100;
    plein.style.left=pMin+'%'; plein.style.width=(pMax-pMin)+'%';
    bMin.style.left=pMin+'%'; bMax.style.left=pMax+'%';
  }
  function pose(e,cle){
    var r=rail.getBoundingClientRect();
    var v=Math.round(lo+(e.clientX-r.left)/r.width*etendue);
    if(v<lo)v=lo; if(v>hi)v=hi;
    if(cle===cleMin) E[cleMin]=Math.min(v,E[cleMax]); else E[cleMax]=Math.max(v,E[cleMin]);
    rend();
  }
  [[bMin,cleMin],[bMax,cleMax]].forEach(function(p){
    p[0].addEventListener('pointerdown', function(e){
      e.preventDefault(); p[0].focus();
      var move=function(ev){ pose(ev,p[1]); };
      var up=function(){ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); };
      window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
    });
    p[0].addEventListener('keydown', function(e){
      var pas = e.key==='ArrowLeft'||e.key==='ArrowDown' ? -1 : (e.key==='ArrowRight'||e.key==='ArrowUp' ? 1 : 0);
      if(!pas) return;
      e.preventDefault();
      if(p[1]===cleMin) E[cleMin]=Math.max(lo, Math.min(E[cleMin]+pas, E[cleMax]));
      else E[cleMax]=Math.min(hi, Math.max(E[cleMax]+pas, E[cleMin]));
      rend();
    });
  });
  return place;
}

/* Les boutons ne sont construits qu'une fois, puis seulement remis à jour :
   les recréer à chaque rendu faisait perdre le focus clavier au premier clic. */
function pastilles(hote, items, estActif, bascule){
  if(hote.dataset.pret !== '1'){
    hote.innerHTML='';
    items.forEach(function(it){
      var b=document.createElement('button');
      b.type='button'; b.className='pil'; b.dataset.cle=it[0];
      b.addEventListener('click', function(){ bascule(it[0]); rend(); });
      hote.appendChild(b);
    });
    hote.dataset.pret='1';
  }
  items.forEach(function(it,i){
    var b=hote.children[i]; if(!b) return;
    b.textContent=it[1];
    var on=estActif(it[0]);
    b.setAttribute('aria-pressed', on?'true':'false');
    b.className='pil'+(on?' on':'');
  });
}

function esc(s){ return String(s==null?'':s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

var placeV, placeR;

/* ---------- rendu ---------- */
function rend(){
  var sec = E.mode==='sec';

  $('mNav').setAttribute('aria-pressed', sec?'false':'true');
  $('mNav').className = 'pil mode'+(sec?'':' on');
  $('mSec').setAttribute('aria-pressed', sec?'true':'false');
  $('mSec').className = 'pil mode'+(sec?' on on-sec':'');
  $('noteSec').hidden = !sec;
  $('bVent').className = 'bloc'+(sec?' off':'');
  $('bRose').className = 'bloc'+(sec?' off':'');
  $('offV').hidden = !sec;
  $('offR').hidden = !sec;

  placeV(); placeR();
  $('vTxt').textContent = E.vMin+' – '+E.vMax;
  $('rTxt').textContent = E.rMin+' – '+E.rMax;
  $('recap').textContent = fmt(T.alWindRecap, {a:E.vMin,b:E.vMax,c:E.rMin,d:E.rMax});

  $('btTout').setAttribute('aria-pressed', E.tout?'true':'false');
  $('btTout').className = 'pil grand'+(E.tout?' on':'');
  $('nomA').textContent = E.tout ? '—' : nomSect(E.dirA);
  $('nomB').textContent = E.tout ? '—' : nomSect(E.dirB);
  var part = E.tout ? 100 : Math.round(cw(E.dirA,E.dirB)/360*100);
  $('aideRose').textContent = fmt(T.alDirNote, {
    a: E.tout ? (T.alDirAll||'') : nomSect(E.dirA)+' → '+nomSect(E.dirB),
    b: part+' %'
  });
  dessineRose();

  $('btFlou').setAttribute('aria-pressed', E.flou?'true':'false');
  $('btFlou').className = 'pil'+(E.flou?' on':'');

  var L = LIB_PIL();
  pastilles($('pCre'), [['m',L.m],['a',L.a],['s',L.s]],
    function(k){ return E.cre[k]; }, function(k){ E.cre[k] = !E.cre[k]; });
  pastilles($('pJours'), [['lun',T.alMon],['mar',T.alTue],['mer',T.alWed],['jeu',T.alThu],
      ['ven',T.alFri],['sam',T.alSat],['dim',T.alSun]],
    function(k){ return E.jours[k]; }, function(k){ E.jours[k] = !E.jours[k]; });
  pastilles($('pRyt'), [['direct',T.alNotifNow],['veille',T.alNotifEve],['avance',T.alNotifX]],
    function(k){ return E.ryt===k; }, function(k){ E.ryt = k; });
  $('zoneX').hidden = E.ryt!=='avance';
  $('xTxt').textContent = E.xJours+' '+T.alNotifDays;
  $('noteRyt').textContent = E.ryt==='direct' ? T.alNotifNoteNow
    : E.ryt==='veille' ? T.alNotifNoteEve
    : fmt(T.alNotifNoteX, {n:E.xJours});

  peindreApercu();
}

function peindreApercu(){
  var sec = E.mode==='sec';
  var res = evalue(DAYS, E, true);
  $('apercu').className = 'apercu'+(sec?' sec':'');
  $('apTitre').textContent = '« '+E.nom+' » · '+(sec?T.alPrevSec:T.alPrevNav);
  $('nbJ').textContent = res.length;
  $('motJ').textContent = (res.length>1 ? T.alDayMany : T.alDayOne)+' '+T.alOn9;
  var L = LIB_CRE();
  if(!DAYS.length){ $('liste').innerHTML = '<p class="vide">'+esc(T.alLoading||'')+'</p>'; return; }
  if(!res.length){ $('liste').innerHTML = '<p class="vide">'+esc(T.alNone)+'</p>'; return; }
  $('liste').innerHTML = res.map(function(r){
    var creneaux = liste(r.creneaux.map(function(k){ return L[k]; }));
    var detail = r.sec ? creneaux
      : creneaux+' · '+(r.vMin===r.vMax ? r.vMin : r.vMin+'–'+r.vMax)+' kn '+nomSect(r.dir);
    var bdg = r.sec ? (r.flou ? T.alBadgeFlou : T.alBadgeDry)
                    : (r.flou ? T.alBadgeFlou : T.alBadgeOk);
    return '<div class="jour"><div class="d"><span>'+esc(r.jour)+'</span>'
      + '<span class="bdg'+(r.flou?' flou':'')+'">'+esc(bdg)+'</span></div>'
      + '<div class="s">'+esc(detail)+'</div></div>';
  }).join('');
}

/* ---------- branchements ---------- */
placeV = barre('railV','plV','vMinP','vMaxP','vMin','vMax',5,40);
placeR = barre('railR','plR','rMinP','rMaxP','rMin','rMax',5,50);

$('alNom').addEventListener('input', function(){ E.nom = this.value; peindreApercu(); });
$('mNav').addEventListener('click', function(){ E.mode='nav'; rend(); });
$('mSec').addEventListener('click', function(){ E.mode='sec'; rend(); });
$('btTout').addEventListener('click', function(){ E.tout = !E.tout; rend(); });
$('btFlou').addEventListener('click', function(){ E.flou = !E.flou; rend(); });
[['aM','dirA',-22.5],['aP','dirA',22.5],['bM','dirB',-22.5],['bP','dirB',22.5]].forEach(function(p){
  $(p[0]).addEventListener('click', function(){
    var v = ((E[p[1]]+p[2])%360+360)%360;
    var na = p[1]==='dirA' ? v : E.dirA, nb = p[1]==='dirB' ? v : E.dirB;
    if(cw(na,nb) < 22.4) return;
    E[p[1]] = v; E.tout = false; rend();
  });
});
$('xM').addEventListener('click', function(){ if(E.xJours>1){ E.xJours--; rend(); } });
$('xP').addEventListener('click', function(){ if(E.xJours<8){ E.xJours++; rend(); } });

/* ---------- envoi ---------- */
$('creer').addEventListener('click', function(){
  var b = $('creer');
  var m = $('alMail').value.trim(), ok = $('alOk').checked, news = $('alNews').checked;
  if(!E.nom.trim()){ alert(T.alErrName); return; }
  if(!m || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(m)){ alert(T.alErrMail); return; }
  if(!ok){ alert(T.alErrConsent); return; }
  var unCre = E.cre.m || E.cre.a || E.cre.s;
  var unJour = false; for(var k in E.jours) if(E.jours[k]) unJour = true;
  if(!unCre || !unJour){ alert(T.alErrSlot); return; }

  b.disabled = true; b.textContent = T.alSending;
  var charge = {
    email: m, ok: true, news: news,
    nom: E.nom.trim().slice(0,48),
    langue: LANG,
    preuve: (T.alConsent||'').slice(0,300)+' | '+new Date().toISOString(),
    criteres: {
      mode:E.mode, vMin:E.vMin, vMax:E.vMax, rMin:E.rMin, rMax:E.rMax,
      dirA:Math.round(E.dirA), dirB:Math.round(E.dirB), tout:E.tout, flou:E.flou,
      cre:{ m:!!E.cre.m, a:!!E.cre.a, s:!!E.cre.s },
      jours:{ lun:!!E.jours.lun, mar:!!E.jours.mar, mer:!!E.jours.mer, jeu:!!E.jours.jeu,
              ven:!!E.jours.ven, sam:!!E.jours.sam, dim:!!E.jours.dim },
      ryt:E.ryt, xJours:E.xJours
    }
  };
  // text/plain : type « simple », donc aucune requête préliminaire OPTIONS.
  fetch(EXEC, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify(charge), redirect:'follow' })
  .then(function(r){ return r.json(); })
  .then(function(j){
    b.disabled = false; b.textContent = T.alSend;
    if(j && j.ok){ $('alForm').style.display='none'; var k=$('alDone');
      k.style.display='block'; k.scrollIntoView({behavior:'smooth',block:'center'}); return; }
    alert(j && j.err==='doublon' ? T.alErrDup : T.alErrNet);
  })
  .catch(function(){ b.disabled=false; b.textContent=T.alSend; alert(T.alErrNet); });
});

/* ---------- données ---------- */
rend();
fetch('/data.json?v='+Date.now())
  .then(function(r){ return r.ok ? r.json() : Promise.reject(); })
  .then(function(j){ if(j && j.days && j.days.length){ DAYS = j.days; peindreApercu(); } })
  .catch(function(){ $('liste').innerHTML = '<p class="vide">'+esc(T.alErrNet)+'</p>'; });
})();
