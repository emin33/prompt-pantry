import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// SignalWire SDK is loaded via UMD script in Layout.astro — window.SignalWire
declare global {
  interface Window {
    SignalWire?: {
      SignalWire?: (opts: { token: string; logLevel?: string }) => Promise<SignalWireClient>;
      Fabric?: (opts: { token: string; logLevel?: string }) => Promise<SignalWireClient>;
    };
    __carlShow?: () => void;
    __carlWake?: () => void;
  }
}

interface SignalWireClient {
  on: (event: string, handler: (params: unknown) => void) => void;
  off?: (event: string, handler: (params: unknown) => void) => void;
  disconnect: () => Promise<void> | void;
  dial: (opts: {
    to: string;
    rootElement: HTMLElement | null;
    audio?: boolean | MediaTrackConstraints;
    video?: boolean | MediaTrackConstraints;
    negotiateVideo?: boolean;
    userVariables?: Record<string, unknown>;
  }) => Promise<RoomSession>;
}

interface RoomSession {
  on: (event: string, handler: (params: unknown) => void) => void;
  start: () => Promise<void>;
  hangup: () => Promise<void>;
  localStream?: MediaStream;
}

interface Props {
  agentUrl?: string;
}

type Status = "idle" | "connecting" | "connected" | "error";

interface ChefCarlEvent {
  type?: string;
  [key: string]: unknown;
}

const LS_DISMISSED = "carl_dismissed";

// ─────────────────────────────────────────────────────────────────────────────
// Pull a useful event payload out of whatever shape the SDK hands us.
// SDK sometimes wraps the event as {event: {...}}, sometimes {params: {...}},
// sometimes raw. Filter out internal SDK lifecycle events (no `type` field).
// ─────────────────────────────────────────────────────────────────────────────
function extractEvent(params: unknown): ChefCarlEvent | null {
  if (!params || typeof params !== "object") return null;
  const p = params as Record<string, unknown>;
  let data: Record<string, unknown> = p;
  if (p.params && typeof p.params === "object") data = p.params as Record<string, unknown>;
  if (p.event && typeof p.event === "object") data = p.event as Record<string, unknown>;
  if (typeof data.type !== "string") return null;
  return data as ChefCarlEvent;
}

// Read the current recipe context from the DOM so the agent can see which page
// the cook is on. Recipes expose a slug via the URL path; title is in <title>.
function readPageState() {
  const path = window.location.pathname;
  // Accept optional trailing slash — Astro serves /recipes/<slug>/ with one.
  // Without `\/?`, a real URL like /recipes/jamaican-jerk-chicken/ misses the
  // match and the agent never gets the slug → no recipe block, no on-page
  // timer list, Carl can't drive step-specific actions.
  const recipeMatch = path.match(/^\/recipes\/([^/]+)\/?$/);
  const techniqueMatch = path.match(/^\/techniques\/([^/]+)\/?$/);
  return {
    current_page_path: path,
    current_recipe_slug: recipeMatch ? recipeMatch[1] : "",
    current_recipe_title: recipeMatch
      ? document.title.replace(/ \| Prompt Pantry$/, "")
      : "",
    current_technique_slug: techniqueMatch ? techniqueMatch[1] : "",
  };
}

