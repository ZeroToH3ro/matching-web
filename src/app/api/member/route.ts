import { auth } from "@/auth";
import { getMemberByUserId } from "@/app/actions/memberActions";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const member = await getMemberByUserId(session.user.id);

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error fetching member:", error);
    return NextResponse.json(
      { error: "Failed to fetch member data" },
      { status: 500 }
    );
  }
}
