"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { receipts as receiptsTable } from "@/db/schema";
import { media as mediaTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { rm } from "node:fs/promises";
import path from "node:path";

export type UpdateReceiptParams = {
  receiptId: number;
  receiptDate: string;
  receiptCategory: string;
  receiptTotal: string;
};

type UpdateReceiptResult =
  | { success: { receipt: { id: number } } }
  | { failure: string };

export const updateReceipt = async ({
  receiptId,
  receiptDate,
  receiptCategory,
  receiptTotal,
}: UpdateReceiptParams): Promise<UpdateReceiptResult> => {
  try {
    // check if user is authenticated
    const session = await auth();
    if (!session) {
      return { failure: "not authenticated" };
    }
    // get the user id
    const userId = session.user.id;

    // update the receipt in the database
    const updatedReceipt = await db
      .update(receiptsTable)
      .set({
        receiptCategory,
        receiptDate,
        receiptTotal,
      })
      .where(
        and(eq(receiptsTable.id, receiptId), eq(receiptsTable.userId, userId))
      )
      .returning();

    revalidatePath("/expenses");
    return { success: { receipt: updatedReceipt[0] } };
  } catch (e) {
    return { failure: "receipt not updated" };
  }
};

export const deleteReceipt = async (receiptId: number) => {
  try {
    const session = await auth();
    if (!session) return;

    const deleteMedia = await db
      .delete(mediaTable)
      .where(
        and(
          eq(mediaTable.receiptId, receiptId),
          eq(mediaTable.userId, session.user.id)
        )
      )
      .returning()
      .then((res) => res[0]);

    await db
      .delete(receiptsTable)
      .where(
        and(
          eq(receiptsTable.id, receiptId),
          eq(receiptsTable.userId, session.user.id)
        )
      )
      .returning();

    const localImage = deleteMedia?.url.match(
      /^\/api\/receipts\/image\/([\da-f-]{36}\.(?:jpg|png))$/
    );
    if (localImage) {
      await rm(
        path.join(process.cwd(), "data", "receipts", localImage[1]),
        { force: true }
      );
    }
    revalidatePath("/expenses");
  } catch (e) {
    console.error(e);
  }
};
