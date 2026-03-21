import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase().replace(/\s+/g, "");
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : undefined;
    const emailRaw = typeof body?.email === "string" ? body.email : undefined;
    const email = emailRaw ? normalizeEmail(emailRaw) : undefined;

    if (!name && !email) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const admin = createAdminClient();

    // Update Auth email without triggering email-change confirmation.
    // Using the Admin API avoids the self-service confirm-email-change flow.
    if (email && email !== user.email) {
      const { error: authUpdateErr } = await admin.auth.admin.updateUserById(user.id, {
        email,
        email_confirm: true,
      } as any);
      if (authUpdateErr) {
        return NextResponse.json({ error: authUpdateErr.message }, { status: 400 });
      }
    }

    // Keep public.users in sync.
    const userUpdates: Record<string, any> = {};
    if (name) userUpdates.name = name;
    if (email) userUpdates.email = email;

    if (Object.keys(userUpdates).length > 0) {
      const { error: dbErr } = await admin.from("users").update(userUpdates).eq("id", user.id);
      if (dbErr) {
        return NextResponse.json({ error: dbErr.message }, { status: 400 });
      }
    }

    // Also keep auth metadata name updated (best-effort).
    if (name) {
      await admin.auth.admin
        .updateUserById(user.id, { user_metadata: { ...(user.user_metadata || {}), name } } as any)
        .catch(() => {});
    }

    return NextResponse.json({ success: true, name, email }, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /api/profile failed:", err);
    return NextResponse.json({ error: err?.message || "Failed to update profile." }, { status: 500 });
  }
}

