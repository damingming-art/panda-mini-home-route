import {stops, days, anchors, TOTAL_KM} from './data.js';
import {recommend, projectOnRoute, distanceTo} from './plan.js';

const $=id=>document.getElementById(id);
const fmt=n=>Math.round(n).toLocaleString('zh-CN');
const current=$('currentStop'), range=$('range'), reserve=$('reserve');
let progressKm=0, gpsMode=false;

function amapLink(stop) {
  if (stop.name.includes('库尔楚下高速')) {
    const to=encodeURIComponent('85.400955,41.920870,e疆充·上库石化物流园充电站');
    return `https://uri.amap.com/navigation?to=${to}&mode=car&policy=0&src=panda-mini-route&callnative=1`;
  }
  const keyword=encodeURIComponent(stop.name);
  return `https://uri.amap.com/search?keyword=${keyword}&callnative=1&src=panda-mini-route`;
}
function navLabel(stop) { return stop.name.includes('库尔楚下高速')?'去高德查看路线':'在高德选站导航'; }
function statusNote(stop) {
  if (stop.name.includes('库尔楚')) return '下高速候选 · 入口和直流枪未确认';
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
    html=`<div class="${uncertain?'result-alert':'result-good'}"><span class="result-kicker">${uncertain?'先确认站点，再继续':'建议下一处补电'}</span><h3>${p.chosen.name}</h3><div class="result-metrics"><div><strong>约 ${fmt(p.distance)}</strong><small>公里 · 截图里程估算</small></div><div><strong>约 ${Math.max(0,arrival)}</strong><small>公里 · 预计到站表显</small></div></div><p>${statusNote(p.chosen)}。按本页保守算法，到站余量仅供决策参考；高德实时路线距离优先。</p><a class="action" href="${amapLink(p.chosen)}" target="_blank" rel="noopener">${navLabel(p.chosen)} ↗</a>${uncertain?'<p class="warning">这处站点的可用性未确认，不能仅凭页面预测驶入下一长距离路段。</p>':''}</div>`;
  }
  $('recommendation').innerHTML=html;
  const upcoming=stops.filter(s=>s.km>progressKm+0.5).slice(0,4);
  $('nextStops').innerHTML=`<h3>接下来经过</h3>${upcoming.map(s=>`<div class="next-item"><div><b>${s.name}</b><small>${statusNote(s)}</small></div><strong>${fmt(distanceTo(s,progressKm))} km</strong></div>`).join('')}`;
  try { localStorage.setItem('panda-route',JSON.stringify({current:current.value,range:range.value,reserve:reserve.value,progressKm,gpsMode})); } catch {}
}

current.innerHTML=stops.slice(0,-1).map(s=>`<option value="${s.id}">${s.name} · 累计 ${fmt(s.km)} km</option>`).join('');
try { const saved=JSON.parse(localStorage.getItem('panda-route')); if(saved){ current.value=saved.current||'0';range.value=saved.range||'150';reserve.value=saved.reserve||'25';progressKm=stops[Number(current.value)]?.km||0; }} catch {}
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

let prev=0;
$('days').innerHTML=days.map(d=>{const trip=d.km-prev;prev=d.km;return `<div class="day"><div class="day-num">D${d.day}</div><div><b>${d.end}</b><small>当天约 ${fmt(trip)} km · 全程累计 ${fmt(d.km)} km</small>${d.flag?`<em>${d.flag}</em>`:''}</div></div>`}).join('');
let last=0;
$('allStops').innerHTML=stops.slice(1).map(s=>{const gap=distanceTo(s,last);last=s.km;return `<div class="station ${s.status==='critical'?'station-critical':''}"><div class="station-main"><span class="station-index">${String(s.id).padStart(2,'0')}</span><div><b>${s.name}</b><small>距上站 ${gap.toFixed(1)} km · 原路线累计 ${s.km.toFixed(1)} km</small></div></div><div class="station-actions">${s.id<stops.length-1?`<button data-set="${s.id}">已到这里</button>`:''}<a href="${amapLink(s)}" target="_blank" rel="noopener">高德 ↗</a></div></div>`}).join('');
$('allStops').addEventListener('click',e=>{const btn=e.target.closest('[data-set]');if(!btn)return;const id=Number(btn.dataset.set);if(id>=stops.length-1)return;current.value=id;progressKm=stops[id].km;gpsMode=false;$('locationText').textContent=`手动选择：${stops[id].name}`;render();window.scrollTo({top:document.getElementById('assist').offsetTop-70,behavior:'smooth'});});
render();
