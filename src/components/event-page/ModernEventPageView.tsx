"use client";

import { useState } from "react";
import type { EventPageData } from "@/lib/event/eventPageTypes";
import { formatRuSessionHero } from "@/lib/event/eventPageFormat";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";

export function ModernEventPageView({ data }: { data: EventPageData }) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    data.sessions[0]?.id ?? null
  );

  const selectedSession = data.sessions.find((s) => s.id === selectedSessionId) ?? data.sessions[0];
  const sessionLine = selectedSession
    ? formatRuSessionHero(selectedSession.startsAt)
    : "Расписание уточняется";
  const priceLabel = normalizeUiCurrencyText(data.priceLabel ?? "");

  return (
    <main className="py-12 md:py-20 px-4 sm:px-6 lg:px-8 mx-auto max-w-[1200px]">
      <div className="flex flex-col md:flex-row gap-10">
        {/* Left Column (30%) - Media Elements */}
        <aside className="w-full md:w-[30%] space-y-6">
          {/* Poster Image */}
          <div className="rounded-xl overflow-hidden aspect-[3/4] shadow-sm">
            <img
              className="w-full h-full object-cover"
              src={data.media.posterUrl}
              alt={data.media.posterAlt}
            />
          </div>

          {/* Trailer Placeholder */}
          {data.media.trailerYoutubeId && (
            <div className="relative group aspect-video rounded-xl bg-zinc-900 overflow-hidden flex items-center justify-center cursor-pointer">
              <img
                alt="Trailer preview"
                className="absolute inset-0 w-full h-full object-cover opacity-50 grayscale group-hover:grayscale-0 transition-all"
                src={data.media.posterUrl}
              />
              <span className="text-white text-5xl relative z-10">▶</span>
              <div className="absolute bottom-4 left-4 text-white text-xs font-bold uppercase tracking-widest z-10">
                {data.media.trailerLabel || "Watch Trailer"}
              </div>
            </div>
          )}

          {/* Vertical Video/Reel Placeholder */}
          {data.media.reel && (
            <div className="relative group aspect-[9/16] rounded-xl bg-zinc-100 border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center gap-2 overflow-hidden">
              <span className="text-zinc-400 text-3xl">🎬</span>
              <span className="text-zinc-500 font-bold text-xs uppercase tracking-tighter">
                {data.media.reel.label}
              </span>
            </div>
          )}
        </aside>

        {/* Right Column (70%) - Main Content */}
        <div className="w-full md:w-[70%]">
          {/* Header Info */}
          <section className="mb-8">
            <h1 className="font-bold text-3xl md:text-4xl text-gray-900 tracking-tight leading-tight mb-4">
              {data.title}
            </h1>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-sm font-medium">
                <div className="flex items-center gap-1">
                  <span className="text-[#FF385C] text-lg">★</span>
                  <span className="text-gray-900">4.92</span>
                  <span className="text-gray-500">(128 reviews)</span>
                </div>
                <span className="text-gray-300 text-xs">•</span>
                <span className="underline decoration-gray-500 underline-offset-4">
                  {data.venue?.name || data.citySlug}
                </span>
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors rounded-lg text-xs font-semibold">
                  <span className="text-lg">↗</span> Share
                </button>
                <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors rounded-lg text-xs font-semibold">
                  <span className="text-lg">♥</span> Save
                </button>
              </div>
            </div>
          </section>

          {/* Description */}
          <section className="py-10 border-t border-zinc-100">
            <h3 className="text-2xl font-bold mb-6">What you&#39;ll do</h3>
            <div className="text-gray-900 text-md leading-relaxed space-y-4 max-w-2xl">
              <p>{data.about.summary}</p>
              {data.about.full && <p>{data.about.full}</p>}
            </div>
          </section>

          {/* Booking Card In-Line/Sticky */}
          <section className="my-8">
            <div className="p-6 bg-white shadow-lg rounded-xl border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold">{renderCurrencyText(priceLabel)}</span>
                    <span className="text-gray-500 font-medium">/ person</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold mt-1">
                    <span className="text-xs">★</span>
                    <span>4.92</span>
                    <span className="text-gray-500 font-normal ml-2">128 reviews</span>
                  </div>
                </div>
                <div className="flex-grow flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 border border-zinc-200 rounded-lg p-2 flex flex-col justify-center">
                    <p className="text-[9px] font-bold uppercase text-gray-900 tracking-wider">
                      Date & Time
                    </p>
                    <p className="text-xs">{sessionLine}</p>
                  </div>
                  <div className="flex-1 border border-zinc-200 rounded-lg p-2 flex flex-col justify-center">
                    <p className="text-[9px] font-bold uppercase text-gray-900 tracking-wider">
                      Guests
                    </p>
                    <p className="text-xs">2 guests</p>
                  </div>
                </div>
                <button className="px-8 py-4 bg-gradient-to-br from-[#FF385C] to-[#e21e4a] text-white font-bold rounded-lg hover:opacity-95 transition-all active:scale-[0.98]">
                  Reserve
                </button>
              </div>
            </div>
          </section>

          {/* Event Schedule */}
          {data.sessions.length > 0 && (
            <section className="py-10 border-t border-zinc-100">
              <h3 className="text-2xl font-bold mb-8">Event Schedule</h3>
              <div className="space-y-6">
                {data.sessions.slice(0, 3).map((session, idx) => {
                  const time = new Date(session.startsAt).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isLast = idx === Math.min(2, data.sessions.length - 1);
                  return (
                    <div
                      key={session.id}
                      className={`flex gap-6 relative pl-6 ${!isLast ? "before:content-[''] before:absolute before:left-[3px] before:top-2 before:bottom-0 before:w-[2px] before:bg-zinc-100" : ""}`}
                    >
                      <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-[#FF385C]"></div>
                      <div className="min-w-[80px] font-bold text-sm">{time}</div>
                      <div>
                        <p className="font-bold text-sm">Session {idx + 1}</p>
                        <p className="text-gray-500 text-xs">Event activity</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Location & Contact */}
          {data.venue && (
            <section className="py-10 border-t border-zinc-100">
              <h3 className="text-2xl font-bold mb-8">Where you&#39;ll be</h3>
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-6">
                    {/* Organizer Info */}
                    <div className="flex items-center gap-4 pb-6 border-b border-zinc-100">
                      <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-2xl">👤</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-bold">Hosted by Organizer</h4>
                        <p className="text-gray-500 text-xs mt-0.5">2 hours · Russian</p>
                      </div>
                    </div>

                    {/* Address & Contact */}
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <span className="text-2xl text-gray-900">📍</span>
                        <div>
                          <p className="font-bold text-md">{data.venue.name}</p>
                          {data.venue.address && (
                            <p className="text-gray-700 text-sm leading-relaxed">
                              {data.venue.address}
                            </p>
                          )}
                          {data.venue.landmark && (
                            <p className="text-gray-500 text-xs mt-1">{data.venue.landmark}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Get Directions Button */}
                    {data.venue.routeUrl && (
                      <div className="pt-2">
                        <a
                          className="inline-flex items-center gap-2 px-6 py-3 border border-gray-900 rounded-lg font-bold text-xs hover:bg-zinc-50 transition-colors shadow-sm active:scale-95"
                          href={data.venue.routeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="text-lg">🧭</span>
                          Get Directions
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Map */}
                  {data.venue.mapUrl && (
                    <div className="flex-1">
                      <div className="w-full aspect-video rounded-xl bg-zinc-200 overflow-hidden relative grayscale hover:grayscale-0 transition-all duration-500 cursor-pointer border border-zinc-100 shadow-sm">
                        <img
                          alt="Map location"
                          className="w-full h-full object-cover"
                          src={data.venue.mapUrl}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-10 h-10 bg-[#FF385C] rounded-full flex items-center justify-center text-white shadow-lg ring-4 ring-white/20">
                            <span>📍</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Reviews */}
          <section className="py-10 border-t border-zinc-100">
            <div className="flex items-center gap-2 mb-8">
              <span className="text-2xl text-gray-900">★</span>
              <h3 className="text-2xl font-bold">4.92 · 128 reviews</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-sm">👤</span>
                  </div>
                  <div>
                    <p className="font-bold text-xs">Michael R.</p>
                    <p className="text-gray-500 text-[10px]">October 2023</p>
                  </div>
                </div>
                <p className="text-gray-800 text-sm leading-relaxed">
                  The best rooftop experience I&#39;ve ever had in New York. The music was world-class
                  and the host is a fantastic organizer.
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-sm">👤</span>
                  </div>
                  <div>
                    <p className="font-bold text-xs">Sarah L.</p>
                    <p className="text-gray-500 text-[10px]">September 2023</p>
                  </div>
                </div>
                <p className="text-gray-800 text-sm leading-relaxed">
                  A truly magical evening. The view of the sunset while the band played was
                  something out of a movie.
                </p>
              </div>
            </div>
            <button className="mt-8 px-6 py-3 border border-gray-900 rounded-lg font-bold text-xs hover:bg-zinc-50 transition-colors">
              Show all reviews
            </button>
          </section>
        </div>
      </div>

      {/* Mobile Sticky Footer Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-100 px-6 py-4 flex justify-between items-center z-50">
        <div>
          <p className="font-bold text-lg">
            {renderCurrencyText(priceLabel)} <span className="text-sm font-normal text-gray-500">/ person</span>
          </p>
          <p className="text-xs font-bold underline">{sessionLine}</p>
        </div>
        <button className="px-8 py-3 bg-gradient-to-br from-[#FF385C] to-[#e21e4a] text-white font-bold rounded-lg active:scale-95 transition-transform">
          Reserve
        </button>
      </div>
    </main>
  );
}
