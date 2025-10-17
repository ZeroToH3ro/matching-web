import { auth } from "@/auth";
import { getMemberPhotosByUserId } from "@/app/actions/memberActions";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const photos = await getMemberPhotosByUserId(session.user.id);

    return NextResponse.json(photos || []);
  } catch (error) {
    console.error("Error fetching photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch photos" },
      { status: 500 }
    );
  }
}
