import test from 'node:test';
import assert from 'node:assert/strict';
import {stops, days, chargingDetour, TOTAL_KM} from './data.js';
import {recommend, distanceTo} from './plan.js';

test('阳霞至焉耆经双丰立交补电，两段距离按高德路线计算',()=>{
  const yangxia = stops.find(s=>s.name==='阳霞服务区');
  const charger = stops.find(s=>s.name==='铁门关筑磊超充站');
  const yanqi = stops.find(s=>s.name==='焉耆服务区');
  assert.equal(distanceTo(charger,yangxia.km),95.5);
  assert.equal(distanceTo(yanqi,charger.km),93.5);
  assert.equal(chargingDetour.charger.poi,'B0MRJH5RH3');
  assert.equal(days[1].km,yanqi.km);
  assert.equal(TOTAL_KM,3880.6);
});
test('有余量时推荐筑磊站，余量不足时不推荐',()=>{
  assert.equal(recommend(stops,858.5,160,25).chosen?.name,'铁门关筑磊超充站');
  assert.equal(recommend(stops,858.5,100,25).chosen,null);
  assert.equal(stops.some(s=>s.name.includes('库尔楚')),false);
});

test('即使旧设置把预留里程设为零，也至少保留 25 公里且候选充电站保持阻断',()=>{
  const plan=recommend(stops,858.5,150,0);
  assert.equal(plan.chosen,null);
  assert.equal(plan.blocked,true);
  const candidate=recommend(stops,858.5,160,0);
  assert.equal(candidate.chosen?.name,'铁门关筑磊超充站');
  assert.equal(candidate.blocked,true);
});

test('未核实快充的停车区不得拆分超过 100 公里的补电候选间隔',()=>{
  const candidates=stops.filter(s=>s.status!=='rest-only');
  const gaps=candidates.slice(1).map((s,i)=>({from:candidates[i].name,to:s.name,km:s.km-candidates[i].km}));
  const long=gaps.filter(g=>g.km>100);
  assert.equal(long.length,7);
  assert.ok(long.some(g=>g.from==='库车服务区'&&g.to==='阳霞服务区'&&Math.abs(g.km-115.6)<0.01));
});

test('整段同起终点绕行差额清楚标注',()=>{
  assert.ok(Math.abs((chargingDetour.viaRouteKm-chargingDetour.directRouteKm)-chargingDetour.extraRouteKm)<0.001);
});
