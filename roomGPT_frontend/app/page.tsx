"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import Footer from "../components/Footer";
import Header from "../components/Header";
import LumiereIntro from "../components/LumiereIntro";
import PairedCarousel, { PairedSlide } from "../components/PairedCarousel";
import SquigglyLines from "../components/SquigglyLines";

const pairedSlides: PairedSlide[] = [
  {
    beforeSrc: "/pic/pic1_before.png",
    afterSrc: "/pic/pic1_after.png",
    beforeAlt: "原始房间示例图 1",
    afterAlt: "生成后的房间示例图 1",
  },
  {
    beforeSrc: "/pic/pic2_before.png",
    afterSrc: "/pic/pic2_after.png",
    beforeAlt: "原始房间示例图 2",
    afterAlt: "生成后的房间示例图 2",
  },
  {
    beforeSrc: "/pic/pic3_before.png",
    afterSrc: "/pic/pic3_after.png",
    beforeAlt: "原始房间示例图 3",
    afterAlt: "生成后的房间示例图 3",
  },
  {
    beforeSrc: "/pic/pic4_before.png",
    afterSrc: "/pic/pic4_after.png",
    beforeAlt: "原始房间示例图 4",
    afterAlt: "生成后的房间示例图 4",
  },
  {
    beforeSrc: "/pic/pic5_before.png",
    afterSrc: "/pic/pic5_after.png",
    beforeAlt: "原始房间示例图 5",
    afterAlt: "生成后的房间示例图 5",
  },
  {
    beforeSrc: "/pic/pic6_before.png",
    afterSrc: "/pic/pic6_after.png",
    beforeAlt: "原始房间示例图 6",
    afterAlt: "生成后的房间示例图 6",
  },
  {
    beforeSrc: "/pic/pic7_before.png",
    afterSrc: "/pic/pic7_after.png",
    beforeAlt: "原始房间示例图 7",
    afterAlt: "生成后的房间示例图 7",
  },
];

const introCards = [
  {
    title: "项目初衷",
    content:
      "把装修灵感从“想象”变成“可视化决策”。通过上传真实房间照片，快速看到改造方向，减少试错成本。",
  },
  {
    title: "如何驱动",
    content:
      "系统采用多智能体协作：视觉评估理解现状，设计规划输出方案，项目协调整合成可执行建议与效果图。",
  },
  {
    title: "你能获得什么",
    content:
      "不仅有对比效果图，还能获得更清晰的改造路径、风格选择依据，以及面向实际落地的装修思路。",
  },
];

export default function HomePage() {
  const [showIntro, setShowIntro] = useState(true);

  return (
    <div className="home-cinematic relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* 温暖动态背景层 */}
      <div className="dream-background fixed inset-0 -z-10 pointer-events-none">
        {/* 主背景由 CSS 渐变控制 */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/[0.08] rounded-full blur-3xl animate-pulse" style={{ animationDelay: "0s" }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/[0.06] rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-teal-500/[0.05] rounded-full blur-2xl animate-pulse" style={{ animationDelay: "4s" }} />
        </div>
      </div>

      {showIntro && <LumiereIntro onComplete={() => setShowIntro(false)} />}
      <Header />
      <main className="relative mt-10 flex w-full flex-1 flex-col items-center justify-center px-6 text-center sm:mt-12">
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75 }}
          className="mx-auto max-w-6xl font-display text-4xl font-bold tracking-tight text-[#2D2D2D] sm:text-7xl"
        >
          把你的家变成{" "}
          <span className="relative whitespace-nowrap text-[#8B6F47]">
            <SquigglyLines />
            <span className="relative">理想的样子</span>
          </span>
        </motion.h1>

        <motion.h2
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.08 }}
          className="mx-auto mt-7 max-w-4xl text-base leading-8 text-[#5A5A5A] sm:mt-10 sm:text-2xl"
        >
          上传房间照片，预览改造效果。<br className="hidden sm:block" />
          先看效果，再做决定，让装修方案更有把握。
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.16 }}
        >
          <Link
            className="btn-warm mt-8 inline-flex rounded-2xl bg-[#8B6F47] px-8 py-4 text-lg font-semibold text-white transition-all duration-300 hover:bg-[#A68B5B]"
            href="/dream"
          >
            开始设计你的空间
          </Link>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.24 }}
          className="mt-10 w-full sm:mt-14"
        >
          <PairedCarousel pairs={pairedSlides} interval={3400} />
        </motion.section>

        <section className=”mt-12 w-full pb-10 sm:mt-16 sm:pb-16 px-6”>
          <div className=”mx-auto max-w-6xl text-left”>
            <motion.h3
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.55 }}
              className=”text-center text-2xl font-semibold text-[#2D2D2D] sm:text-3xl”
            >
              关于这个项目
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className=”mx-auto mt-4 max-w-3xl text-center text-base leading-7 text-[#5A5A5A] sm:text-lg”
            >
              我们希望让装修沟通变得看得见、说得清、能落地，让每个家都有温度。
            </motion.p>

            <div className=”mt-7 grid grid-cols-1 gap-5 sm:mt-10 md:grid-cols-3”>
              {introCards.map((card, index) => (
                <motion.article
                  key={card.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: 0.1 * index }}
                  className=”intro-zoom-card rounded-2xl border border-[#8B6F47]/15 bg-white p-6 backdrop-blur-sm transition hover:border-[#8B6F47]/35”
                >
                  <h4 className=”text-lg font-semibold text-[#8B6F47]”>{card.title}</h4>
                  <p className=”mt-3 text-sm leading-7 text-[#5A5A5A]”>{card.content}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
