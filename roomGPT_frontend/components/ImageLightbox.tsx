"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import downloadPhoto from "../utils/downloadPhoto";

interface ImageLightboxProps {
  isOpen: boolean;
  imageUrl: string | null;
  title?: string;
  downloadFilename?: string;
  onClose: () => void;
}

function resolveDownloadFilename(imageUrl: string, explicitName?: string) {
  if (explicitName?.trim()) return explicitName.trim();

  try {
    const parsed = new URL(imageUrl, window.location.href);
    const rawName = parsed.pathname.split("/").pop() || "preview-image.png";
    return decodeURIComponent(rawName);
  } catch {
    return "preview-image.png";
  }
}

export default function ImageLightbox({
  isOpen,
  imageUrl,
  title,
  downloadFilename,
  onClose,
}: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const resolvedFilename = useMemo(() => {
    if (!imageUrl) return "preview-image.png";
    return resolveDownloadFilename(imageUrl, downloadFilename);
  }, [downloadFilename, imageUrl]);

  if (!mounted || !isOpen || !imageUrl) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-black/88 backdrop-blur-sm"
        onClick={onClose}
        aria-label="关闭预览遮罩"
      />
      <div
        className="absolute inset-0 flex h-screen w-screen items-center justify-center p-4 sm:p-6 lg:p-10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0D0D0D] shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white/95 sm:text-base">
                {title || "图片预览"}
              </div>
              <div className="mt-0.5 text-xs text-white/45">
                全屏查看生成效果图
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadPhoto(imageUrl, resolvedFilename)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/14 sm:px-4"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 10l5 5 5-5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 21h14" />
                </svg>
                下载图片
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white transition hover:bg-white/14"
                onClick={onClose}
                aria-label="关闭预览"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 6l-12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_40%),linear-gradient(180deg,#151515_0%,#090909_100%)] p-3 sm:p-5 lg:p-8">
            <img
              src={imageUrl}
              alt={title || "预览图片"}
              className="max-h-full max-w-full object-contain select-none"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

