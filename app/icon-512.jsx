import { ImageResponse } from "next/og";
import { TimeboxingPwaIconElement } from "./icon-pwa-shared.jsx";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon512() {
  return new ImageResponse(<TimeboxingPwaIconElement size={512} />, { ...size });
}
