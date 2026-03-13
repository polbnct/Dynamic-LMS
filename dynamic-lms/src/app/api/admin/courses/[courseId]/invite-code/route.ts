import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function generateInviteCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 3; i++) code += letters[Math.floor(Math.random() * letters.length)];
  code += String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return code;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { courseId } = await params;
    if (!courseId) return jsonError("courseId is required", 400);

    const newCode = generateInviteCode();
    const { data, error } = await admin
      .from("courses")
      .update({ classroom_code: newCode })
      .eq("id", courseId)
      .select("classroom_code")
      .single();

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ classroom_code: data?.classroom_code ?? newCode }, { status: 200 });
  } catch (e: any) {
    return jsonError(e?.message || "Unauthorized", e?.message === "Not authenticated" ? 401 : 403);
  }
}

