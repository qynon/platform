"use client";
import { useEffect, useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { NotebookView } from "@/components/NotebookView";

function readHash(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(/^#nb=(.+)$/);
  return m ? m[1] : null;
}

export default function Home() {
  const [openId, setOpenId] = useState<string | null>(() => readHash());

  useEffect(() => {
    const onHash = () => setOpenId(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function openNb(id: string) {
    setOpenId(id);
    window.location.hash = `nb=${id}`;
  }
  function back() {
    setOpenId(null);
    history.replaceState(null, "", " ");
  }

  if (openId) return <NotebookView id={openId} onBack={back} />;
  return <Dashboard onOpen={openNb} />;
}
