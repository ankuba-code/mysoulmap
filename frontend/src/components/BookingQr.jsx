import { QRCodeSVG } from "qrcode.react";
import { bookingTarget } from "../export/bookingUrl";

export default function BookingQr({ place, language, label = "booking.com", size = 84 }) {
  const value = bookingTarget(place, language);
  if (!value) {
    return null;
  }
  return (
    <a
      href={value}
      target="_blank"
      rel="sponsored nofollow noopener"
      aria-label={label}
      className="inline-flex shrink-0 rounded-lg bg-white p-1.5"
    >
      <QRCodeSVG value={value} size={size} bgColor="#ffffff" fgColor="#1c1917" />
    </a>
  );
}
