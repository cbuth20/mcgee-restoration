import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.ACCULYNX_API_KEY!;
const BASE_URL = process.env.ACCULYNX_BASE_URL || "https://api.acculynx.com/api/v2";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");

  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint parameter" }, { status: 400 });
  }

  // Build query params (exclude our internal 'endpoint' param)
  const apiParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== "endpoint") {
      apiParams.set(key, value);
    }
  });

  const apiUrl = `${BASE_URL}${endpoint}${
    apiParams.toString() ? `?${apiParams.toString()}` : ""
  }`;

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: `AccuLynx API Error: ${res.status}`, details: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to reach AccuLynx API", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const reqBody = await request.json();
  const { endpoint, body } = reqBody;

  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  const apiUrl = `${BASE_URL}${endpoint}`;

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: `AccuLynx API Error: ${res.status}`, details: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to reach AccuLynx API", details: String(error) },
      { status: 500 }
    );
  }
}
