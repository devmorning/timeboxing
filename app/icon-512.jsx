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
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #f97316 0%, #ea580c 46%, #c2410c 100%)",
          borderRadius: 112,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "10%",
            borderRadius: 74,
            background: "rgba(255,255,255,0.2)",
            border: "3px solid rgba(255,255,255,0.34)",
          }}
        />
        <div
          style={{
            width: "62%",
            height: "62%",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignContent: "space-between",
          }}
        >
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                width: "46%",
                height: "46%",
                borderRadius: 28,
                background: idx === 1 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.8)",
              }}
            />
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            display: "flex",
            right: "20%",
            bottom: "18%",
            width: 102,
            height: 102,
            borderRadius: 999,
            background: "#fff7ed",
            border: "5px solid rgba(255,255,255,0.95)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "24%",
              width: 5,
              height: 30,
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
              width: 25,
              height: 5,
              background: "#c2410c",
              transform: "translateY(-50%)",
              borderRadius: 999,
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}

