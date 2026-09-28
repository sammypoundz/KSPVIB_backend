import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

// Renders a scannable QR code (canvas → PNG) pointing at the verification URL.
// The URL encodes the invoice number; status is always fetched live from the
// server when the link is opened — never trusted from the QR itself.
export default function QrCode({ value, size = 170 }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!value) return;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [value, size]);

  if (!src)
    return <div className="qr" style={{ width: size, height: size }} />;

  return (
    <img
      className="qr-img"
      src={src}
      width={size}
      height={size}
      alt="Scan to verify invoice status"
    />
  );
}
