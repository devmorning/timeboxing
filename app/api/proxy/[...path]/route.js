import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getBackendBaseUrl() {
  const base =
    process.env.NEXT_PUBLIC_TIMEBOXING_API_BASE_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost"
      : "https://timeboxing-api.vercel.app");
  return base.replace(/\/+$/, "");
}

function buildTargetUrl(request, pathSegments) {
  const path = Array.isArray(pathSegments) ? pathSegments.join("/") : "";
  const search = request.nextUrl.search || "";
  return `${getBackendBaseUrl()}/${path}${search}`;
}

function copySetCookieHeaders(fromHeaders, toHeaders) {
  if (typeof fromHeaders.getSetCookie === "function") {
    const cookies = fromHeaders.getSetCookie();
    for (const cookie of cookies) {
      toHeaders.append("set-cookie", cookie);
    }
    return;
  }

  const single = fromHeaders.get("set-cookie");
  if (single) {
    toHeaders.append("set-cookie", single);
  }
}

async function proxyRequest(request, { params }) {
  const { path = [] } = await params;
  const targetUrl = buildTargetUrl(request, path);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.delete("host");
  requestHeaders.set("x-forwarded-host", request.headers.get("host") || "");
  requestHeaders.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  const init = {
    method: request.method,
    headers: requestHeaders,
    redirect: "manual",
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(targetUrl, init);
  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  const location = upstream.headers.get("location");

  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }

  copySetCookieHeaders(upstream.headers, responseHeaders);

  if (location) {
    responseHeaders.set("location", location);
    return new NextResponse(null, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
