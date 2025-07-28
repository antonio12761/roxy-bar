import { NextRequest, NextResponse } from "next/server";

// This endpoint has been deprecated in favor of /api/sse
export async function GET(request: NextRequest) {
  console.log("[SSE Migration] Redirecting from old endpoint to new /api/sse endpoint");
  
  // Get the current URL and replace the path
  const url = new URL(request.url);
  url.pathname = '/api/sse';
  
  // Return a redirect response
  return NextResponse.redirect(url, 301);
}

// POST endpoint also redirects
export async function POST(request: NextRequest) {
  console.log("[SSE Migration] Redirecting POST from old endpoint to new /api/sse endpoint");
  
  const url = new URL(request.url);
  url.pathname = '/api/sse';
  
  return NextResponse.redirect(url, 301);
}