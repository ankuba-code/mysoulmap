const COUNTRY_FLAGS = {
  Peru: ["PE"],
  Australia: ["AU"],
  Jordan: ["JO"],
  Canada: ["CA"],
  India: ["IN"],
  France: ["FR"],
  Bolivia: ["BO"],
  Iceland: ["IS"],
  Tanzania: ["TZ"],
  Japan: ["JP"],
  Guatemala: ["GT"],
  Uzbekistan: ["UZ"],
  Turkey: ["TR"],
  Morocco: ["MA"],
  Chile: ["CL"],
  Cambodia: ["KH"],
  Argentina: ["AR"],
  Egypt: ["EG"],
  UK: ["GB"],
  "Sri Lanka": ["LK"],
  "USA/Canada": ["US", "CA"],
  "New Zealand": ["NZ"],
  Portugal: ["PT"],
  USA: ["US"],
  Indonesia: ["ID"],
  Italy: ["IT"],
  Israel: ["IL"],
  Ethiopia: ["ET"],
  Mexico: ["MX"],
  Greece: ["GR"],
  Russia: ["RU"],
};

export function countryFlagCodes(country) {
  return COUNTRY_FLAGS[country] || [];
}

export function flagEmoji(code) {
  return String(code)
    .toUpperCase()
    .replace(/[A-Z]/g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
}
