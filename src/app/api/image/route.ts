import { NextResponse } from "next/server";

type Provider = "unsplash" | "google" | "auto";

type CacheEntry = {
  imageUrl: string | null;
  expiresAt: number;
  cachedAt: number;
  provider: Exclude<Provider, "auto">;
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_OK_MS = 10 * 60 * 1000;
const CACHE_TTL_EMPTY_MS = 60 * 1000;

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").slice(0, 80);
}

function coerceProvider(value: string | null | undefined): Provider | null {
  if (!value) return null;
  const v = value.toLowerCase().trim();
  if (v === "unsplash" || v === "google" || v === "auto") return v;
  return null;
}

function buildUnsplashSourceUrl(query: string) {
  // No API key needed. Returns a 302 to a real Unsplash image URL.
  // Using a square size keeps UI consistent.
  const q = query.trim().replace(/\s+/g, ",");
  return `https://source.unsplash.com/900x900/?${encodeURIComponent(q)}`;
}

async function lookupGoogleImageUrl({
  q,
  apiKey,
  cseId,
  debug,
}: {
  q: string;
  apiKey: string;
  cseId: string;
  debug: boolean;
}) {
  const endpoint = new URL("https://www.googleapis.com/customsearch/v1");
  endpoint.searchParams.set("key", apiKey);
  endpoint.searchParams.set("cx", cseId);
  endpoint.searchParams.set("q", q);
  endpoint.searchParams.set("searchType", "image");
  endpoint.searchParams.set("num", "1");
  endpoint.searchParams.set("safe", "active");
  // Prefer thumbnails (usually gstatic), so we don't have to whitelist random image hosts.
  endpoint.searchParams.set("fields", "items(image/thumbnailLink)");

  const res = await fetch(endpoint.toString(), { cache: "no-store" });
  if (!res.ok) {
    let upstreamError: unknown = undefined;
    if (debug) {
      try {
        upstreamError = await res.clone().json();
      } catch {
        try {
          upstreamError = (await res.clone().text()).slice(0, 2000);
        } catch {
          upstreamError = "Failed to read upstream body";
        }
      }
    }
    return { imageUrl: null, upstreamStatus: res.status, upstreamError };
  }

  const data = (await res.json()) as {
    items?: Array<{ image?: { thumbnailLink?: string } }>;
  };

  const imageUrl = data.items?.[0]?.image?.thumbnailLink ?? null;
  return { imageUrl, upstreamStatus: res.status };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("q") ?? "";
  const q = normalizeQuery(raw);
  const debug = url.searchParams.get("debug") === "1";
  const refresh = url.searchParams.get("refresh") === "1";

  const preferred =
    coerceProvider(url.searchParams.get("provider")) ??
    coerceProvider(process.env.IMAGE_PROVIDER) ??
    "unsplash";

  if (!q) {
    return NextResponse.json({ imageUrl: null }, { status: 200 });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  const envState = apiKey && cseId ? "env1" : "env0";
  const cacheKey = `${preferred}:${envState}:${q}`;

  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (!refresh && cached && cached.expiresAt > now) {
    return NextResponse.json(
      {
        imageUrl: cached.imageUrl,
        cached: true,
        provider: cached.provider,
        ...(debug
          ? {
              debug: {
                q,
                cacheKey,
                preferred,
                provider: cached.provider,
                cachedAt: cached.cachedAt,
                hasGoogleKey: Boolean(apiKey),
                hasGoogleCseId: Boolean(cseId),
              },
            }
          : {}),
      },
      {
        status: 200,
        headers: { "Cache-Control": "public, max-age=0, s-maxage=600" },
      },
    );
  }

  let googleDebug: unknown = undefined;

  if ((preferred === "google" || preferred === "auto") && apiKey && cseId) {
    try {
      const google = await lookupGoogleImageUrl({ q, apiKey, cseId, debug });
      if (debug) googleDebug = google;
      if (google.imageUrl) {
        cache.set(cacheKey, {
          imageUrl: google.imageUrl,
          provider: "google",
          cachedAt: now,
          expiresAt: now + CACHE_TTL_OK_MS,
        });
        return NextResponse.json(
          {
            imageUrl: google.imageUrl,
            cached: false,
            provider: "google",
            ...(debug
              ? {
                  debug: {
                    q,
                    cacheKey,
                    preferred,
                    provider: "google",
                    hasGoogleKey: true,
                    hasGoogleCseId: true,
                    google: googleDebug,
                  },
                }
              : {}),
          },
          {
            status: 200,
            headers: { "Cache-Control": "public, max-age=0, s-maxage=600" },
          },
        );
      }
    } catch (err) {
      if (debug) googleDebug = { error: "fetch_failed", details: String(err) };
    }
  }

  const imageUrl = buildUnsplashSourceUrl(q);
  cache.set(cacheKey, {
    imageUrl,
    provider: "unsplash",
    cachedAt: now,
    expiresAt: now + (preferred === "google" ? CACHE_TTL_EMPTY_MS : CACHE_TTL_OK_MS),
  });

  return NextResponse.json(
    {
      imageUrl,
      cached: false,
      provider: "unsplash",
      ...(debug
        ? {
            debug: {
              q,
              cacheKey,
              preferred,
              provider: "unsplash",
              hasGoogleKey: Boolean(apiKey),
              hasGoogleCseId: Boolean(cseId),
              google: googleDebug,
            },
          }
        : {}),
    },
    {
      status: 200,
      headers: { "Cache-Control": "public, max-age=0, s-maxage=600" },
    },
  );
}

