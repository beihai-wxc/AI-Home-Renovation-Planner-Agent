"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import ImageLightbox from "./ImageLightbox";

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
  onPreview,
}: {
  title: string;
  imageSrc: string;
  imageAlt: string;
  label: string;
  labelType: "before" | "after";
  onPreview: (url: string, alt: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-center text-xl font-semibold text-accent sm:text-4xl">{title}</h3>
      <div
        className="image-card group relative w-full cursor-zoom-in overflow-hidden rounded-2xl border border-secondary/15 bg-surface-2 shadow-sm transition duration-300 hover:border-secondary/30"
        onClick={() => onPreview(imageSrc, imageAlt)}
      >
        {/* 标签角标 */}
        <div className={`absolute top-4 left-4 z-10 px-3 py-1.5 rounded-md text-sm font-medium ${
          labelType === "before"
            ? "bg-text-secondary text-white"
            : "bg-accent text-white"
        }`}>
          {label}
        </div>
        <div className="relative h-[240px] w-full sm:h-[360px] lg:h-[430px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={imageSrc}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface-2 to-transparent" />
      </div>
    </div>
  );
}

export default function PairedCarousel({ pairs, interval = 3500 }: PairedCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");

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
        <SlidePanel
          title="原始房间"
          imageSrc={activePair.beforeSrc}
          imageAlt={activePair.beforeAlt}
          label="改造前"
          labelType="before"
          onPreview={(url, alt) => {
            setPreviewImage(url);
            setPreviewTitle(alt);
          }}
        />
        <SlidePanel
          title="生成后的房间"
          imageSrc={activePair.afterSrc}
          imageAlt={activePair.afterAlt}
          label="改造后"
          labelType="after"
          onPreview={(url, alt) => {
            setPreviewImage(url);
            setPreviewTitle(alt);
          }}
        />
      </div>

      {/* 进度指示器 */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <span className="text-sm text-text-secondary font-medium">
          {activeIndex + 1} / {pairs.length}
        </span>
        <div className="flex justify-center gap-2">
          {pairs.map((pair, index) => (
            <button
              key={`${pair.beforeSrc}-${pair.afterSrc}-${index}`}
              type="button"
              aria-label={`切换到第 ${index + 1} 组对比图`}
              onClick={() => setActiveIndex(index)}
              className={`h-2.5 rounded-md transition-all duration-200 ${
                index === activeIndex ? "w-7 bg-accent" : "w-2.5 bg-secondary/30"
              }`}
            />
          ))}
        </div>
      </div>
      <ImageLightbox
        isOpen={Boolean(previewImage)}
        imageUrl={previewImage}
        title={previewTitle}
        onClose={() => setPreviewImage(null)}
      />
    </section>
  );
}
