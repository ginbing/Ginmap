import { cookies } from "next/headers";
import { verifySessionToken } from "@ginmap/config";
import { getUserById, type UserRow } from "@ginmap/db";

export const SESSION_COOKIE = "ginmap_session";
export const OAUTH_STATE_COOKIE = "ginmap_oauth_state";

export async function currentUser(): Promise<UserRow | null> {
  const store = await cookies();
  const userId = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  return getUserById(userId);
}
