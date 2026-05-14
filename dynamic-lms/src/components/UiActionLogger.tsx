"use client";

import { useEffect, useRef } from "react";
import { logUserAction } from "@/services/errorLogger";

const CLICK_THROTTLE_MS = 250;

function closestInteractive(el: Element | null): HTMLElement | null {
  if (!el || !(el instanceof HTMLElement)) return null;
  const hit = el.closest(
    "button, a[href], [role='button'], [role='tab'], input[type='submit'], input[type='button'], input[type='checkbox'], input[type='radio'], select, textarea, [data-log-click]"
  );
  return hit instanceof HTMLElement ? hit : null;
}

function redactText(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * Logs meaningful UI interactions (clicks on controls, form submits).
 * Ignores password fields and subtrees marked `data-no-action-log`.
 */
export function UiActionLogger() {
  const lastClickAt = useRef(0);

  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const raw = ev.target;
      if (!(raw instanceof Node)) return;
      const target = raw instanceof Element ? raw : null;
      const interactive = closestInteractive(target);
      if (!interactive) return;
      if (interactive.closest("[data-no-action-log]")) return;
      if (interactive instanceof HTMLInputElement && interactive.type === "password") return;

      const now = Date.now();
      if (now - lastClickAt.current < CLICK_THROTTLE_MS) return;
      lastClickAt.current = now;

      const tag = interactive.tagName.toLowerCase();
      const id = interactive.id || undefined;
      const name = (interactive as HTMLInputElement).name || undefined;
      const custom = interactive.getAttribute("data-log-click") || undefined;

      let detail: Record<string, unknown> = { tag, id, name, custom };

      if (interactive instanceof HTMLAnchorElement && interactive.href) {
        detail = {
          ...detail,
          kind: "link",
          href: redactText(interactive.href, 400),
          text: redactText(interactive.textContent || "", 120),
        };
      } else if (interactive instanceof HTMLInputElement || interactive instanceof HTMLSelectElement) {
        detail = {
          ...detail,
          kind: "input",
          inputType: interactive.type,
          label: redactText(
            interactive.getAttribute("aria-label") ||
              interactive.closest("label")?.textContent ||
              "",
            120
          ),
        };
      } else {
        detail = {
          ...detail,
          kind: "control",
          text: redactText(interactive.textContent || "", 120),
        };
      }

      logUserAction("UI_CLICK", {
        summary: `Click: ${tag}${id ? `#${id}` : ""}`,
        ...detail,
      });
    };

    const onSubmit = (ev: Event) => {
      const form = ev.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.closest("[data-no-action-log]")) return;

      const id = form.id || form.getAttribute("name") || undefined;
      const action = form.action ? redactText(form.action, 400) : undefined;
      logUserAction("FORM_SUBMIT", {
        summary: `Submit: ${id || "form"}`,
        formId: id,
        action,
        method: (form.method || "get").toUpperCase(),
      });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return null;
}
