import { NextRequest, NextResponse } from "next/server";
import { getProfileSettings, getSnapshot, saveProfileSettings } from "@ginmap/db";
import { currentUser } from "../../../../lib/session";
import { requireSameOrigin } from "../../../../lib/security";

export async function POST(request: NextRequest) {
  requireSameOrigin(request);
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url), 303);
  const form = await request.formData();
  const repositoryId = String(form.get("repositoryId") ?? "");
  const action = String(form.get("action") ?? "");
  if (!/^\d+$/.test(repositoryId)) return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  const snapshot = await getSnapshot(user.id);
  if (!snapshot?.repositories.some((repository) => repository.repositoryId === repositoryId)) {
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  }
  const settings = await getProfileSettings(user.id);
  const hidden = new Set(settings.hiddenRepositoryIds);
  const pinned = [...settings.pinnedRepositoryIds];
  if (action === "hide") hidden.add(repositoryId);
  if (action === "show") hidden.delete(repositoryId);
  if (action === "pin" && !pinned.includes(repositoryId)) pinned.push(repositoryId);
  if (action === "unpin") {
    const pinnedIndex = pinned.indexOf(repositoryId);
    if (pinnedIndex >= 0) pinned.splice(pinnedIndex, 1);
  }
  const index = pinned.indexOf(repositoryId);
  if (action === "up" && index > 0) [pinned[index - 1], pinned[index]] = [pinned[index]!, pinned[index - 1]!];
  if (action === "down" && index >= 0 && index < pinned.length - 1) [pinned[index], pinned[index + 1]] = [pinned[index + 1]!, pinned[index]!];
  settings.hiddenRepositoryIds = [...hidden];
  settings.pinnedRepositoryIds = pinned.filter(Boolean);
  await saveProfileSettings(user.id, settings);
  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
