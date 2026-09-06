/* Chnoue Wing — logique du tableau 9 jours, partagée par toutes les langues.
   Lit window.T (traductions de la langue) et window.LANG. */
(function(){
var T=window.T||{}, LANG=window.LANG||'fr';
var HS=[7,8,9,10,11,12,13,14,15,16,17,18,19,20,21], FILL=5.2;
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
var DOW=T.dow||{};
function trDay(s){return String(s).replace(/^(Lun|Mar|Mer|Jeu|Ven|Sam|Dim)/,function(m){return DOW[m]||m;});}

var days=[{d:'Mar 30/06',today:1,wxc:'Peu nuageux',tmin:15,tmax:25,eclM:'PRISE',eclS:'PRISE',coM:'67',coS:'69',pmM:'05:51',pmS:'18:00',water:'plein',tideHigh:18,wind:[[14,13,19,298],[16,16,24,303],[18,17,26,307],[20,17,26,308]],partial:1}];

function present(h,d){if(d.water==='plein')return true;if(d.water==='renvoiSoir')return h<=21;if(d.water==='vav')return Math.abs(h-d.tideHigh)<=2;return false;}
function cote(h,d){if(d.water==='plein')return FILL;if(d.water==='renvoiSoir')return h<=20?FILL:Math.max(2.6,FILL-0.85*(h-20));if(d.water==='vav')return Math.max(0.8,FILL-0.55*Math.abs(h-d.tideHigh));return 1;}
function goGroups(hs){hs=hs.slice().sort(function(a,b){return a-b;});var g=[],cur=[];for(var i=0;i<hs.length;i++){if(!cur.length||hs[i]-cur[cur.length-1]<=2)cur.push(hs[i]);else{g.push(cur);cur=[hs[i]];}}if(cur.length)g.push(cur);return g;}
function goText(hs){return goGroups(hs).map(function(g){return g.length>1?g[0]+':00–'+g[g.length-1]+':00':g[0]+':00';}).join(', ');}

function daySVG(d){
  var W=660,H=296,xL=88,xR=636,top=14,bot=158,px=(xR-xL)/14;
  var X=function(h){return xL+(h-7)*px;}, Y=function(L){return bot-(L/6)*(bot-top);};
  var s='<svg viewBox="0 0 '+W+' '+H+'">';
  var goH=d.wind.filter(function(w){return w[0]>=7&&w[0]<=21&&present(w[0],d)&&w[1]>=10;}).map(function(w){return w[0];});
  goGroups(goH).forEach(function(g){var a=X(g[0])-px,b=X(g[g.length-1])+px;
    s+='<rect x="'+a.toFixed(1)+'" y="'+top+'" width="'+(b-a).toFixed(1)+'" height="'+(bot-top)+'" fill="rgba(31,143,78,.15)"/><text x="'+((a+b)/2).toFixed(1)+'" y="'+(top+12)+'" text-anchor="middle" font-size="10" font-weight="700" fill="#1f8f4e">GO</text>';});
  for(var m=0;m<=6;m+=2){var y=Y(m);s+='<line x1="'+xL+'" y1="'+y.toFixed(1)+'" x2="'+xR+'" y2="'+y.toFixed(1)+'" stroke="#e7ebf0"/><text x="'+(xL-6)+'" y="'+(y+3).toFixed(1)+'" text-anchor="end" font-size="10" fill="#9aa3ac">'+m+' m</text>';}
  var yF=Y(FILL);
  s+='<line x1="'+xL+'" y1="'+yF.toFixed(1)+'" x2="'+xR+'" y2="'+yF.toFixed(1)+'" stroke="#8a4b00" stroke-width="1.2" stroke-dasharray="5 4"/><text x="'+xR+'" y="'+(yF-4).toFixed(1)+'" text-anchor="end" font-size="9.5" fill="#8a4b00">'+T.svFill+'</text>';
  var tm=d.tideHigh;
  s+='<line x1="'+X(tm).toFixed(1)+'" y1="'+top+'" x2="'+X(tm).toFixed(1)+'" y2="'+bot+'" stroke="#c9851a" stroke-width="1.1" stroke-dasharray="3 3"/><text x="'+(X(tm)+3).toFixed(1)+'" y="'+(top+22)+'" font-size="9.5" fill="#c9851a">'+T.svHigh+'</text>';
  var pts=HS.map(function(h){return X(h).toFixed(1)+','+Y(cote(h,d)).toFixed(1);}).join(' ');
  s+='<polyline points="'+pts+'" fill="none" stroke="#2b6cb0" stroke-width="2.6" stroke-linejoin="round"/>';
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
  var yc=218,hc=19,yr=251;
  s+='<text x="2" y="'+(yc+13)+'" font-size="9" fill="#9aa3ac">'+T.svWind+'</text>';
  s+='<text x="2" y="'+(yr+13)+'" font-size="9" fill="#9aa3ac">'+T.svGust+'</text>';
  d.wind.filter(function(w){return w[0]>=7&&w[0]<=21;}).forEach(function(w){var k=w[1],g=w[2],cx=X(w[0]),ad=((w[3]||0)+180)%360,f=favOf(w[3]||0);var col=f==='good'?'#1f8f4e':f==='mid'?'#c9851a':'#b23b3b';
    s+='<rect x="'+(cx-px*0.9).toFixed(1)+'" y="'+yc+'" width="'+(px*1.8).toFixed(1)+'" height="'+hc+'" rx="3" fill="'+wc(k)+'"/>';
    s+='<text x="'+cx.toFixed(1)+'" y="'+(yc+13.5)+'" text-anchor="middle" font-size="11" font-weight="800" fill="'+wtc(k)+'">'+k+'</text>';
    s+='<text x="'+cx.toFixed(1)+'" y="'+(yc+hc+8)+'" text-anchor="middle" font-size="12" fill="'+col+'" transform="rotate('+ad+' '+cx.toFixed(1)+' '+(yc+hc+4)+')">↑</text>';
    s+='<rect x="'+(cx-px*0.9).toFixed(1)+'" y="'+yr+'" width="'+(px*1.8).toFixed(1)+'" height="'+hc+'" rx="3" fill="'+wc(g)+'"/>';
    s+='<text x="'+cx.toFixed(1)+'" y="'+(yr+13.5)+'" text-anchor="middle" font-size="11" font-weight="800" fill="'+wtc(g)+'">'+g+'</text>';});
  if(d.partial)s+='<text x="'+((xL+xR)/2).toFixed(1)+'" y="'+(yr+hc+13)+'" text-anchor="middle" font-size="10" fill="#b23b3b">'+T.svPartial+'</text>';
  s+='</svg>';return s;
}
var tb=document.getElementById('tb');
function render(){
  tb.innerHTML='';
  days.forEach(function(d,i){
  var goSlots=d.wind.filter(function(w){return w[0]>=7&&w[0]<=21&&present(w[0],d)&&w[1]>=10;});
  var goH=goSlots.map(function(w){return w[0];});
  var anyWater=HS.some(function(h){return present(h,d);});
  var waterWind=d.wind.filter(function(w){return w[0]>=7&&w[0]<=21&&present(w[0],d);}).map(function(w){return w[1];});
  var peakW=waterWind.length?Math.max.apply(null,waterWind):0;
  var note; if(!anyWater||peakW<10)note=0; else if(peakW<11)note=1; else if(peakW<13)note=2; else if(peakW<14)note=3; else if(peakW<15)note=4; else note=5;
  var aft=d.wind.filter(function(w){return w[0]>=13&&w[0]<=21;});
  var refSet=goSlots.length?goSlots:(aft.length?aft:d.wind);
  var peakK=Math.max.apply(null,refSet.map(function(w){return w[1];})), peakG=Math.max.apply(null,refSet.map(function(w){return w[2];}));
  var dom=sectOf(avgDir(d.wind.map(function(w){return w[3];}))), domF=favCls(favOf(avgDir(d.wind.map(function(w){return w[3];}))));
  var eauTxt=d.water==='plein'?T.eauAllday:d.water==='renvoiSoir'?T.eauUntil:(anyWater?T.eauTide:T.eauNone);
  var goTxt=goH.length?goText(goH):'—';
  var tr=document.createElement('tr');tr.className='day'+(d.today?' today':'');
  tr.innerHTML='<td class="jour">'+trDay(d.d)+(d.today?'<small>'+T.today+'</small>':i===1?'<small>'+T.tomorrow+'</small>':'')+'<span class="wx">'+wx((d.wind.find(function(w){return w[0]===13;})||[])[5]||d.wxc)+' '+d.tmin+'–'+d.tmax+' °C</span><span class="chev">'+T.details+'</span></td>'
   +'<td class="stars">'+stars(note)+'</td>'
   +'<td><span class="eau '+(anyWater?'eau-y':'eau-n')+'">'+eauTxt+'</span></td>'
   +'<td><span class="windcell" style="background:'+wc(peakK)+';color:'+wtc(peakK)+'">'+peakK+' kn</span><span class="gust">'+T.gust+' '+peakG+' kn</span></td>'
   +'<td><span class="arrow '+domF+'" style="transform:rotate('+((sectDeg(dom)+180)%360)+'deg)">↑</span><span class="sect">'+dom+'</span></td>'
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
render();
fetch('/data.json?v='+Date.now()).then(function(r){return r.ok?r.json():Promise.reject();}).then(function(j){if(j&&j.days&&j.days.length){days=j.days;render();}var u=document.getElementById('upd');if(u&&j&&j.generatedAt){u.textContent=T.updBefore+' '+fmtUpd(j.generatedAt)+' '+T.updAfter;}}).catch(function(){});
})();
