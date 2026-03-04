"use client";

import { useEffect, useMemo, useState } from "react";

import { tomorrowDateOnly } from "@/lib/utils/date";

type SearchResult = {
  destination: string;
  bookingUrl: string;
  bestOutbound: {
    stops: number;
    totalMinutes: number;
    legs: Array<{
      origin: string;
      destination: string;
      depTs: string;
      arrTs: string;
      carrier: string;
      flightNo: string;
    }>;
  };
  returnCheck: {
    feasible: boolean;
    reason?: string;
    bestReturnDate?: string;
    bestReturn?: {
      stops: number;
      totalMinutes: number;
      legs: Array<{
        origin: string;
        destination: string;
        depTs: string;
        arrTs: string;
        carrier: string;
        flightNo: string;
      }>;
    };
  };
};

type Watch = {
  id: string;
  originGroup: string;
  dateMode: "TOMORROW" | "EXACT_DATE";
  exactDate: string | null;
  maxStops: number;
  requireReturn: boolean;
  minNights: number;
  maxNights: number;
  emailEnabled: boolean;
  digestEnabled: boolean;
};

type SettingsResponse = {
  email: string;
  timezone: string;
  defaultOriginGroup: string;
  digestPreference: {
    sendDay: number;
    sendLocalTime: string;
    minNights: number;
    maxNights: number;
    topN: number;
    sendEmptyDigest: boolean;
  };
};

type SearchState = {
  originGroup: string;
  departDate: string;
  maxStops: number;
  requireReturn: boolean;
  minNights: number;
  maxNights: number;
};

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatLeg(leg: SearchResult["bestOutbound"]["legs"][number]) {
  return `${leg.origin} -> ${leg.destination} (${leg.carrier}${leg.flightNo})`;
}

const FALLBACK_EMAIL = "demo@gowild.local";

