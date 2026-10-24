import {stops, days, anchors, TOTAL_KM, chargingDetour} from './data.js?v=9';
import {recommend, projectOnRoute, distanceTo} from './plan.js?v=5';

const $=id=>document.getElementById(id);
const fmt=n=>Math.round(n).toLocaleString('zh-CN');
const current=$('currentStop'), range=$('range'), reserve=$('reserve');
let progressKm=0, gpsMode=false;

function point(p) { return `${p.lon},${p.lat},${p.name}`; }
function routeUrl(from, to, via) {
  const params = new URLSearchParams({from:point(from),to:point(to),mode:'car',callnative:'1',src:'panda-mini-route'});
  if (via) params.set('via',point(via));
  return `https://uri.amap.com/navigation?${params}`;
}
export const detourRouteUrl = routeUrl(chargingDetour.origin,chargingDetour.destination,chargingDetour.charger);
function navigateToUrl(to) {
  const params = new URLSearchParams({from:'',to:point(to),mode:'car',callnative:'1',src:'panda-mini-route'});
  return `https://uri.amap.com/navigation?${params}`;
}
function amapLink(stop) {
  if (stop.name === '铁门关筑磊超充站') return navigateToUrl(chargingDetour.charger);
  if (stop.name === '焉耆服务区') return navigateToUrl(chargingDetour.destination);
  const keyword=encodeURIComponent(stop.name);
  return `https://uri.amap.com/search?keyword=${keyword}&callnative=1&src=panda-mini-route`;
}
function navLabel(stop) { return stop.name === '铁门关筑磊超充站' || stop.name === '焉耆服务区' ? '在高德打开驾车路线' : '在高德选站导航'; }
function statusNote(stop) {
  if (stop.name === '铁门关筑磊超充站') return '高德已核对双丰立交进出路线 · 到站前核查直流枪及开放状态';
  if (stop.name.includes('星星峡')) return '施工开放情况待确认';
  if (stop.name.includes('哈密')) return '新增补点 · 查出疆方向空闲枪';
  if (stop.name.includes('兰州北')) return '新增补点 · 查往兰州方向空闲枪';
  if (stop.name.includes('停车区')) return '停车区 · 先查快充枪';
  return '高德截图列有充电 · 实时状态待查';
}
function render() {
  const x=Number(range.value)||0, r=Number(reserve.value)||0;
  const p=recommend(stops,progressKm,x,r), remaining=Math.max(0,TOTAL_KM-progressKm);
  let html='';
  if (remaining<1) html='<div class="result-good"><span class="result-kicker">到家了</span><h3>已抵达下两镇</h3><p>一路辛苦，先休息。</p></div>';
  else if (!p.chosen) html=`<div class="result-alert"><span class="result-kicker">需要先补电</span><h3>当前余量不足以稳妥到下一站</h3><p>下一站 ${p.next?.name||'目的地'} 约 ${fmt(p.next?distanceTo(p.next,progressKm):TOTAL_KM-progressKm)} 公里。按表显 80% 再留 ${fmt(r)} 公里后，可用约 ${fmt(p.usable)} 公里。先在当前位置附近查可用直流桩，别继续上高速。</p><a class="action" href="https://uri.amap.com/search?keyword=${encodeURIComponent('附近 直流充电站')}&callnative=1" target="_blank" rel="noopener">高德查附近充电 ↗</a></div>`;
  else {
    const uncertain=p.chosen.status==='critical';
    const arrival=Math.round(x-p.distance/0.8);
    html=`<div class="${uncertain?'result-alert':'result-good'}"><span class="result-kicker">${uncertain?'先确认站点，再继续':'建议下一处补电'}</span><h3>${p.chosen.name}</h3><div class="result-metrics"><div><strong>约 ${fmt(p.distance)}</strong><small>公里 · ${p.chosen.status==='route-checked'?'高德驾车里程':'截图里程估算'}</small></div><div><strong>约 ${Math.max(0,arrival)}</strong><small>公里 · 预计到站表显</small></div></div><p>${statusNote(p.chosen)}。按本页保守算法，到站余量仅供决策参考；高德实时路线距离优先。</p><a class="action" href="${amapLink(p.chosen)}" target="_blank" rel="noopener">${navLabel(p.chosen)} ↗</a>${uncertain?'<p class="warning">这处站点的可用性未确认，不能仅凭页面预测驶入下一长距离路段。</p>':''}</div>`;
  }
  $('recommendation').innerHTML=html;
  const upcoming=stops.filter(s=>s.km>progressKm+0.5).slice(0,4);
  $('nextStops').innerHTML=`<h3>接下来经过</h3>${upcoming.map(s=>`<div class="next-item"><div><b>${s.name}</b><small>${statusNote(s)}</small></div><strong>${fmt(distanceTo(s,progressKm))} km</strong></div>`).join('')}`;
  try { localStorage.setItem('panda-route-v2',JSON.stringify({current:current.value,range:range.value,reserve:reserve.value,progressKm,gpsMode})); } catch {}
}

