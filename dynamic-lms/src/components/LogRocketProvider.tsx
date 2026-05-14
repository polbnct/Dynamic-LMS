"use client";

import { useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

function resolveAppId(): string | null {
  const raw = process.env.NEXT_PUBLIC_LOGROCKET_APP_ID;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  const id = trimmed || "i7dzok/lms";
  return id.length > 0 ? id : null;
}

/** Set true before async import so React Strict Mode's double effect does not skip init. */
let logRocketStartClaimed = false;

let lastIdentifiedUserId: string | null = null;

type LogRocketClient = {
  init: (appId: string) => void;
  identify: (uid: string, traits: Record<string, unknown>) => void;
};

async function identifyLogRocketUser(
  LogRocket: LogRocketClient,
  supabase: ReturnType<typeof createClient>,
  session: Session
): Promise<void> {
  const user = session.user;
  if (!user?.id) return;

  const { data: row } = await supabase
    .from("users")
    .select("id, email, name, role")
    .eq("id", user.id)
    .maybeSingle();

  const email = row?.email ?? user.email ?? "";
  const name =
    row?.name ??
    (typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "");
  const role = row?.role ?? "";
  const internalId = row?.id ?? user.id;

  LogRocket.identify(internalId, {
    email,
    name,
    role,
  });
}

function shouldRunIdentify(event: string): boolean {
  return event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED";
}

export function LogRocketProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const appId = resolveAppId();
    if (!appId) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[LogRocket] Missing NEXT_PUBLIC_LOGROCKET_APP_ID; skipping init.");
      }
      return;
    }

    if (logRocketStartClaimed) return;
    logRocketStartClaimed = true;

    let cancelled = false;
    let authSubscription: { unsubscribe: () => void } | null = null;

    void import("logrocket")
      .then((m) => {
        if (cancelled) return;
        const LogRocket = m.default as LogRocketClient;
        LogRocket.init(appId);
        if (process.env.NODE_ENV === "development") {
          console.info("[LogRocket] init:", appId);
        }

        const supabase = createClient();
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_OUT") {
            lastIdentifiedUserId = null;
            return;
          }

          if (event === "TOKEN_REFRESHED") {
            return;
          }

          if (!shouldRunIdentify(event)) return;

          if (!session?.user) return;

          if (session.user.id === lastIdentifiedUserId && event !== "USER_UPDATED") {
            return;
          }

          void identifyLogRocketUser(LogRocket, supabase, session).then(() => {
            lastIdentifiedUserId = session.user.id;
          });
        });

        authSubscription = data.subscription;
        if (cancelled) {
          authSubscription.unsubscribe();
          authSubscription = null;
        }
      })
      .catch((err) => {
        console.warn("[LogRocket] failed to load or init:", err);
        logRocketStartClaimed = false;
      });

    return () => {
      cancelled = true;
      authSubscription?.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
