import { NextResponse } from "next/server";

// simple route to check if the api is running
export async function GET() {
  return NextResponse.json({ status: "ok", timestamp: Date.now().toLocaleString(), message: "API is running" });
}