current.innerHTML=stops.slice(0,-1).map(s=>`<option value="${s.id}">${s.name} · 累计 ${fmt(s.km)} km</option>`).join('');
try { const saved=JSON.parse(localStorage.getItem('panda-route-v2')); if(saved){ current.value=saved.current||'0';range.value=saved.range||'150';reserve.value=saved.reserve||'25';progressKm=stops[Number(current.value)]?.km||0; }} catch {}
current.addEventListener('change',()=>{gpsMode=false;progressKm=stops[Number(current.value)].km;$('locationText').textContent=`手动选择：${stops[Number(current.value)].name}`;render();});
[range,reserve].forEach(el=>el.addEventListener('input',render));
document.querySelectorAll('[data-range]').forEach(btn=>btn.addEventListener('click',()=>{range.value=btn.dataset.range;render();}));
$('locateBtn').addEventListener('click',()=>{
  if (!navigator.geolocation) {$('locationText').textContent='当前浏览器不支持定位，请手动选择站点';return;}
  $('locationText').textContent='正在取得当前位置…';
  navigator.geolocation.getCurrentPosition(pos=>{
    const {longitude,latitude,accuracy}=pos.coords;
    const guess=projectOnRoute(longitude,latitude,anchors);
    if (!guess || guess.errorKm>80) {$('locationText').textContent=`定位成功，但距离参考线路约 ${fmt(guess?.errorKm||0)} km；请手动选择最近经过的站`;return;}
    progressKm=guess.km;gpsMode=true;
    const previous=stops.filter(s=>s.km<=progressKm).at(-1)||stops[0];
    current.value=previous.id;
    $('locationText').textContent=`定位在 ${previous.name} 之后，约累计 ${fmt(progressKm)} km（粗估；定位精度 ${fmt(accuracy)} m）`;
    render();
  },err=>{$('locationText').textContent=`未取得定位（${err.code===1?'未授权':'超时或信号不足'}），可手动选择站点`;},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
});

let dayStartKm=0;
$('days').innerHTML=days.map(d=>{
  const startKm=dayStartKm, trip=d.km-startKm;
  const routeStops=stops.filter(s=>s.km>=startKm-0.01 && s.km<=d.km+0.01);
  const start=routeStops[0], end=routeStops.at(-1);
  const legs=routeStops.slice(1).map((s,i)=>({from:routeStops[i],to:s,km:s.km-routeStops[i].km}));
  const maxGap=Math.max(...legs.map(l=>l.km),0);
  const routeLink=d.day===2?detourRouteUrl:amapLink(end);
  const stopRows=legs.map(l=>`<div class="day-leg ${l.km>120?'day-leg-danger':l.km>100?'day-leg-check':''}"><span class="leg-distance">${l.km.toFixed(1)} km</span><div><b>${l.to.name}</b><small>${l.to.name === '铁门关筑磊超充站' ? '双丰立交下高速 · 充电后经库东公路返回 G3012' : l.km>120?'超过 120 km，需核实中途补点':l.km>100?'接近补电阈值，建议到站补电':'到站检查直流快充状态'}</small></div><a href="${amapLink(l.to)}" target="_blank" rel="noopener">高德查站 ↗</a></div>`).join('');
  dayStartKm=d.km;
  return `<article class="day" id="day-${d.day}"><div class="day-heading"><span class="day-num">D${d.day}</span><div><b>${start.name} → ${d.end}</b><small>当天约 ${fmt(trip)} km · ${legs.length} 段 · 最长站间 ${maxGap.toFixed(1)} km</small></div></div>${d.flag?`<p class="day-alert">${d.flag}</p>`:''}<div class="day-map" role="img" aria-label="第 ${d.day} 天按里程排列的服务区线路示意图"><span class="map-start">起点 · ${start.name}</span><div class="map-line">${routeStops.map((s,i)=>`<span class="map-dot" style="left:${trip?((s.km-startKm)/trip*100).toFixed(2):0}%" title="${s.name} · 累计 ${s.km.toFixed(1)} km"></span>`).join('')}</div><span class="map-end">终点 · ${end.name}</span></div><details class="day-details"><summary>展开当天全部途经站与站间距离</summary><div class="day-legs">${stopRows}</div></details><div class="day-actions"><div class="day-route-row"><a class="day-route-btn" href="${routeLink}" target="_blank" rel="noopener">${d.day===2?'高德一键打开阳霞→筑磊→焉耆 ↗':'高德打开当天终点 ↗'}</a>${d.day===2?`<span class="detour-pill">比直达多走约 ${chargingDetour.extraRouteKm.toFixed(1)} km</span>`:''}</div>${d.day===2?`<div class="route-comparison">不下高速直达 ${chargingDetour.directRouteKm.toFixed(1)} km <span aria-hidden="true">→</span> 下高速补电 ${chargingDetour.viaRouteKm.toFixed(1)} km</div>`:''}<small>${d.day===2?'整段比较采用高德同一起终点规划；分段 95.5＋93.5 km 与整段规划差约 0.3 km。打开高德后确认途经筑磊站及 G3012，再开始导航。':'此入口只搜索当天终点，暂不含途经点；请按上方顺序逐站核对。完整多途经点路线待精确点位核实后开放。'}</small></div></article>`;
}).join('');
let last=0;
$('allStops').innerHTML=stops.slice(1).map(s=>{const gap=distanceTo(s,last);last=s.km;return `<div class="station ${s.status==='critical'?'station-critical':''}"><div class="station-main"><span class="station-index">${String(s.id).padStart(2,'0')}</span><div><b>${s.name}</b><small>距上站 ${gap.toFixed(1)} km · 预计累计 ${s.km.toFixed(1)} km</small></div></div><div class="station-actions">${s.id<stops.length-1?`<button data-set="${s.id}">已到这里</button>`:''}<a href="${amapLink(s)}" target="_blank" rel="noopener">高德 ↗</a></div></div>`}).join('');
$('detourRoute').href=detourRouteUrl;
$('detourCharger').href=amapLink(stops.find(s=>s.name==='铁门关筑磊超充站'));
$('allStops').addEventListener('click',e=>{const btn=e.target.closest('[data-set]');if(!btn)return;const id=Number(btn.dataset.set);if(id>=stops.length-1)return;current.value=id;progressKm=stops[id].km;gpsMode=false;$('locationText').textContent=`手动选择：${stops[id].name}`;render();window.scrollTo({top:document.getElementById('assist').offsetTop-70,behavior:'smooth'});});
render();