export default function ChefCarlWidget({ agentUrl: agentUrlProp }: Props) {
  // agentUrl resolution: prop (build-time inlined PUBLIC_CARL_AGENT_URL) is
  // the fast path. If empty (Cloudflare's build env doesn't always expose
  // PUBLIC_* to static builds), fall back to /api/chef-carl-config which reads
  // the var from the Pages Function runtime env — different code path that
  // Cloudflare reliably populates.
  const [resolvedAgentUrl, setResolvedAgentUrl] = useState<string>(
    (agentUrlProp || "").replace(/\/$/, ""),
  );

  useEffect(() => {
    if (resolvedAgentUrl) return;
    (async () => {
      try {
        const r = await fetch("/api/chef-carl-config");
        if (!r.ok) return;
        const j = (await r.json()) as { agentUrl?: string };
        if (j.agentUrl) setResolvedAgentUrl(j.agentUrl.replace(/\/$/, ""));
      } catch {
        // Non-fatal; connect() will log a clearer error when clicked.
      }
    })();
  }, [resolvedAgentUrl]);

  const agentUrl = resolvedAgentUrl;

  const [status, setStatus] = useState<Status>("idle");
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [muted, setMuted] = useState(false);
  const [callStart, setCallStart] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const [timers, setTimers] = useState<{ id: number; label: string; end: number }[]>([]);

  const clientRef = useRef<SignalWireClient | null>(null);
  const roomRef = useRef<RoomSession | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const callIdRef = useRef<string>("");

  // ─── mount / dismiss memory ────────────────────────────────────────────────
  useEffect(() => {
    setDismissed(localStorage.getItem(LS_DISMISSED) === "true");
  }, []);

  const undismiss = useCallback(() => {
    localStorage.removeItem(LS_DISMISSED);
    setDismissed(false);
  }, []);

  // ─── call-duration ticker ──────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "connected" || callStart === null) return;
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [status, callStart]);

  const durationLabel = useMemo(() => {
    if (callStart === null) return "";
    const s = Math.floor((Date.now() - callStart) / 1000);
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  }, [callStart, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── bridge: SDK user_event → window CustomEvent ───────────────────────────
  const handleUserEvent = useCallback((params: unknown) => {
    const ev = extractEvent(params);
    if (!ev || !ev.type) return;
    // Forward to the page. Cancelable so on-page components (e.g. a matching
    // StepTimer) can claim an event with preventDefault, telling other
    // listeners (the floating widget timer) to skip showing a duplicate.
    window.dispatchEvent(new CustomEvent(ev.type, { detail: ev, cancelable: true }));
  }, []);

  // ─── page → agent state channel ────────────────────────────────────────────
  // `ngrok-skip-browser-warning` bypasses ngrok's free-tier HTML interstitial
  // that otherwise intercepts the first request from a new browser session
  // and makes fetch() get HTML instead of JSON. Harmless against any other
  // host (Cloudflare tunnel, prod deploy, etc.).
  const AGENT_HEADERS: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
  };

  const pushPageState = useCallback(async () => {
    if (!agentUrl || !callIdRef.current) return;
    try {
      await fetch(`${agentUrl}/page_state`, {
        method: "POST",
        headers: { ...AGENT_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: callIdRef.current,
          state: readPageState(),
        }),
      });
    } catch {
      // Non-fatal — agent will have slightly stale context for one turn
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentUrl]);

  // Fire pushPageState on Astro page transitions.
  useEffect(() => {
    const onNav = () => void pushPageState();
    document.addEventListener("astro:page-load", onNav);
    return () => document.removeEventListener("astro:page-load", onNav);
  }, [pushPageState]);

  // ─── handle agent-driven page actions (navigate + scroll_to) ──────────────
  // Other components own their own events (timers, cook mode, servings, pin).
  // These two belong at the widget level because they aren't tied to a
  // specific on-page component.
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const detail = (e as CustomEvent).detail as { path?: string } | undefined;
      const path = detail?.path;
      if (!path) return;
      // Use Astro's SPA navigate() when available, fall back to full nav.
      import("astro:transitions/client")
        .then((mod) => {
          if (typeof mod.navigate === "function") mod.navigate(path);
          else window.location.href = path;
        })
        .catch(() => {
          window.location.href = path;
        });
    };

    const onScrollTo = (e: Event) => {
      const detail = (e as CustomEvent).detail as { anchor?: string } | undefined;
      if (!detail?.anchor) return;
      const ANCHORS: Record<string, string> = {
        ingredients: "#ingredients",
        steps: "#recipe-body",
        notes: "#recipe-body",
      };
      const key = detail.anchor.toLowerCase();
      const selector = ANCHORS[key] || `#${key}`;
      const target = document.querySelector(selector);
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    const onScrollToStep = (e: Event) => {
      const detail = (e as CustomEvent).detail as { step?: number } | undefined;
      const stepN = Number(detail?.step);
      if (!stepN || stepN < 1) return;
      // [...slug].astro wraps each <h3> in #recipe-body in a .step-card div.
      const cards = document.querySelectorAll<HTMLElement>("#recipe-body .step-card");
      const target = cards[stepN - 1];
      if (target) {
        // The site header is sticky (h-16 = 64px). Manual scroll with offset
        // so the step heading sits clearly below the header instead of being
        // clipped underneath. scrollIntoView({block:"start"}) doesn't account
        // for sticky headers.
        const headerOffset = 80; // 64px header + 16px breathing room
        const elementTop = target.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: elementTop - headerOffset, behavior: "smooth" });
        // Brief highlight so the cook sees which step we landed on
        target.style.transition = "background-color 0.4s ease-out";
        const prev = target.style.backgroundColor;
        target.style.backgroundColor = "rgba(212, 168, 83, 0.18)"; // golden tint
        setTimeout(() => { target.style.backgroundColor = prev; }, 1400);
      }
    };

    window.addEventListener("carl:navigate", onNavigate);
    window.addEventListener("carl:scroll_to", onScrollTo);
    window.addEventListener("carl:scroll_to_step", onScrollToStep);
    return () => {
      window.removeEventListener("carl:navigate", onNavigate);
      window.removeEventListener("carl:scroll_to", onScrollTo);
      window.removeEventListener("carl:scroll_to_step", onScrollToStep);
    };
  }, []);

  // ─── handle timer events from the agent ───────────────────────────────────
  useEffect(() => {
    let nextId = 1;
    const onStart = (e: Event) => {
      // If an on-page StepTimer matched and started itself, it called
      // preventDefault — skip showing a duplicate floating timer in the widget.
      if (e.defaultPrevented) return;
      const detail = (e as CustomEvent).detail as
        | { minutes?: number; label?: string }
        | undefined;
      const minutes = Number(detail?.minutes);
      if (!minutes || minutes <= 0) return;
      const end = Date.now() + minutes * 60 * 1000;
      const label = detail?.label || "timer";
      setTimers((prev) => [...prev, { id: nextId++, label, end }]);
      setExpanded(true); // pop open so the user sees the countdown
    };
    const onCancel = (e: Event) => {
      const detail = (e as CustomEvent).detail as { label?: string | null } | undefined;
      const label = (detail?.label || "").toLowerCase();
      setTimers((prev) => {
        if (!label) return prev.length ? prev.slice(0, -1) : prev; // cancel most recent
        const idx = prev.findIndex((t) => t.label.toLowerCase().includes(label));
        if (idx === -1) return prev;
        return prev.filter((_, i) => i !== idx);
      });
    };
    window.addEventListener("carl:timer_start", onStart);
    window.addEventListener("carl:timer_cancel", onCancel);
    return () => {
      window.removeEventListener("carl:timer_start", onStart);
      window.removeEventListener("carl:timer_cancel", onCancel);
    };
  }, []);

  // ─── auto-expire finished timers ──────────────────────────────────────────
  useEffect(() => {
    if (timers.length === 0) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setTimers((prev) => {
        const alive = prev.filter((t) => t.end > now - 30_000); // keep 30s after done
        return alive.length === prev.length ? prev : alive;
      });
      forceTick((n) => n + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [timers.length]);

  // ─── connect / disconnect ─────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (status !== "idle") return;
    if (!agentUrl) {
      console.error("ChefCarl: PUBLIC_CARL_AGENT_URL not configured");
      setStatus("error");
      return;
    }
    setStatus("connecting");
    setExpanded(true);

    try {
      // 1) Token
      const tokenResp = await fetch(`${agentUrl}/get_token`, {
        headers: AGENT_HEADERS,
      });
      const contentType = tokenResp.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        // Almost always ngrok's browser-warning HTML. Surface a clear error.
        const preview = (await tokenResp.text()).slice(0, 200);
        throw new Error(
          `Agent returned non-JSON (status ${tokenResp.status}). First 200 chars: ${preview}`,
        );
      }
      const tokenData = (await tokenResp.json()) as {
        token?: string;
        address?: string;
        error?: string;
      };
      if (tokenData.error || !tokenData.token || !tokenData.address) {
        throw new Error(tokenData.error || "token request failed");
      }

      // 2) SDK client
      const SW = window.SignalWire;
      if (!SW || !(SW.SignalWire || SW.Fabric)) {
        throw new Error("SignalWire browser SDK not loaded");
      }
      const build = SW.SignalWire ?? SW.Fabric!;
      const client = await build({ token: tokenData.token, logLevel: "warn" });
      clientRef.current = client;

      // 3) Event bridges (tolerate SDK version variance)
      client.on("user_event", handleUserEvent);
      client.on("calling.user_event", handleUserEvent);
      client.on("signalwire.event", (params) => {
        const p = params as { event_type?: string; params?: unknown };
        if (p?.event_type === "user_event") handleUserEvent(p.params ?? params);
      });

      // 4) Dial the Fabric address — seed page context so on_swml_request
      //    can inject the current recipe into the AI's initial system prompt.
      const initialState = readPageState();
      const room = await client.dial({
        to: tokenData.address,
        rootElement: videoContainerRef.current,
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false, // Chef Carl sends video; the user's video is not needed for a cooking assistant
        negotiateVideo: true,
        userVariables: {
          interface: "prompt-pantry-web",
          ts: new Date().toISOString(),
          ...initialState,
        },
      });
      roomRef.current = room;

      // Room-level listeners
      room.on("user_event", handleUserEvent);
      room.on("call.joined", (params: unknown) => {
        const p = params as { call_id?: string };
        if (p?.call_id) callIdRef.current = p.call_id;
        setStatus("connected");
        setCallStart(Date.now());
        // Push initial page state so the agent knows where we are
        void pushPageState();
      });
      room.on("room.left", () => handleDisconnect());
      room.on("destroy", () => handleDisconnect());
      room.on("call.ended", () => handleDisconnect());
      room.on("session.ended", () => handleDisconnect());

      await room.start();
    } catch (err) {
      console.error("Chef Carl connect error:", err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentUrl, handleUserEvent, pushPageState, status]);

  // ─── global wake handler (window.__carlWake) ───────────────────────────
  // MUST live AFTER `connect` is defined so it can be in the dep array. If
  // this lived earlier in the component, putting `connect` in deps would
  // throw a TDZ ReferenceError at render. Including connect here ensures the
  // global handler always points to the *latest* connect — critical because
  // agentUrl resolves asynchronously from /api/chef-carl-config, and an early
  // closure would capture an empty URL forever.
  useEffect(() => {
    window.__carlShow = undismiss;
    window.__carlWake = () => {
      undismiss();
      if (status === "idle") void connect();
    };
    return () => {
      delete window.__carlShow;
      delete window.__carlWake;
    };
  }, [undismiss, status, connect]);

  const handleDisconnect = useCallback(() => {
    setStatus("idle");
    setCallStart(null);
    setMuted(false);
    callIdRef.current = "";

    if (videoContainerRef.current) {
      const videos = videoContainerRef.current.querySelectorAll("video");
      videos.forEach((v) => {
        if (v.srcObject) {
          (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
          v.srcObject = null;
        }
      });
      videoContainerRef.current.innerHTML = "";
    }

    if (roomRef.current) roomRef.current = null;
    if (clientRef.current) {
      try {
        void clientRef.current.disconnect();
      } catch {
        // ignore
      }
      clientRef.current = null;
    }
  }, []);

  const hangup = useCallback(async () => {
    if (roomRef.current) {
      try {
        await roomRef.current.hangup();
      } catch {
        // ignore
      }
    }
    handleDisconnect();
  }, [handleDisconnect]);

  const toggleMute = useCallback(() => {
    const stream = roomRef.current?.localStream;
    if (!stream) return;
    const tracks = stream.getAudioTracks();
    tracks.forEach((t) => (t.enabled = !t.enabled));
    setMuted(tracks.length > 0 ? !tracks[0].enabled : false);
  }, []);

  const dismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem(LS_DISMISSED, "true");
    setDismissed(true);
    setExpanded(false);
    if (roomRef.current) void hangup();
  }, [hangup]);

  // ─── keyboard: Escape collapses expanded widget ────────────────────────────
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && status !== "connected") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, status]);

  // ─── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => handleDisconnect(), [handleDisconnect]);

  if (dismissed) return null;

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  // Collapsed — floating bubble at bottom-left (mirror of RecipeChat's pattern)
  if (!expanded) {
    return (
      <div className="fixed bottom-6 left-6 z-[60] group">
        <button
          onClick={dismiss}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-warm-gray/80 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Dismiss Chef Carl"
        >
          ×
        </button>
        <button
          onClick={() => {
            setExpanded(true);
            if (status === "idle") void connect();
          }}
          className="w-12 h-12 rounded-full bg-sage text-white shadow-lg hover:bg-sage-dark hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
          aria-label="Wake Chef Carl"
          title="Wake Chef Carl"
        >
          {/* Small chef/spoon mark — inline SVG, matches site's icon weight */}
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 3c-1.5 0-2.5 1-2.5 2.5 0 .9.4 1.7 1 2.2-.9.6-1.5 1.6-1.5 2.8 0 1.4.9 2.6 2 3.1V20c0 .6.4 1 1 1s1-.4 1-1v-6.4c1.1-.5 2-1.7 2-3.1 0-1.2-.6-2.2-1.5-2.8.6-.5 1-1.3 1-2.2C10.5 4 9.5 3 8 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 3c-1.1 0-2 .9-2 2v6h4V5c0-1.1-.9-2-2-2zM14 11h4v9a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-9z" />
          </svg>
        </button>
      </div>
    );
  }

  // Expanded — warm card with video + controls
  return (
    <div className="fixed bottom-6 left-6 z-[60] w-[320px] max-w-[calc(100vw-2rem)] bg-warm-white rounded-2xl shadow-2xl border border-warm-gray/15 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-warm-gray/10 bg-cream/50">
        <div className="flex items-center gap-2">
          <span
            className={
              "w-2 h-2 rounded-full " +
              (status === "connected"
                ? "bg-sage animate-pulse"
                : status === "connecting"
                ? "bg-golden animate-pulse"
                : status === "error"
                ? "bg-terracotta"
                : "bg-warm-gray/50")
            }
            aria-hidden
          />
          <span className="font-display text-base text-charcoal leading-none">
            Chef Carl
          </span>
          {status === "connected" && durationLabel && (
            <span className="text-xs text-muted tabular-nums ml-1">{durationLabel}</span>
          )}
        </div>
        <button
          onClick={() => {
            if (status === "connected") void hangup();
            setExpanded(false);
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-charcoal hover:bg-cream transition-colors"
          aria-label="Minimize Chef Carl"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Video / stage */}
      <div
        ref={videoContainerRef}
        className="relative w-full aspect-video bg-charcoal overflow-hidden"
      >
        {/* Placeholder layer — stays visible until a <video> is injected by the SDK */}
        {status !== "connected" && (
          <div className="absolute inset-0 flex items-center justify-center">
            {status === "connecting" && (
              <div className="text-center text-cream/80">
                <div className="flex justify-center gap-1 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cream/60 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-cream/60 animate-bounce [animation-delay:0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-cream/60 animate-bounce [animation-delay:0.3s]" />
                </div>
                <div className="text-xs">Waking up…</div>
              </div>
            )}
            {status === "error" && (
              <div className="text-center text-cream/80 px-4">
                <div className="text-sm mb-1">Couldn't reach Chef Carl</div>
                <div className="text-xs text-cream/60">
                  Check the agent is running and reachable.
                </div>
              </div>
            )}
            {status === "idle" && (
              <div className="text-center text-cream/80 text-xs">Standing by</div>
            )}
          </div>
        )}
      </div>

      {/* Timers strip (agent-driven only) */}
      {timers.length > 0 && (
        <ul className="px-4 py-2 border-t border-warm-gray/10 bg-golden-light/40 space-y-1">
          {timers.map((t) => {
            const remaining = Math.max(0, t.end - Date.now());
            const s = Math.ceil(remaining / 1000);
            const m = Math.floor(s / 60);
            const ss = (s % 60).toString().padStart(2, "0");
            const done = remaining <= 0;
            return (
              <li key={t.id} className="flex items-center justify-between text-xs">
                <span className={done ? "text-sage-dark font-medium" : "text-charcoal"}>
                  {t.label}
                </span>
                <span className="tabular-nums text-warm-gray">
                  {done ? "done" : `${m}:${ss}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer controls */}
      <div className="flex items-center justify-between px-4 py-3 bg-warm-white border-t border-warm-gray/10">
        {status === "connected" ? (
          <>
            <button
              onClick={toggleMute}
              className={
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors " +
                (muted
                  ? "bg-warm-gray/15 text-warm-gray"
                  : "bg-sage-light/60 text-sage-dark hover:bg-sage-light")
              }
              aria-pressed={muted}
              title={muted ? "Unmute" : "Mute"}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {muted ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M19.07 4.93a10 10 0 010 14.14M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                )}
              </svg>
              {muted ? "Muted" : "Mute"}
            </button>
            <button
              onClick={hangup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-terracotta text-white text-xs font-medium hover:bg-terracotta-dark transition-colors"
              title="End call"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l-4-4-4 4m8 8l-4 4-4-4" transform="rotate(135 12 12)" />
              </svg>
              End
            </button>
          </>
        ) : status === "connecting" ? (
          <div className="text-xs text-muted w-full text-center">Connecting…</div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted">
              Tap wake to talk with Chef Carl
            </span>
            <button
              onClick={() => void connect()}
              disabled={status === "error"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sage text-white text-xs font-medium hover:bg-sage-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              Wake Chef Carl
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
