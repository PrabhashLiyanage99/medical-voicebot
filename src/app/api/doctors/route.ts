import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const doctors = await prisma.doctor.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(doctors);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Unable to load doctors" },
      { status: 500 }
    );
  }
}