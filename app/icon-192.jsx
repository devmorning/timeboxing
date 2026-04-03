import { ImageResponse } from "next/og";

export const size = {
  width: 192,
  height: 192,
};

export const contentType = "image/png";

export default function Icon192() {
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
          fontSize: 86,
          fontWeight: 700,
          borderRadius: 96,
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

