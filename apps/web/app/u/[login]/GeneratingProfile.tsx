"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function GeneratingProfile() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setTimeout(() => router.refresh(), 3000);
    return () => window.clearTimeout(timer);
  }, [router]);
  return <p className="muted">Ginmap is reading this account&apos;s public GitHub history. This page updates automatically.</p>;
}
