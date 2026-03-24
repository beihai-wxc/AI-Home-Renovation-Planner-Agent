"use client";

import { useEffect } from "react";

interface ImageLightboxProps {
  isOpen: boolean;
  imageUrl: string | null;
  title?: string;
  onClose: () => void;
}

export default function ImageLightbox({ isOpen, imageUrl, title, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[92vh] max-w-[92vw] overflow-hidden rounded-2xl bg-[#111]"
        onClick={(event) => event.stopPropagation()}
      >
        {title && <div className="px-4 py-2 text-sm text-white/85">{title}</div>}
        <img src={imageUrl} alt={title || "预览图片"} className="max-h-[85vh] max-w-[92vw] object-contain" />
        <button
          type="button"
          className="absolute right-3 top-3 h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80"
          onClick={onClose}
          aria-label="关闭预览"
        >
          ×
        </button>
      </div>
    </div>
  );
}

