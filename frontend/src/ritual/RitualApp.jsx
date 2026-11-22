import { useSearchParams } from "react-router-dom";
import RitualScroll from "./RitualScroll";

export default function RitualApp() {
  const [searchParams] = useSearchParams();
  return <RitualScroll focusCard={searchParams.get("card") === "1"} />;
}
