"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sacramento } from "next/font/google"; // 引入手写风格字体
import { useEffect, useState } from "react";

// 加载字体配置
const sacramento = Sacramento({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

type LumiereIntroProps = {
  onComplete: () => void;
};

export default function LumiereIntro({ onComplete }: LumiereIntroProps) {
  const [isVisible, setIsVisible] = useState(true);

  // 动画配置常量
  const strokeDuration = 2; // 描边书写时长
  const fillDuration = 0.8;   // 填充颜色渐变时长
  const totalDuration = strokeDuration + fillDuration + 0.5; // 总时长预留一点缓冲

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      // 等待淡出动画完成后调用 onComplete
      setTimeout(onComplete, 800); 
    }, totalDuration * 1000);

    return () => clearTimeout(timer);
  }, [onComplete, totalDuration]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="lumiere-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#070b14] text-white"
        >
          {/* 背景光晕效果 */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(50,100,200,0.15)_0%,rgba(7,11,20,0)_60%)]" />
          
          <div className={`relative z-10 ${sacramento.className}`}>
            <svg
              viewBox="0 0 600 160"
              className="w-[80vw] max-w-[600px] h-auto overflow-visible"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* 定义渐变 */}
              <defs>
                <linearGradient id="text-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#dbeafe" stopOpacity="1" />
                  <stop offset="100%" stopColor="#fff" stopOpacity="0.9" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <motion.text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="130"
                stroke="url(#text-gradient)"
                strokeWidth="1.5"
                fill="transparent"
                style={{ filter: "url(#glow)" }} // 添加发光滤镜
                initial={{ 
                  strokeDasharray: 1000, 
                  strokeDashoffset: 1000,
                  fill: "transparent"
                }}
                animate={{ 
                  strokeDashoffset: 0,
                  fill: "#ffffff"
                }}
                transition={{
                  strokeDashoffset: { 
                    duration: strokeDuration, 
                    ease: "easeInOut" 
                  },
                  fill: { 
                    delay: strokeDuration - 0.5, 
                    duration: fillDuration, 
                    ease: "easeOut" 
                  }
                }}
              >
                Lumière
              </motion.text>
            </svg>
            
            {/* 副标题淡入 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: strokeDuration, duration: 0.8 }}
              className="mt-2 text-center text-blue-200/60 font-sans text-sm tracking-[0.3em] uppercase"
            >
              AI Interior Designer
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
