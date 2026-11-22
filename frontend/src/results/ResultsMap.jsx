import { useEffect } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import CountryLabel from "../components/CountryLabel";

const icon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function RefreshSize() {
  const map = useMap();
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    const later = window.setTimeout(() => map.invalidateSize(), 200);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(later);
    };
  }, [map]);
  return null;
}

function FitPlaces({ places, origin }) {
  const map = useMap();
  useEffect(() => {
    const points = places.map((place) => [place.coordinates.lat, place.coordinates.lng]);
    if (origin) {
      points.push([origin.latitude, origin.longitude]);
    }
    if (!points.length) {
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 5 });
  }, [map, origin, places]);
  return null;
}

const ZOOM_LABELS = {
  de: ["Vergrößern", "Verkleinern"],
  en: ["Zoom in", "Zoom out"],
  es: ["Acercar", "Alejar"],
  ru: ["Приблизить", "Отдалить"],
};

export default function ResultsMap({ places, focusPlaceId = null, origin = null, originLabel = "", layout = "page", language = "de" }) {
  const focused = places.find((place) => place.id === focusPlaceId)?.coordinates;
  const first = focused || places[0]?.coordinates;
  const [zoomIn, zoomOut] = ZOOM_LABELS[language] || ZOOM_LABELS.de;
  return (
    <MapContainer
      center={first ? [first.lat, first.lng] : [20, 0]}
      zoom={focused ? 8 : 2}
      zoomControl={false}
      scrollWheelZoom={layout === "overlay"}
      className={layout === "overlay" ? "h-full w-full" : "h-64 w-full overflow-hidden rounded-2xl sm:h-[420px]"}
    >
      <ZoomControl zoomInTitle={zoomIn} zoomOutTitle={zoomOut} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RefreshSize />
      {focused ? null : <FitPlaces places={places} origin={origin} />}
      {origin ? (
        <Circle
          center={[origin.latitude, origin.longitude]}
          radius={origin.accuracy_radius_km * 1000}
          pathOptions={{ color: "#b45309", weight: 1, fillColor: "#b45309", fillOpacity: 0.18 }}
        >
          {originLabel ? (
            <Tooltip permanent direction="top">
              {originLabel}
            </Tooltip>
          ) : null}
        </Circle>
      ) : null}
      {places.map((place) => (
        <Marker key={place.id} position={[place.coordinates.lat, place.coordinates.lng]} icon={icon} alt={place.name} title={place.name}>
          <Tooltip permanent direction="top" offset={[0, -28]}>
            {place.name}
          </Tooltip>
          <Popup>
            {place.name}
            {place.country ? (
              <>
                <br />
                <CountryLabel country={place.country} flagCountry={place.flagCountry} />
              </>
            ) : null}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
