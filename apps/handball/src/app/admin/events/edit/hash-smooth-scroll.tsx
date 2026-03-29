"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function HashSmoothScroll() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (window.location.hash !== "#event-edit-forms") {
      return;
    }

    const target = document.getElementById("event-edit-forms");
    if (!target) {
      return;
    }

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [pathname, searchParams]);

  return null;
}
