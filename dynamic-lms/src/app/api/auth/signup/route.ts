import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

export async function POST(request: NextRequest) {
  try {
    console.log("Signup API called");
    const body = await request.json();
    console.log("Request body received:", { email: body.email, name: body.name, role: body.role, hasPassword: !!body.password });
    const { email, password, name, role } = body;

    if (!email || !password || !name || !role) {
      console.error("Missing required fields:", { email: !!email, password: !!password, name: !!name, role: !!role });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (error) {
              // Handle cookie setting error
            }
          },
        },
      }
    );

    // Sign up with Supabase Auth
    // Note: In Supabase Dashboard → Authentication → Providers → Email,
    // turn OFF "Confirm email" so new users are not required to confirm and no confirmation email is sent.
    console.log("Attempting Supabase auth signup...");
    const userRole = role === "prof" ? "professor" : "student";
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
          role: userRole,
        },
      },
    });

    console.log("Auth signup result:", { 
      hasUser: !!authData?.user, 
      hasSession: !!authData?.session, 
      hasError: !!authError,
      errorMessage: authError?.message 
    });

    if (authError) {
      console.error("=== AUTH SIGNUP FAILED ===");
      console.error("Auth error:", authError);
      console.error("Error code:", authError.code);
      console.error("Error status:", authError.status);
      console.error("Error message:", authError.message);
      console.error("Full error:", JSON.stringify(authError, null, 2));
      
      // Check if it's the trigger/database error
      if (authError.message?.includes("Database error") || authError.code === "unexpected_failure") {
        return NextResponse.json(
          { 
            error: "Database trigger is failing. Please run src/FIX_TRIGGER_NOW.sql in Supabase SQL Editor to fix the trigger, then try again.",
            code: authError.code,
            status: authError.status,
            originalError: authError.message,
          },
          { status: 500 }
        );
      }
      
      // Provide user-friendly error messages
      let errorMessage = authError.message || "Failed to create account";
      if (authError.message?.includes("already registered") || authError.message?.includes("already exists")) {
        errorMessage = "An account with this email already exists. Please try logging in instead.";
      } else if (authError.message?.includes("password")) {
        errorMessage = "Password does not meet requirements. Please use a stronger password.";
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          code: authError.status,
          originalError: authError.message,
        },
        { status: 400 }
      );
    }

    // If user is null but we have no error, something went wrong
    if (!authData.user) {
      console.error("Auth signup succeeded but no user returned");
      return NextResponse.json(
        { 
          error: "Account creation failed. Please try again.",
        },
        { status: 500 }
      );
    }

    // Create user record manually (trigger is disabled to avoid blocking signup)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error: "SUPABASE_SERVICE_ROLE_KEY is required. Please add it to your environment variables.",
        },
        { status: 500 }
      );
    }

    const adminClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Silently confirm email in background (no user interaction needed)
    adminClient.auth.admin.updateUserById(authData.user.id, {
      email_confirm: true,
    }).catch(() => {
      // Ignore errors - email might already be confirmed or confirmation disabled
    });

    // Wait for auth user to be fully committed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if user record already exists
    const { data: existingUser } = await adminClient
      .from("users")
      .select("id")
      .eq("id", authData.user.id)
      .maybeSingle();
    
    // Create user record if it doesn't exist
    if (!existingUser) {
      const { error: userError } = await adminClient
        .from("users")
        .insert({
          id: authData.user.id,
          email: email,
          name: name,
          role: userRole as "professor" | "student",
        });
      
      if (userError && userError.code !== "23505") {
        return NextResponse.json(
          {
            error: `Failed to create user record: ${userError.message}`,
            code: userError.code,
            details: userError.details,
          },
          { status: 500 }
        );
      }
    }

    // Create role-specific record using admin client
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const adminClient = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      if (userRole === "professor") {
        console.log("Creating professor record for:", authData.user.id);
        const { data: profData, error: profError } = await adminClient
          .from("professors")
          .insert({
            user_id: authData.user.id,
          })
          .select();

        if (profError) {
          console.error("Error creating professor record:", profError);
          return NextResponse.json(
            {
              error: profError.message || "Failed to create professor profile",
              details: profError.details,
              code: profError.code,
            },
            { status: 500 }
          );
        }
        console.log("Professor record created successfully");
      } else {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0");
        const studentId = `STU${year}${random}`;

        console.log("Creating student record for:", authData.user.id, "with student_id:", studentId);
        const { data: studentData, error: studentError } = await adminClient
          .from("students")
          .insert({
            user_id: authData.user.id,
            student_id: studentId,
          })
          .select();

        if (studentError) {
          console.error("Error creating student record:", studentError);
          return NextResponse.json(
            {
              error: studentError.message || "Failed to create student profile",
              details: studentError.details,
              code: studentError.code,
            },
            { status: 500 }
          );
        }
        console.log("Student record created successfully");
      }
    } else {
      // Fallback: use regular client
      if (userRole === "professor") {
        const { error: profError } = await supabase.from("professors").insert({
          user_id: authData.user.id,
        });
        if (profError) {
          return NextResponse.json(
            {
              error: profError.message || "Failed to create professor profile",
              code: profError.code,
            },
            { status: 500 }
          );
        }
      } else {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0");
        const studentId = `STU${year}${random}`;
        const { error: studentError } = await supabase.from("students").insert({
          user_id: authData.user.id,
          student_id: studentId,
        });
        if (studentError) {
          return NextResponse.json(
            {
              error: studentError.message || "Failed to create student profile",
              code: studentError.code,
            },
            { status: 500 }
          );
        }
      }
    }

    // Check if we already have a session from signup
    if (authData.session) {
      return NextResponse.json({
        success: true,
        user: authData.user,
        role: userRole,
        session: authData.session,
      });
    }

    // Sign in to get a session (email is now confirmed)
    console.log("Signing in to get session...");
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (signInError) {
      console.error("Auto-signin error:", signInError);
      return NextResponse.json(
        {
          error: "Account created but failed to sign in automatically",
          details: signInError.message,
          code: signInError.code,
        },
        { status: 500 }
      );
    }
    
    if (signInData.session) {
      console.log("Auto-signin successful!");
      return NextResponse.json({
        success: true,
        user: signInData.user,
        role: userRole,
        session: signInData.session,
      });
    }
    
    // Fallback
    return NextResponse.json({
      success: true,
      user: authData.user,
      role: userRole,
      session: null,
    });
  } catch (error: any) {
    console.error("=== SIGNUP API CATCH BLOCK ===");
    console.error("Error type:", typeof error);
    console.error("Error name:", error?.name);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    
    // Safely serialize error
    let errorDetails: any = {};
    try {
      if (error && typeof error === 'object') {
        errorDetails = {
          name: error.name,
          message: error.message,
          code: error.code,
          status: error.status,
          statusCode: error.statusCode,
        };
      }
    } catch (serializeError) {
      console.error("Failed to serialize error:", serializeError);
    }
    
    console.error("Error details object:", errorDetails);
    
    const errorMessage = error?.message || error?.toString() || "An unexpected error occurred";
    console.error("Returning error response with message:", errorMessage);
    
    return NextResponse.json(
      { 
        error: errorMessage,
        type: error?.name || "UnknownError",
        ...errorDetails,
      },
      { status: 500 }
    );
  }
}


