"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

export type PairedSlide = {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
};

type PairedCarouselProps = {
  pairs: PairedSlide[];
  interval?: number;
};

function SlidePanel({
  title,
  imageSrc,
  imageAlt,
}: {
  title: string;
  imageSrc: string;
  imageAlt: string;
}) {
  return (
    <div>
      <h3 className="mb-3 text-center text-xl font-semibold text-[#2D2D2D] sm:text-4xl">{title}</h3>
      <div className="image-card group relative w-full overflow-hidden rounded-3xl border border-[#8B6F47]/20 bg-white/50 backdrop-blur-sm shadow-[0_8px_32px_rgba(139,111,71,0.08)] transition duration-500 hover:border-[#8B6F47]/40">
        <div className="relative h-[240px] w-full sm:h-[360px] lg:h-[430px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={imageSrc}
              initial={{ opacity: 0, x: 18, scale: 1.03 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -18, scale: 0.99 }}
              transition={{ duration: 0.58, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <Image
                src={imageSrc}
                alt={imageAlt}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#FAF8F5]/80 to-transparent" />
      </div>
    </div>
  );
}

export default function PairedCarousel({ pairs, interval = 3500 }: PairedCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % pairs.length);
    }, interval);

    return () => window.clearInterval(timer);
  }, [interval, pairs.length]);

  const activePair = pairs[activeIndex];

  return (
    <section className="w-full">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
        <SlidePanel title="原始房间" imageSrc={activePair.beforeSrc} imageAlt={activePair.beforeAlt} />
        <SlidePanel title="生成后的房间" imageSrc={activePair.afterSrc} imageAlt={activePair.afterAlt} />
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {pairs.map((pair, index) => (
          <button
            key={`${pair.beforeSrc}-${pair.afterSrc}-${index}`}
            type="button"
            aria-label={`切换到第 ${index + 1} 组对比图`}
            onClick={() => setActiveIndex(index)}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              index === activeIndex ? "w-7 bg-[#8B6F47]" : "w-2.5 bg-[#C9B896]/50"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
