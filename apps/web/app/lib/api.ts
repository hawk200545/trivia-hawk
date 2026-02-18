const HTTP_URL = process.env.NEXT_PUBLIC_HTTP_URL || "http://localhost:3001";

export async function api<T = unknown>(
    path: string,
    options?: RequestInit
): Promise<T> {
    const url = `${HTTP_URL}${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
            (body as { error?: string }).error || `HTTP ${res.status}`
        );
    }

    return res.json() as Promise<T>;
}
