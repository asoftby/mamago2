export const EVENT_LOCATION_MAP_CLICK_MESSAGE = "mamago:event-location-map-click";

interface EventLocationLeafletMapOptions {
  lat?: number | null;
  lng?: number | null;
  interactive?: boolean;
}

function finiteCoordinate(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Keyless Event Wizard map based on Leaflet + the standard OpenStreetMap tile
 * endpoint. This keeps manual map picking operational even if Google Maps
 * browser-key/referrer configuration is temporarily broken and avoids a
 * second API-key dependency for the basemap itself.
 */
export function buildEventLocationLeafletMapHtml({
  lat,
  lng,
  interactive = false,
}: EventLocationLeafletMapOptions): string {
  const safeLat = finiteCoordinate(lat);
  const safeLng = finiteCoordinate(lng);
  const hasPin = safeLat !== null && safeLng !== null;
  const centerLat = hasPin ? safeLat : 53.9045;
  const centerLng = hasPin ? safeLng : 27.5615;
  const zoom = hasPin ? 16 : 12;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#f0ede8}
  body{overflow:hidden}
  .leaflet-control-attribution{font-size:9px;opacity:.7}
  .pin-wrap{position:relative;width:48px;height:56px;display:flex;align-items:flex-start;justify-content:center}
  .pin-ring{position:absolute;left:8px;top:20px;width:32px;height:32px;border-radius:50%;background:rgba(232,106,58,.20);animation:pulse 2s ease-out infinite}
  .pin-dot{position:relative;z-index:1;width:34px;height:44px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.22))}
  @keyframes pulse{0%{transform:scale(.7);opacity:.9}70%,100%{transform:scale(1.55);opacity:0}}
</style>
</head>
<body>
<div id="map"></div>
<script>
  const map=L.map('map',{zoomControl:true,scrollWheelZoom:${interactive ? "true" : "false"},attributionControl:true})
    .setView([${centerLat},${centerLng}],${zoom});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const markerHtml='<div class="pin-wrap"><div class="pin-ring"></div><svg class="pin-dot" viewBox="0 0 40 52" fill="none" aria-hidden="true"><path d="M20 0C8.954 0 0 8.954 0 20c0 14 20 32 20 32s20-18 20-32C40 8.954 31.046 0 20 0z" fill="#E86A3A"/><circle cx="20" cy="20" r="7" fill="white"/></svg></div>';
  const icon=L.divIcon({html:markerHtml,className:'',iconSize:[48,56],iconAnchor:[24,52]});
  let marker=null;
  function setPin(nextLat,nextLng){
    if(marker){marker.setLatLng([nextLat,nextLng]);}
    else{marker=L.marker([nextLat,nextLng],{icon}).addTo(map);}
  }
  ${hasPin ? `setPin(${safeLat},${safeLng});` : ""}
  ${interactive ? `map.on('click',function(event){
    const nextLat=event.latlng.lat;
    const nextLng=event.latlng.lng;
    setPin(nextLat,nextLng);
    window.parent.postMessage({type:'${EVENT_LOCATION_MAP_CLICK_MESSAGE}',lat:nextLat,lng:nextLng},'*');
  });` : ""}
<\/script>
</body>
</html>`;
}
