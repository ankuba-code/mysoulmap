export function goHref(bookingLink, language) {
  const url = new URL(bookingLink, "https://soulmap.invalid");
  if (language) {
    url.searchParams.set("lang", language);
  }
  return `${url.pathname}${url.search}`;
}
