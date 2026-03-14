interface TokenCache {
  access_token: string;
  expires_at: number;
}

let tokenCache: TokenCache | null = null;

export async function getPrimeToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expires_at - 30000) {
    return tokenCache.access_token;
  }

  const baseUrl = process.env.PRIME_BASE_URL!;
  const username = process.env.PRIME_USERNAME!;
  const password = process.env.PRIME_PASSWORD!;
  const clientId = process.env.PRIME_CLIENT_ID!;
  const clientSecret = process.env.PRIME_CLIENT_SECRET!;

  // The OAuth2 token endpoint is typically at /oauth/token relative to the base
  // For Prime API, token endpoint pattern
  const tokenUrl = baseUrl.replace('/api.prime/v2', '') + '/oauth/token';

  const params = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
    client_id: clientId,
    client_secret: clientSecret,
    scope: '',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  tokenCache = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return tokenCache.access_token;
}

export async function primeGet(path: string, retries = 3): Promise<unknown> {
  const baseUrl = process.env.PRIME_BASE_URL!;
  const token = await getPrimeToken();
  const url = `${baseUrl}${path}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
      await sleep((retryAfter + 0.1) * 1000);
      continue;
    }

    if (res.status === 401) {
      // Token expired, clear and retry
      tokenCache = null;
      const freshToken = await getPrimeToken();
      const retryRes = await fetch(url, {
        headers: {
          Authorization: `Bearer ${freshToken}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });
      if (!retryRes.ok) throw new Error(`Prime API error: ${retryRes.status}`);
      return retryRes.json();
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Prime API error: ${res.status} ${text}`);
    }

    return res.json();
  }

  throw new Error('Max retries exceeded');
}

export async function primeGetAllPages(
  path: string,
  perPage = 100
): Promise<unknown[]> {
  const allData: unknown[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const sep = path.includes('?') ? '&' : '?';
    const data = (await primeGet(`${path}${sep}per_page=${perPage}&page=${page}`)) as {
      data?: unknown[];
      meta?: { last_page?: number; current_page?: number; total?: number };
    };

    const items = data?.data || [];
    allData.push(...items);

    const meta = data?.meta;
    if (!meta || page >= (meta.last_page || 1)) {
      hasMore = false;
    } else {
      page++;
      await sleep(1100); // rate limit: 60 req/min
    }
  }

  return allData;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
