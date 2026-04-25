"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

type LumiereIntroProps = {
  onComplete: () => void;
};

export default function LumiereIntro({ onComplete }: LumiereIntroProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // 总动画时长约3.2秒
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 3200);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isVisible) {
      const timer = setTimeout(onComplete, 1200);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="lumiere-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: "-5%", filter: "blur(8px)", transition: { duration: 1.2, ease: [0.76, 0, 0.24, 1] } }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#FAF8F5] text-[#2D2D2D] overflow-hidden"
        >
          {/* 温暖感背景光晕层（匹配全站色调） */}
          <div className="pointer-events-none absolute inset-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 2.5, ease: "easeOut" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] min-w-[600px] min-h-[600px] bg-[radial-gradient(circle_at_center,rgba(139,111,71,0.12)_0%,rgba(250,248,245,0)_60%)] rounded-full blur-3xl"
            />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            {/* 笔画描绘效果 */}
            <div className="w-full flex justify-center">
              <svg
                viewBox="0 0 600 160"
                className="w-[85vw] max-w-[650px] h-auto overflow-visible"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="lumiere-stroke-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#A68B5B" />
                    <stop offset="50%" stopColor="#8B6F47" />
                    <stop offset="100%" stopColor="#A68B5B" />
                  </linearGradient>
                </defs>
                <motion.text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dy=".32em"
                  className="font-display"
                  fontSize="140"
                  fontWeight="300"
                  letterSpacing="0.1em"
                  stroke="url(#lumiere-stroke-gradient)"
                  strokeWidth="1.5"
                  fill="#8B6F47"
                  initial={{ strokeDasharray: 2500, strokeDashoffset: 2500, fillOpacity: 0 }}
                  animate={{ strokeDashoffset: 0, fillOpacity: 1 }}
                  transition={{
                    strokeDashoffset: { duration: 2.2, ease: "easeInOut" },
                    fillOpacity: { duration: 1, delay: 1.8, ease: "easeInOut" }
                  }}
                >
                  Lumière
                </motion.text>
              </svg>
            </div>

            {/* 副标题平滑展开 */}
            <motion.div
              initial={{ opacity: 0, letterSpacing: "0.2em", y: 5 }}
              animate={{ opacity: 0.7, letterSpacing: "0.5em", y: 0 }}
              transition={{ delay: 1.0, duration: 1.8, ease: "easeOut" }}
              className="-mt-2 text-center text-[#8B6F47] font-sans text-[10px] sm:text-xs uppercase tracking-widest"
            >
              AI Interior Designer
            </motion.div>

            {/* 质感光泽扫过特效 */}
            <motion.div
              initial={{ left: "-100%", opacity: 0 }}
              animate={{ left: "200%", opacity: [0, 0.4, 0] }}
              transition={{ delay: 1.2, duration: 2, ease: "easeInOut" }}
              className="absolute top-0 bottom-0 w-[120px] bg-gradient-to-r from-transparent via-[#FFFFFF] to-transparent skew-x-[-25deg] mix-blend-overlay"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
