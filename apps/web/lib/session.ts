import { cookies } from "next/headers";
import { verifySessionToken } from "@ginmap/config";
import { getUserById, type UserRow } from "@ginmap/db";

export const SESSION_COOKIE = "ginmap_session";
export const OAUTH_STATE_COOKIE = "ginmap_oauth_state";
export const CLAIM_LOGIN_COOKIE = "ginmap_claim_login";

export async function currentUser(): Promise<UserRow | null> {
  const store = await cookies();
  const session = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || user.session_version !== session.version) return null;
  return user;
}
