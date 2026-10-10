import { auth } from "@/auth";
import { db } from "@/db";
import { media as mediaTable } from "@/db/schema";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const fileExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
};
const maxFileSize = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ failure: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ failure: "No image uploaded" }, { status: 400 });
  }
  if (!fileExtensions[file.type]) {
    return NextResponse.json({ failure: "File type not allowed" }, { status: 400 });
  }
  if (file.size > maxFileSize) {
    return NextResponse.json({ failure: "File size too large" }, { status: 400 });
  }

  const filename = `${randomUUID()}.${fileExtensions[file.type]}`;
  const directory = path.join(process.cwd(), "data", "receipts");
  const filePath = path.join(directory, filename);
  const url = `/api/receipts/image/${filename}`;

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()), { flag: "wx" });
    const [media] = await db
      .insert(mediaTable)
      .values({ url, width: 0, height: 0, userId: session.user.id })
      .returning({ id: mediaTable.id });

    return NextResponse.json({ success: { fileId: media.id } });
  } catch (error) {
    await rm(filePath, { force: true });
    console.error("Local receipt upload failed:", error);
    return NextResponse.json(
      { failure: "Could not save receipt image locally" },
      { status: 500 }
    );
  }
}