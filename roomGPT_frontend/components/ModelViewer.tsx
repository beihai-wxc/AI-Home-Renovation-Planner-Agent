"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          poster?: string;
          loading?: "auto" | "lazy" | "eager";
          reveal?: "auto" | "interaction" | "manual";
          "auto-rotate"?: boolean | string;
          "camera-controls"?: boolean | string;
          "shadow-intensity"?: string;
          "shadow-softness"?: string;
          "environment-image"?: string;
          exposure?: string;
          "camera-orbit"?: string;
          "min-camera-orbit"?: string;
          "max-camera-orbit"?: string;
          "field-of-view"?: string;
          "interaction-prompt"?: string;
          "ar"?: boolean | string;
          "ar-modes"?: string;
          tone_mapping?: string;
        },
        HTMLElement
      >;
    }
  }
}

interface ModelViewerProps {
  modelUrl: string;
  posterUrl?: string;
  className?: string;
}

export default function ModelViewer({ modelUrl, posterUrl, className }: ModelViewerProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamically load model-viewer script (self-hosted via npm)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already registered
    if (customElements.get("model-viewer")) {
      setScriptReady(true);
      return;
    }

    // Dynamic import from npm package
    import("@google/model-viewer")
      .then(() => {
        setScriptReady(true);
      })
      .catch((err) => {
        console.error("Failed to load model-viewer:", err);
        // Fallback: try loading from CDN (China-friendly mirror)
        const script = document.createElement("script");
        script.type = "module";
        script.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
        script.onload = () => setScriptReady(true);
        script.onerror = () => setError(true);
        document.head.appendChild(script);
      });
  }, []);

  // Listen for model-viewer events
  useEffect(() => {
    if (!scriptReady || !containerRef.current) return;

    const viewer = containerRef.current.querySelector("model-viewer");
    if (!viewer) return;

    const handleLoad = () => setLoaded(true);
    const handleError = () => setError(true);

    viewer.addEventListener("load", handleLoad);
    viewer.addEventListener("error", handleError);

    return () => {
      viewer.removeEventListener("load", handleLoad);
      viewer.removeEventListener("error", handleError);
    };
  }, [scriptReady, modelUrl]);

  if (error) {
    return (
      <div className={`rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600 ${className || ""}`}>
        <p className="font-medium">3D 模型加载失败</p>
        <p className="mt-1 text-xs text-red-400">请检查模型文件是否可访问</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden rounded-2xl ${className || ""}`}>
      {/* Loading skeleton */}
      {!loaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br from-[#FAF7F2] to-[#F0EBE3]">
          {posterUrl && (
            <img
              src={posterUrl}
              alt="加载中"
              className="absolute inset-0 h-full w-full object-cover opacity-30 blur-sm"
            />
          )}
          <div className="relative z-20 flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C9B99A] border-t-transparent" />
            <p className="text-sm font-medium text-[#8A6B46]">正在加载 3D 模型…</p>
          </div>
        </div>
      )}

      {scriptReady && (
        <model-viewer
          src={modelUrl}
          alt="3D 装修效果模型"
          poster={posterUrl}
          loading="eager"
          auto-rotate=""
          camera-controls=""
          shadow-intensity="1.2"
          shadow-softness="0.8"
          environment-image="neutral"
          exposure="1.1"
          camera-orbit="45deg 65deg 105%"
          min-camera-orbit="auto auto 50%"
          max-camera-orbit="auto auto 200%"
          field-of-view="30deg"
          interaction-prompt="auto"
          style={{
            width: "100%",
            height: "400px",
            backgroundColor: "#FAF7F2",
            borderRadius: "1rem",
            outline: "none",
          }}
        >
          {/* Custom progress bar slot */}
          <div
            slot="progress-bar"
            style={{
              position: "absolute",
              bottom: "12px",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "rgba(138, 107, 70, 0.85)",
              color: "#fff",
              padding: "6px 16px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            模型加载中…
          </div>
        </model-viewer>
      )}

      {/* Controls overlay */}
      {loaded && (
        <div className="absolute bottom-3 right-3 z-20 flex gap-2">
          <a
            href={modelUrl}
            download
            className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-[#5D4A32] shadow-md ring-1 ring-[#C9B99A]/40 backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow-lg"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            下载 GLB
          </a>
        </div>
      )}

      {/* Label */}
      {loaded && (
        <div className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-[#5D4A32] shadow-sm ring-1 ring-[#C9B99A]/30 backdrop-blur-sm">
          <span className="text-sm">🧊</span>
          3D 模型预览
        </div>
      )}
    </div>
  );
}
