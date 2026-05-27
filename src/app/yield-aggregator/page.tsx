import { redirect } from "next/navigation";

type RedirectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function buildQueryString(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
      continue;
    }

    if (value) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export default async function YieldAggregatorRedirectPage({
  searchParams,
}: RedirectPageProps) {
  const queryString = buildQueryString((await searchParams) ?? {});
  redirect(`/defi-rates${queryString}`);
}
