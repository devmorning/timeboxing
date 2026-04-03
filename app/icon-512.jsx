import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon512() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#EA580C",
          color: "#FFFFFF",
          fontSize: 220,
          fontWeight: 700,
          borderRadius: 256,
          letterSpacing: "-0.02em",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        TB
      </div>
    ),
    { ...size }
  );
}

