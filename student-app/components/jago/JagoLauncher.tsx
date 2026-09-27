"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, X } from "lucide-react";
import { isAuthenticated } from "../../lib/auth/session";
import { ChatWindow } from "./ChatWindow";

export function JagoLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated());

  React.useEffect(() => {
    setAuthenticated(isAuthenticated());
  }, [pathname]);

  const publicPage = pathname === "/" || pathname === "/login" || pathname === "/register";
  if (!authenticated || publicPage || pathname === "/jago") return null;

  return (
    <>
      {open && (
        <div className="absolute z-50 right-2 left-2 bottom-20 h-[min(680px,calc(100vh-170px))] max-h-[78vh]">
          <ChatWindow variant="drawer" onClose={() => setOpen(false)} />
        </div>
      )}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute z-50 right-3 bottom-20 flex items-center gap-2 rounded-2xl bg-mota-900 text-white px-3 py-2.5 shadow-xl border border-mota-700 hover:bg-mota-800 transition-all"
          aria-label="Open JAGO assistant"
        >
          <span className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm"><Bot className="w-5 h-5" /></span>
          <span className="pr-1 text-xs font-bold">Ask JAGO</span>
        </button>
      )}
    </>
  );
}