export function GoWildDashboard() {
  const [email, setEmail] = useState(FALLBACK_EMAIL);
  const [search, setSearch] = useState<SearchState>({
    originGroup: "CHI",
    departDate: tomorrowDateOnly(),
    maxStops: 2,
    requireReturn: true,
    minNights: 1,
    maxNights: 3,
  });

  const [results, setResults] = useState<SearchResult[]>([]);
  const [metaSource, setMetaSource] = useState<"cache" | "fresh" | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    const storedEmail = window.localStorage.getItem("gowild_email");
    if (storedEmail) {
      setEmail(storedEmail);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("gowild_email", email);
  }, [email]);

  const headers = useMemo(() => ({ "x-user-email": email }), [email]);

  async function loadWatches() {
    const response = await fetch("/api/watches", { headers });
    if (!response.ok) {
      throw new Error("Could not load watches");
    }
    const payload = (await response.json()) as { watches: Watch[] };
    setWatches(payload.watches);
  }

  async function loadSettings() {
    const response = await fetch("/api/settings", { headers });
    if (!response.ok) {
      throw new Error("Could not load settings");
    }
    const payload = (await response.json()) as SettingsResponse;
    setSettings(payload);
  }

  useEffect(() => {
    loadWatches().catch(() => {
      setStatus("Unable to load watches.");
    });
    loadSettings().catch(() => {
      setStatus("Unable to load settings.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  async function runSearch() {
    setIsSearching(true);
    setStatus("");

    try {
      const params = new URLSearchParams({
        originGroup: search.originGroup,
        departDate: search.departDate,
        maxStops: String(search.maxStops),
        requireReturn: String(search.requireReturn),
        minNights: String(search.minNights),
        maxNights: String(search.maxNights),
      });

      const response = await fetch(`/api/search?${params.toString()}`, { headers });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Search failed");
      }

      const payload = (await response.json()) as {
        meta: { source: "cache" | "fresh" };
        results: SearchResult[];
      };

      setResults(payload.results);
      setMetaSource(payload.meta.source);
      setStatus(`Found ${payload.results.length} return-aware destination(s).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  }

  async function saveWatch() {
    setStatus("");
    const response = await fetch("/api/watches", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        originGroup: search.originGroup,
        dateMode: "EXACT_DATE",
        exactDate: search.departDate,
        maxStops: search.maxStops,
        requireReturn: search.requireReturn,
        minNights: search.minNights,
        maxNights: search.maxNights,
        emailEnabled: true,
        digestEnabled: true,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setStatus(payload.error || "Could not save watch");
      return;
    }

    await loadWatches();
    setStatus("Watch saved.");
  }

  async function removeWatch(id: string) {
    const response = await fetch(`/api/watches/${id}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      setStatus("Could not delete watch.");
      return;
    }

    await loadWatches();
    setStatus("Watch removed.");
  }

  async function saveSettings() {
    if (!settings) {
      return;
    }

    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timezone: settings.timezone,
        defaultOriginGroup: settings.defaultOriginGroup,
        sendDay: settings.digestPreference.sendDay,
        sendLocalTime: settings.digestPreference.sendLocalTime,
        minNights: settings.digestPreference.minNights,
        maxNights: settings.digestPreference.maxNights,
        topN: settings.digestPreference.topN,
        sendEmptyDigest: settings.digestPreference.sendEmptyDigest,
      }),
    });

    if (!response.ok) {
      setStatus("Could not save settings.");
      return;
    }

    await loadSettings();
    setStatus("Settings saved.");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffd79f_0%,_#ffb38b_28%,_#f8f3eb_70%)] text-stone-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
        <header className="rounded-3xl border border-stone-900/10 bg-white/70 p-6 shadow-sm backdrop-blur">
          <p className="text-sm uppercase tracking-[0.22em] text-stone-500">GoWild Explorer</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Frontier route explorer with return checks</h1>
          <p className="mt-3 max-w-3xl text-stone-700">
            Find direct and connecting Frontier options, keep booking manual on Frontier, and get a Thursday
            weekend digest for return-feasible trips.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-stone-900/10 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Search</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Email identity
                <input
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="text-sm">
                Origin group
                <input
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
                  value={search.originGroup}
                  onChange={(event) => setSearch((current) => ({ ...current, originGroup: event.target.value.toUpperCase() }))}
                />
              </label>
              <label className="text-sm">
                Departure date
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
                  value={search.departDate}
                  onChange={(event) => setSearch((current) => ({ ...current, departDate: event.target.value }))}
                />
              </label>
              <label className="text-sm">
                Max stops
                <select
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
                  value={search.maxStops}
                  onChange={(event) =>
                    setSearch((current) => ({
                      ...current,
                      maxStops: Number(event.target.value),
                    }))
                  }
                >
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </label>
              <label className="text-sm">
                Min nights
                <input
                  type="number"
                  min={1}
                  max={7}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
                  value={search.minNights}
                  onChange={(event) =>
                    setSearch((current) => ({
                      ...current,
                      minNights: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="text-sm">
                Max nights
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
                  value={search.maxNights}
                  onChange={(event) =>
                    setSearch((current) => ({
                      ...current,
                      maxNights: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={search.requireReturn}
                onChange={(event) => setSearch((current) => ({ ...current, requireReturn: event.target.checked }))}
              />
              Require return itinerary (default on)
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={runSearch}
                disabled={isSearching}
                className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
              >
                {isSearching ? "Searching..." : "Search routes"}
              </button>
              <button
                type="button"
                onClick={saveWatch}
                className="rounded-xl border border-stone-900/20 bg-white px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-50"
              >
                Save watch
              </button>
            </div>

            {status ? <p className="mt-3 text-sm text-stone-700">{status}</p> : null}
            {metaSource ? <p className="mt-1 text-xs text-stone-500">Result source: {metaSource}</p> : null}
          </div>

          <div className="rounded-3xl border border-stone-900/10 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Settings</h2>
            {settings ? (
              <div className="mt-3 grid gap-3">
                <label className="text-sm">
                  Timezone
                  <input
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
                    value={settings.timezone}
                    onChange={(event) =>
                      setSettings((current) =>
                        current ? { ...current, timezone: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="text-sm">
                  Thursday send time
                  <input
                    type="time"
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
                    value={settings.digestPreference.sendLocalTime}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              digestPreference: {
                                ...current.digestPreference,
                                sendLocalTime: event.target.value,
                              },
                            }
                          : current,
                      )
                    }
                  />
                </label>
                <label className="text-sm">
                  Weekend min nights
                  <input
                    type="number"
                    min={1}
                    max={7}
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
                    value={settings.digestPreference.minNights}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              digestPreference: {
                                ...current.digestPreference,
                                minNights: Number(event.target.value),
                              },
                            }
                          : current,
                      )
                    }
                  />
                </label>
                <label className="text-sm">
                  Weekend max nights
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
                    value={settings.digestPreference.maxNights}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              digestPreference: {
                                ...current.digestPreference,
                                maxNights: Number(event.target.value),
                              },
                            }
                          : current,
                      )
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.digestPreference.sendEmptyDigest}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              digestPreference: {
                                ...current.digestPreference,
                                sendEmptyDigest: event.target.checked,
                              },
                            }
                          : current,
                      )
                    }
                  />
                  Send email even when no results
                </label>

                <button
                  type="button"
                  onClick={saveSettings}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-stone-900 hover:bg-amber-400"
                >
                  Save settings
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-500">Loading settings...</p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-stone-900/10 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Saved watches</h2>
          {watches.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">No saved watches yet.</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {watches.map((watch) => (
                <div
                  key={watch.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {watch.originGroup} | {watch.minNights}-{watch.maxNights} nights | max {watch.maxStops} stops
                    </p>
                    <p className="text-stone-600">Require return: {watch.requireReturn ? "Yes" : "No"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeWatch(watch.id)}
                    className="rounded-lg border border-stone-300 px-3 py-1 hover:bg-white"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-stone-900/10 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Results</h2>
          {results.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">Run a search to see destinations.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {results.map((result) => (
                <article key={result.destination} className="rounded-2xl border border-stone-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold">{result.destination}</h3>
                      <p className="text-sm text-stone-600">
                        {result.bestOutbound.stops} stop(s) outbound • {formatMinutes(result.bestOutbound.totalMinutes)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        result.returnCheck.feasible
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-rose-100 text-rose-900"
                      }`}
                    >
                      {result.returnCheck.feasible
                        ? `Return by ${result.returnCheck.bestReturnDate}`
                        : result.returnCheck.reason || "No return"}
                    </span>
                  </div>

                  <div className="mt-3 text-sm text-stone-700">
                    <p className="font-medium">Outbound legs</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {result.bestOutbound.legs.map((leg) => (
                        <li key={`${result.destination}-${leg.flightNo}-${leg.depTs}`}>{formatLeg(leg)}</li>
                      ))}
                    </ul>
                  </div>

                  {result.returnCheck.bestReturn ? (
                    <div className="mt-3 text-sm text-stone-700">
                      <p className="font-medium">Return legs</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {result.returnCheck.bestReturn.legs.map((leg) => (
                          <li key={`${result.destination}-return-${leg.flightNo}-${leg.depTs}`}>{formatLeg(leg)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <a
                    className="mt-4 inline-flex rounded-xl bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700"
                    href={result.bookingUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Book on Frontier
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
