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

test('整段同起终点绕行差额清楚标注',()=>{
  assert.ok(Math.abs((chargingDetour.viaRouteKm-chargingDetour.directRouteKm)-chargingDetour.extraRouteKm)<0.001);
});
