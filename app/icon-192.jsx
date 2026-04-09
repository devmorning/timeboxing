import { ImageResponse } from "next/og";
import { TimeboxingPwaIconElement } from "./icon-pwa-shared.jsx";

export const size = {
  width: 192,
  height: 192,
};

export const contentType = "image/png";

export default function Icon192() {
  return new ImageResponse(<TimeboxingPwaIconElement size={192} />, { ...size });
}
