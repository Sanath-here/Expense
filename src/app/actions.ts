"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { media as mediaTable, receipts as receiptsTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type AddReceiptParams = {
  fileId: number;
  receiptDate: string;
  receiptCategory: string;
  receiptTotal: string;
};

export const addReceipt = async ({
  fileId,
  receiptDate,
  receiptCategory,
  receiptTotal,
}: AddReceiptParams): Promise<{ failure: string } | undefined> => {
  // check if user is authenticated
  const session = await auth();
  if (!session) {
    return { failure: "Not authenticated" };
  }
  // get the user id
  const userId = session.user.id;
  // get the file from the database
  if (fileId) {
    const file = await db
      .select({
        id: mediaTable.id,
      })
      .from(mediaTable)
      .where(and(eq(mediaTable.id, fileId), eq(mediaTable.userId, userId)))
      .then((rows) => rows[0]);

    if (!file) {
      return { failure: "Receipt image not found" };
    }
  }

  // add the receipt to the database
  const addedReceipt = await db
    .insert(receiptsTable)
    .values({
      userId,
      receiptCategory,
      receiptDate,
      receiptTotal,
    })
    .returning();

  if (fileId) {
    // update the file to reference the receipt
    await db
      .update(mediaTable)
      .set({ receiptId: addedReceipt[0].id })
      .where(eq(mediaTable.id, fileId));
  }
  revalidatePath("/expenses");
  redirect("/expenses");
};
