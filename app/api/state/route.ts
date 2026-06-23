import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { gameStates } from "@/lib/db/schema";
import { sanitize } from "@/lib/state";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response(null, { status: 401 });

  const rows = await db
    .select({ data: gameStates.data })
    .from(gameStates)
    .where(eq(gameStates.userId, userId))
    .limit(1);

  return Response.json(rows[0]?.data ?? null);
}

export async function PUT(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response(null, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const clean = sanitize(body);
  if (!clean) return new Response(null, { status: 400 });

  await db
    .insert(gameStates)
    .values({ userId, data: clean })
    .onConflictDoUpdate({
      target: gameStates.userId,
      set: { data: clean, updatedAt: new Date() },
    });

  return Response.json({ ok: true });
}
