"use client";

import { useEffect } from "react";
import { AppSidebar } from "@/components/navigation/app-sidebar";

export function NavigationMobile({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button type="button" aria-label="Fechar navegação" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-[min(100%,20rem)] overflow-y-auto border-r border-stocklana-border bg-stocklana-bg p-4 shadow-brand">
        <AppSidebar onNavigate={onClose} />
      </div>
    </div>
  );
}
