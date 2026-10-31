export function recommend(stops, progressKm, displayRangeKm, reserveKm = 25) {
  const usable = Math.max(0, displayRangeKm * 0.8 - Math.max(25, reserveKm));
  const ahead = stops.filter(s => s.km > progressKm + 0.5 && s.status !== 'rest-only');
  const within = ahead.filter(s => distanceTo(s, progressKm) <= Math.min(120, usable));
  const ordinary = within.filter(s => s.status !== 'critical');
  const chosen = ordinary.at(-1) || within.at(-1) || null;
  const next = ahead[0] || null;
  // A route candidate is never proof that its charger works today.
  return { usable, chosen, next, blocked: !chosen || chosen.status !== 'destination', distance: chosen ? distanceTo(chosen, progressKm) : null };
}

export function distanceTo(stop, progressKm) {
  return Math.max(0, stop.km - progressKm);
}

export function projectOnRoute(lon, lat, anchors) {
  let best = null;
  for (let i=0; i<anchors.length-1; i++) {
    const a=anchors[i], b=anchors[i+1];
    const scale=Math.cos(lat*Math.PI/180), x=(lon-a[0])*scale, y=lat-a[1];
    const dx=(b[0]-a[0])*scale, dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,(x*dx+y*dy)/(dx*dx+dy*dy)));
    const error=Math.hypot(x-t*dx,y-t*dy)*111;
    const km=a[2]+t*(b[2]-a[2]);
    if (!best || error<best.errorKm) best={km,errorKm:error};
  }
  return best;
}
