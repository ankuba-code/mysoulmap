import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";

const icon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FocusPlace({ placeId, places }) {
  const map = useMap();
  useEffect(() => {
    const place = places.find((item) => item.id === placeId);
    if (!place) {
      return;
    }
    map.flyTo([place.coordinates.lat, place.coordinates.lng], 4);
  }, [map, placeId, places]);
  return null;
}

function FitPlaces({ places }) {
  const map = useMap();
  useEffect(() => {
    if (!places.length) {
      return;
    }
    const bounds = L.latLngBounds(places.map((place) => [place.coordinates.lat, place.coordinates.lng]));
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 5 });
  }, [map, places]);
  return null;
}

export default function ResultsMap({ places, focusPlaceId = null }) {
  const first = places[0]?.coordinates;
  return (
    <MapContainer
      center={first ? [first.lat, first.lng] : [20, 0]}
      zoom={2}
      scrollWheelZoom={false}
      className="h-64 w-full overflow-hidden rounded-2xl sm:h-[420px]"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitPlaces places={places} />
      <FocusPlace placeId={focusPlaceId} places={places} />
      {places.map((place) => (
        <Marker key={place.id} position={[place.coordinates.lat, place.coordinates.lng]} icon={icon}>
          <Tooltip permanent direction="top" offset={[0, -28]}>
            {(place.country || place.name).toUpperCase()}
          </Tooltip>
          <Popup>
            {place.name}
            <br />
            {place.country}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
