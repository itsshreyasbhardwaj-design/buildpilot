"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/current-session";

/**
 * Recommendations are diffs, never auto-applied — this only flips a status
 * flag and records who decided. Actually writing the diff to the repository
 * is out of scope for this build (no GitHub App write access configured);
 * see docs/CI_OPTIMIZER.md.
 */
export async function decideRecommendation(id: string, decision: "approved" | "rejected") {
  const session = await requireSession();
  const recommendation = await db.recommendation.findFirst({
    where: { id, repository: { organizationId: session.organizationId } },
  });
  if (!recommendation) throw new Error("Recommendation not found");

  await db.recommendation.update({
    where: { id },
    data: { status: decision, decidedAt: new Date(), decidedBy: session.userId },
  });

  await db.auditLog.create({
    data: {
      organizationId: session.organizationId,
      userId: session.userId,
      action: `recommendation.${decision}`,
      targetType: "Recommendation",
      targetId: id,
    },
  });

  revalidatePath("/recommendations");
}
