import { countryFlagCodes, flagEmoji } from "../places/country";

export default function CountryLabel({ country, flagCountry = "", className = "" }) {
  if (!country) {
    return null;
  }
  const flags = countryFlagCodes(flagCountry || country).map(flagEmoji);
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {flags.length ? (
        <span aria-hidden="true" className="text-[15px] leading-none">
          {flags.join(" ")}
        </span>
      ) : null}
      <span>{country}</span>
    </span>
  );
}
