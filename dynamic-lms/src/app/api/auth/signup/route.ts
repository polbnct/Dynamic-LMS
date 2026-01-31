import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
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
        // Email confirmation is disabled in Supabase settings
        // Users are automatically confirmed and can log in immediately
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
            error: "Database trigger is failing. The trigger that creates user records is blocking signup.",
            code: authError.code,
            status: authError.status,
            fix: "Run FIX_TRIGGER_NOW.sql in Supabase SQL Editor to fix the trigger",
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
      } else if (authError.message?.includes("email")) {
        errorMessage = "Invalid email address. Please check your email and try again.";
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

    // Wait a moment for the trigger to potentially create the user record
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Try to create user record - use RPC function first, fallback to direct insert
    console.log("=== CREATING USER RECORD ===");
    console.log("User ID:", authData.user.id);
    console.log("Email:", email);
    console.log("Name:", name);
    console.log("Role:", userRole);
    
    let userCreated = false;
    
    // Method 1: Try RPC function
    try {
      console.log("Attempting RPC function create_user_profile...");
      const { data: functionResult, error: functionError } = await supabase.rpc(
        'create_user_profile',
        {
          p_user_id: authData.user.id,
          p_email: email,
          p_name: name,
          p_role: userRole,
        }
      );
      
      if (functionError) {
        console.error("RPC function error:", functionError);
        console.error("RPC error code:", functionError.code);
        console.error("RPC error message:", functionError.message);
        console.error("RPC error hint:", functionError.hint);
        throw functionError; // Will be caught by fallback
      }
      
      console.log("RPC function succeeded!");
      userCreated = true;
    } catch (rpcError: any) {
      console.log("RPC function failed, trying direct insert...");
      
      // Method 2: Direct insert (will fail if RLS blocks it)
      const { data: userData, error: userError } = await supabase
        .from("users")
        .insert({
          id: authData.user.id,
          email: email,
          name: name,
          role: userRole as "professor" | "student",
        })
        .select()
        .single();
      
      if (userError) {
        // Check if it's a duplicate (trigger might have created it)
        if (userError.code === "23505" || userError.message?.includes("duplicate") || userError.message?.includes("unique")) {
          console.log("User already exists (likely from trigger), updating...");
          
          // Try to update instead
          const { error: updateError } = await supabase
            .from("users")
            .update({ email, name, role: userRole as "professor" | "student" })
            .eq("id", authData.user.id);
          
          if (updateError) {
            console.error("Update also failed:", updateError);
            return NextResponse.json(
              {
                error: `Failed to create user: ${updateError.message || updateError.hint || "Unknown error"}`,
                code: updateError.code,
                hint: updateError.hint,
                details: `Code: ${updateError.code}, Hint: ${updateError.hint || "None"}`,
              },
              { status: 500 }
            );
          }
          
          userCreated = true;
        } else {
          console.error("=== DIRECT INSERT FAILED ===");
          console.error("Full error object:", userError);
          console.error("Error code:", userError?.code);
          console.error("Error message:", userError?.message);
          console.error("Error hint:", userError?.hint);
          console.error("Error details:", userError?.details);
          
          // Get ALL error properties
          const allErrorProps = Object.getOwnPropertyNames(userError);
          console.error("All error properties:", allErrorProps);
          allErrorProps.forEach(prop => {
            console.error(`  ${prop}:`, (userError as any)[prop]);
          });
          
          return NextResponse.json(
            {
              error: `RLS BLOCKING: ${userError?.message || userError?.hint || "Unknown database error"}`,
              errorCode: userError?.code || "NO_CODE",
              errorHint: userError?.hint || "NO_HINT",
              errorMessage: userError?.message || "NO_MESSAGE",
              errorDetails: userError?.details || "NO_DETAILS",
              fix: "Run: ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;",
              fullError: JSON.stringify(userError, null, 2)
            },
            { status: 500 }
          );
        }
      } else {
        console.log("Direct insert succeeded!");
        userCreated = true;
      }
    }
    
    if (!userCreated) {
      return NextResponse.json(
        {
          error: "Failed to create user record after all attempts",
          details: "Please check server logs for more information",
        },
        { status: 500 }
      );
    }

    // Create role-specific record
    if (userRole === "professor") {
      console.log("Creating professor record for:", authData.user.id);
      const { data: profData, error: profError } = await supabase.from("professors").insert({
        user_id: authData.user.id,
      }).select();

      console.log("Professor record result:", { hasData: !!profData, hasError: !!profError });

      if (profError) {
        console.error("Error creating professor record:", profError);
        console.error("Professor error details:", JSON.stringify(profError, null, 2));
        return NextResponse.json(
          {
            error: profError.message || "Failed to create professor profile",
            details: profError.details,
            code: profError.code,
            hint: profError.hint,
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

      console.log("Creating student record for:", authData.user.id, "with student_id:", studentId);
      const { data: studentData, error: studentError } = await supabase.from("students").insert({
        user_id: authData.user.id,
        student_id: studentId,
      }).select();

      console.log("Student record result:", { hasData: !!studentData, hasError: !!studentError });

      if (studentError) {
        console.error("Error creating student record:", studentError);
        console.error("Student error details:", JSON.stringify(studentError, null, 2));
        return NextResponse.json(
          {
            error: studentError.message || "Failed to create student profile",
            details: studentError.details,
            code: studentError.code,
            hint: studentError.hint,
          },
          { status: 500 }
        );
      }
    }

    // If we have a session, return it. Otherwise, we'll need to sign in separately
    // But with email confirmation disabled, we should always have a session
    if (!authData.session && authData.user) {
      // Try to sign in immediately to get a session
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInData.session) {
        return NextResponse.json({
          success: true,
          user: authData.user,
          role: userRole,
          session: signInData.session,
        });
      }
    }

    return NextResponse.json({
      success: true,
      user: authData.user,
      role: userRole,
      session: authData.session,
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

