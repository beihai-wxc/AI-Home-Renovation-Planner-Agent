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
  label,
  labelType,
}: {
  title: string;
  imageSrc: string;
  imageAlt: string;
  label: string;
  labelType: "before" | "after";
}) {
  return (
    <div>
      <h3 className="mb-4 text-center text-lg font-semibold text-apple-black">
        {title}
      </h3>
      <div className="apple-card group relative w-full overflow-hidden">
        {/* 标签角标 */}
        <div
          className={`absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full text-xs font-medium ${
            labelType === "before"
              ? "bg-apple-gray-600/80 text-white backdrop-blur-sm"
              : "bg-apple-blue/90 text-white backdrop-blur-sm"
          }`}
        >
          {label}
        </div>
        <div className="relative h-[280px] w-full sm:h-[380px] lg:h-[450px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={imageSrc}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute inset-0"
            >
              <Image
                src={imageSrc}
                alt={imageAlt}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </motion.div>
          </AnimatePresence>
        </div>
        {/* 底部渐变遮罩 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/60 to-transparent" />
      </div>
    </div>
  );
}

export default function PairedCarousel({
  pairs,
  interval = 4000,
}: PairedCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % pairs.length);
    }, interval);

    return () => window.clearInterval(timer);
  }, [interval, pairs.length, isPaused]);

  const activePair = pairs[activeIndex];

  const handleDotClick = (index: number) => {
    setActiveIndex(index);
    setIsPaused(true);
    // 3秒后恢复自动播放
    setTimeout(() => setIsPaused(false), 3000);
  };

  return (
    <section className="w-full">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <SlidePanel
          title="原始房间"
          imageSrc={activePair.beforeSrc}
          imageAlt={activePair.beforeAlt}
          label="改造前"
          labelType="before"
        />
        <SlidePanel
          title="改造效果"
          imageSrc={activePair.afterSrc}
          imageAlt={activePair.afterAlt}
          label="改造后"
          labelType="after"
        />
      </div>

      {/* 进度指示器 */}
      <div className="mt-10 flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-apple-gray-500">
            {activeIndex + 1} / {pairs.length}
          </span>
          <div className="h-3 w-px bg-apple-gray-300" />
          <span className="text-xs text-apple-gray-400">
            {isPaused ? "已暂停" : "自动播放中"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {pairs.map((pair, index) => (
            <button
              key={`${pair.beforeSrc}-${pair.afterSrc}-${index}`}
              type="button"
              aria-label={`切换到第 ${index + 1} 组对比图`}
              onClick={() => handleDotClick(index)}
              className={`rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? "h-2.5 w-6 bg-apple-blue"
                  : "h-2.5 w-2.5 bg-apple-gray-300 hover:bg-apple-gray-400"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}