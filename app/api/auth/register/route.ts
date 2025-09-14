import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signUpSchema } from "@/lib/validations";
import type { AuthResponse } from "@/types/auth";

export async function POST(request: NextRequest): Promise<NextResponse<AuthResponse>> {
  try {
    const body = await request.json();

    // Validate input
    const validation = signUpSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: firstError?.message || "Invalid input"
        },
        { status: 400 }
      );
    }

    const { email, password, name } = validation.data;

    // TODO: Check if user already exists
    // const existingUser = await getUserByEmail(email);
    // if (existingUser) {
    //   return NextResponse.json(
    //     { success: false, error: "User already exists" },
    //     { status: 409 }
    //   );
    // }

    // Hash the password for future database storage
    const hashedPassword = await bcrypt.hash(password, 12);

    // TODO: Save to database
    // const user = await createUser({
    //   email,
    //   name,
    //   password: hashedPassword,
    // });

    // Temporary implementation - remove hashedPassword from logging for security
    console.log("🔐 Creating user:", { email, name });
    console.log("Password hashed successfully");

    const user = {
      id: Date.now().toString(),
      email,
      name,
    };

    return NextResponse.json(
      {
        success: true,
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
