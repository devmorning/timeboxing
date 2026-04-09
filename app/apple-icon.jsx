import { ImageResponse } from "next/og";
import { TimeboxingPwaIconElement } from "./icon-pwa-shared.jsx";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<TimeboxingPwaIconElement size={180} />, {
    ...size,
  });
}
