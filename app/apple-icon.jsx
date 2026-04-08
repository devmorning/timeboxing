import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #f97316 0%, #ea580c 46%, #c2410c 100%)",
          borderRadius: 40,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "10%",
            borderRadius: 26,
            background: "rgba(255,255,255,0.2)",
            border: "1px solid rgba(255,255,255,0.34)",
          }}
        />
        <div
          style={{
            width: "62%",
            height: "62%",
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 9,
            zIndex: 1,
          }}
        >
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                borderRadius: 11,
                background: idx === 1 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.8)",
              }}
            />
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            right: "20%",
            bottom: "18%",
            width: 34,
            height: 34,
            borderRadius: 999,
            background: "#fff7ed",
            border: "2px solid rgba(255,255,255,0.95)",
            zIndex: 2,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "24%",
              width: 2,
              height: 10,
              background: "#c2410c",
              transform: "translateX(-50%)",
              borderRadius: 999,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 8,
              height: 2,
              background: "#c2410c",
              transform: "translateY(-50%)",
              borderRadius: 999,
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
