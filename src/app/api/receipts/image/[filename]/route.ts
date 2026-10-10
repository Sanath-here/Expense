import { auth } from "@/auth";
import { db } from "@/db";
import { media as mediaTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const contentTypes: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
};

export async function GET(
  _request: Request,
  { params }: { params: { filename: string } }
) {
  const session = await auth();
  if (!session) {
    return new Response("Not authenticated", { status: 401 });
  }

  const { filename } = params;
  const extension = filename.split(".").at(-1) ?? "";
  if (!/^[\da-f-]{36}\.(jpg|png)$/.test(filename)) {
    return new Response("Not found", { status: 404 });
  }

  const url = `/api/receipts/image/${filename}`;
  const media = await db
    .select({ id: mediaTable.id })
    .from(mediaTable)
    .where(and(eq(mediaTable.url, url), eq(mediaTable.userId, session.user.id)))
    .then((rows) => rows[0]);
  if (!media) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const filePath = path.join(process.cwd(), "data", "receipts", filename);
    const file = await readFile(filePath);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": contentTypes[extension],
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}