const BASE_URL = "https://v6.db.transport.rest";

export async function dbGet<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(
      `DB API error ${response.status} ${response.statusText} for ${url.pathname}: ${body}`,
    );
  }

  return (await response.json()) as T;
}
