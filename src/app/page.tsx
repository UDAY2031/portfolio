"use client";

import { useEffect, useRef } from "react";

/** The native ES-module film also runs directly on a static server. */
export default function Home() {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (frame.current) frame.current.src = `/film/index.html${window.location.search}`;
  }, []);
  return <main><iframe ref={frame} title="Gargantua — an archive beyond time" allow="autoplay; fullscreen; screen-wake-lock" allowFullScreen style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, background: "#000" }} /></main>;
}
