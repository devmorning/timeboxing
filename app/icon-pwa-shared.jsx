/**
 * PWA / 홈 화면 아이콘용 — next/og ImageResponse(Satori)에서 쓰는 정적 마크업.
 * 4칸 그리드 대신 리퀴드 글래스 + 시계(타임박싱)로 통일.
 */
export function TimeboxingPwaIconElement({ size }) {
  const t = size / 192;
  const px = (v) => `${Math.max(1, Math.round(v * t))}px`;

  return (
    <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderRadius: px(44),
          background:
              "linear-gradient(158deg, #f5f5f4 0%, #ffedd5 22%, #fdba74 52%, #fb923c 78%, #ea580c 100%)",
        }}
    >
      {/* 상단 소프트 하이라이트 (글래스 상단 광택) */}
      <div
          style={{
            position: "absolute",
            left: "50%",
            top: "-8%",
            transform: "translateX(-50%)",
            width: "92%",
            height: "48%",
            borderRadius: "50%",
            background:
                "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.08) 55%, transparent 100%)",
            opacity: 0.85,
          }}
      />
      {/* 하단 웜 글로우 (Satori 호환: linear만 사용) */}
      <div
          style={{
            position: "absolute",
            left: "0",
            bottom: "0",
            width: "100%",
            height: "46%",
            background:
                "linear-gradient(0deg, rgba(251,146,60,0.28) 0%, rgba(253,186,116,0.12) 45%, transparent 100%)",
            opacity: 0.95,
          }}
      />

      {/* 리퀴드 글래스 패널 — 아이콘 가장자리에 가깝게(최대 크기) */}
      <div
          style={{
            position: "relative",
            width: "93%",
            height: "93%",
            borderRadius: px(41),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
                "linear-gradient(165deg, rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.14) 42%, rgba(255,255,255,0.22) 100%)",
            border: `${px(2.5)} solid rgba(255,255,255,0.72)`,
            boxShadow: [
              `inset 0 ${px(2)} ${px(14)} rgba(255,255,255,0.55)`,
              `inset 0 ${px(-2)} ${px(10)} rgba(251,146,60,0.12)`,
              `0 ${px(4)} ${px(22)} rgba(15,23,42,0.12)`,
            ].join(", "),
          }}
      >
        {/* 시계: 하루를 쪼개는 타임박싱을 상징 */}
        <div
            style={{
              position: "relative",
              width: "62%",
              height: "62%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              border: `${px(4)} solid rgba(255,255,255,0.92)`,
              boxShadow: [
                `inset 0 0 0 ${px(1)} rgba(255,255,255,0.35)`,
                `0 ${px(2)} ${px(12)} rgba(255,255,255,0.25)`,
              ].join(", "),
              background: "rgba(255,255,255,0.08)",
            }}
        >
          <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: px(10),
                height: px(10),
                borderRadius: "50%",
                background: "rgba(255,255,255,0.95)",
                transform: "translate(-50%, -50%)",
                boxShadow: `0 ${px(1)} ${px(4)} rgba(15,23,42,0.12)`,
              }}
          />
          {/* 시침 */}
          <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: px(5),
                height: "32%",
                borderRadius: px(3),
                background: "rgba(255,255,255,0.96)",
                transform: "translate(-50%, -100%) rotate(-32deg)",
                transformOrigin: "bottom center",
                boxShadow: `0 ${px(1)} ${px(3)} rgba(15,23,42,0.08)`,
              }}
          />
          {/* 분침 */}
          <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: px(4),
                height: "40%",
                borderRadius: px(2),
                background: "rgba(255,255,255,0.88)",
                transform: "translate(-50%, -100%) rotate(48deg)",
                transformOrigin: "bottom center",
              }}
          />
        </div>
      </div>
    </div>
  );
}
