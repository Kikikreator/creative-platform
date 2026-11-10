"use client";

import { useEffect, useRef, useState } from "react";
import { AppWindow, ChevronLeft, ChevronRight, Images } from "lucide-react";

export type CaseStudySlide = {
  url: string;
  path?: string;
  alt?: string | null;
};

export type UsedAppItem = {
  name: string;
  url: string;
  path?: string;
  alt?: string | null;
};

type UsedAppsProps = {
  apps: UsedAppItem[];
};

type CaseStudiesProps = {
  images: CaseStudySlide[];
  courseTitle: string;
};

/**
 * Software card: the section card is the only card surface.
 * The app logo is displayed directly, without a second framed tile around it.
 */
export function CourseUsedApps({ apps }: UsedAppsProps) {
  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-[#EAE5ED] bg-white p-5 shadow-[0_2px_10px_rgba(38,0,71,.025)] sm:p-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDF4F2] text-[#09483F]">
          <AppWindow size={17} />
        </div>
        <div className="min-w-0">
          <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-[#74627E]">
            Tools & Software
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-[#21182A]">
            Aplikasi yang Digunakan
          </h2>
        </div>
      </div>

      {apps.length > 0 ? (
        <div className="flex flex-1 items-center justify-center py-4">
          <div
            className={
              apps.length === 1
                ? "flex w-full flex-col items-center justify-center gap-3"
                : "grid w-full grid-cols-2 items-start justify-items-center gap-x-3 gap-y-5 sm:grid-cols-2"
            }
          >
            {apps.map((app, index) => (
              <div
                key={app.path ?? `${app.name}-${index}`}
                className="flex min-w-0 flex-col items-center justify-center gap-2.5 text-center"
              >
                <img
                  src={app.url}
                  alt={app.alt || app.name}
                  loading="lazy"
                  decoding="async"
                  className={
                    apps.length === 1
                      ? "h-[92px] w-[92px] object-contain"
                      : "h-[72px] w-[72px] object-contain"
                  }
                />
                <span className="max-w-[180px] break-words text-xs font-medium leading-5 text-[#51465D]">
                  {app.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-[150px] flex-1 items-center justify-center px-3 text-center text-xs leading-5 text-[#948B9B]">
          Informasi aplikasi yang digunakan akan ditampilkan di sini.
        </div>
      )}
    </article>
  );
}

export function CourseCaseStudies({ images, courseTitle }: CaseStudiesProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (images.length <= 1 || paused) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, 4200);

    return () => window.clearInterval(interval);
  }, [images.length, paused]);

  useEffect(() => {
    const track = trackRef.current;
    const activeSlide = track?.children.item(activeIndex) as HTMLElement | null;

    if (!track || !activeSlide) return;

    track.scrollTo({
      left: activeSlide.offsetLeft - track.offsetLeft,
      behavior: "smooth",
    });
  }, [activeIndex]);

  const showPrevious = () => {
    setActiveIndex((current) => (current - 1 + images.length) % images.length);
  };

  const showNext = () => {
    setActiveIndex((current) => (current + 1) % images.length);
  };

  const slideWidthClass =
    images.length === 1
      ? "w-full"
      : images.length === 2
        ? "w-[82%] sm:w-[calc((100%_-_1rem)/2)]"
        : images.length === 3
          ? "w-[82%] sm:w-[calc((100%_-_2rem)/3)]"
          : images.length === 4
            ? "w-[82%] sm:w-[calc((100%_-_2rem)/3)] lg:w-[calc((100%_-_3rem)/4)]"
            : "w-[82%] sm:w-[calc((100%_-_2rem)/3)] lg:w-[calc((100%_-_4rem)/5)]";

  return (
    <article
      className="relative mt-5 min-w-0 rounded-2xl border border-[#EAE5ED] bg-white p-4 shadow-[0_2px_10px_rgba(38,0,71,.025)] sm:p-6"
      aria-label="Contoh studi kasus kelas"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF4E8] text-[#C77A17]">
            <Images size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-[#74627E]">
              Portfolio & Practice
            </p>
            <h2 className="mt-0.5 text-sm font-semibold text-[#21182A]">
              Contoh Studi Kasus
            </h2>
          </div>
        </div>

        {images.length > 1 && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={showPrevious}
              aria-label="Contoh sebelumnya"
              className="flex h-9 w-9 min-h-0 min-w-0 items-center justify-center rounded-lg border border-[#EAE5ED] bg-white p-0 text-[#51465D] transition hover:bg-[#F8F6F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#260047]"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              onClick={showNext}
              aria-label="Contoh berikutnya"
              className="flex h-9 w-9 min-h-0 min-w-0 items-center justify-center rounded-lg border border-[#EAE5ED] bg-white p-0 text-[#51465D] transition hover:bg-[#F8F6F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#260047]"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        )}
      </div>

      {images.length > 0 ? (
        <div
          ref={trackRef}
          className="relative mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Galeri contoh studi kasus"
        >
          {images.map((image, index) => (
            <div
              key={image.path ?? image.url}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} dari ${images.length}`}
              className={`shrink-0 snap-start overflow-hidden rounded-xl border border-[#EEEAF2] bg-[#F8F6F9] ${slideWidthClass}`}
            >
              <div className="flex aspect-[4/5] items-center justify-center bg-[#F8F6F9]">
                <img
                  src={image.url}
                  alt={image.alt || `${courseTitle} - contoh studi kasus ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-[#DED6E3] bg-[#FCFBFD] px-4 text-center text-xs leading-5 text-[#948B9B]">
          Contoh hasil karya kelas akan ditampilkan di sini.
        </div>
      )}

      {images.length > 1 && (
        <div
          className="mt-3 flex items-center justify-center gap-2"
          aria-label="Pilih slide contoh studi kasus"
        >
          {images.map((image, index) => {
            const isActive = activeIndex === index;

            return (
              <button
                key={image.path ?? image.url}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Tampilkan slide ${index + 1}`}
                aria-current={isActive ? "true" : undefined}
                className="inline-flex shrink-0 cursor-pointer appearance-none items-center justify-center rounded-full border-0 p-0 shadow-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#260047] focus-visible:ring-offset-2"
                style={{
                  width: 8,
                  height: 8,
                  minWidth: 8,
                  minHeight: 8,
                  maxWidth: 8,
                  maxHeight: 8,
                  flex: "0 0 8px",
                  padding: 0,
                  margin: 0,
                  border: 0,
                  borderRadius: 9999,
                  boxShadow: "none",
                  backgroundColor: isActive ? "#260047" : "#D7CFDE",
                  appearance: "none",
                }}
              />
            );
          })}
        </div>
      )}
    </article>
  );
}
