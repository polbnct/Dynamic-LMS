import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { enrollmentId } = await params;
    if (!enrollmentId) return jsonError("enrollmentId is required", 400);

    const { error } = await admin.from("enrollments").delete().eq("id", enrollmentId);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

