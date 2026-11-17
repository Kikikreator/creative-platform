"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";

type SectionAnchorProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  href: `#${string}`;
};

/**
 * Anchor internal yang tetap menggulir ke target setiap kali diklik,
 * termasuk ketika hash URL sudah sama dengan target.
 */
export default function SectionAnchor({
  href,
  onClick,
  ...props
}: SectionAnchorProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    // Biarkan perilaku browser standar untuk klik yang membuka tab baru.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const targetId = decodeURIComponent(href.slice(1));
    const target = document.getElementById(targetId);

    // Jika target tidak ditemukan, biarkan browser menangani anchor secara normal.
    if (!target) return;

    event.preventDefault();

    // Perbarui hash tanpa menambah entri riwayat berulang.
    if (window.location.hash !== href) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${href}`
      );
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return <a href={href} onClick={handleClick} {...props} />;
}
