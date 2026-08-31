"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export function GoogleSignIn({ clientId }: { clientId: string }) {
  const router = useRouter();
  const slot = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onCredential = useCallback(
    async ({ credential }: { credential: string }) => {
      setError(null);
      setBusy(true);
      try {
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ credential }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || `Sign-in failed (${res.status})`);
          return;
        }
        router.refresh(); // the page re-renders into the access-code step
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  // Google's script may already be loaded (a router.refresh does not re-run onReady).
  const render = useCallback(() => {
    if (!window.google || !slot.current || slot.current.childElementCount > 0) return;
    window.google.accounts.id.initialize({ client_id: clientId, callback: onCredential });
    window.google.accounts.id.renderButton(slot.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: 280,
    });
  }, [clientId, onCredential]);

  useEffect(render, [render]);

  return (
    <div>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={render} />
      <div ref={slot} className="flex min-h-[44px] justify-center" />
      {busy ? <p className="mt-2 text-center text-[13px] opacity-50">Checking…</p> : null}
      {error ? (
        <p role="alert" className="mt-2 text-center text-[13px] text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
