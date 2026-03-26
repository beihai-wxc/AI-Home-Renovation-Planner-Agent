"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import Footer from "../components/Footer";
import Header from "../components/Header";
import LumiereIntro from "../components/LumiereIntro";
import PairedCarousel, { PairedSlide } from "../components/PairedCarousel";
import SquigglyLines from "../components/SquigglyLines";
import { getCurrentUser } from "../utils/auth";

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
    title: "你为什么需要Lumière",
    content:
      "装修前最难的是提前看见结果，也很难把模糊想法讲清楚。这个项目希望把灵感更早变成可以讨论的可视化方案。",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <circle cx="12" cy="12" r="6" strokeWidth="2" />
        <circle cx="12" cy="12" r="2" strokeWidth="2" />
      </svg>
    ),
  },
  {
    title: "它如何工作",
    content:
      "上传当前房间图和灵感图后，多个 Agent 会分工完成空间分析、方案规划和结果汇总，而不是只返回一句泛泛建议。",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: "你最终会得到什么",
    content:
      "你会拿到效果图、设计建议、风格方向和下一步行动思路，让装修讨论更具体，也更容易推进落地。",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const agentShowcase = [
  {
    name: "视觉评估师",
    title: "读取空间现状",
    description: "识别房间布局、采光、问题点与可保留结构，也能吸收灵感图里的风格语言。",
    icon: "🔍",
    accent: "from-[#F1D9B1] to-[#F7EEE0]",
  },
  {
    name: "设计规划师",
    title: "生成风格方案",
    description: "把预算、材料、配色和功能诉求整理成清晰可执行的设计方案，而不是一句模糊建议。",
    icon: "📋",
    accent: "from-[#DCE9DB] to-[#F0F7EF]",
  },
  {
    name: "项目协调员",
    title: "汇总并出效果图",
    description: "整合前两位智能体的结果，输出装修路线、行动建议，并生成最终的改造效果图。",
    icon: "⚙️",
    accent: "from-[#E6D8C5] to-[#F7F1E7]",
  },
];

export default function HomePage() {
  const [showIntro, setShowIntro] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    const sync = () => setIsLoggedIn(Boolean(getCurrentUser()));
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    const handleScrollHint = () => {
      setShowScrollHint(window.scrollY <= 2);
    };
    handleScrollHint();
    window.addEventListener("scroll", handleScrollHint, { passive: true });
    return () => window.removeEventListener("scroll", handleScrollHint);
  }, []);

  return (
    <div className="home-cinematic relative min-h-screen flex flex-col items-center overflow-x-hidden">
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
      {/* 固定导航占位 */}
      <div className="header-spacer" />
      <main className="relative w-full flex-1 px-6 text-center">
        <section className="relative mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-7xl flex-col items-center justify-center pt-6 sm:pt-10">
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
              href={isLoggedIn ? "/dream" : "/auth?redirect=/dream"}
            >
              开始设计你的空间
            </Link>
          </motion.div>

          {showScrollHint && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              onClick={() => {
                const target = document.getElementById("agent-workflow");
                if (!target) {
                  return;
                }
                const headerOffset = 88;
                const targetTop = target.getBoundingClientRect().top + window.scrollY - headerOffset;
                window.scrollTo({
                  top: Math.max(0, targetTop),
                  behavior: "smooth",
                });
              }}
              className="absolute bottom-5 right-2 hidden select-none flex-col items-center rounded-full border border-[#8B6F47]/20 bg-white/65 px-2 py-3 text-[#8B6F47]/85 shadow-[0_8px_24px_rgba(139,111,71,0.16)] backdrop-blur-md transition-all hover:border-[#8B6F47]/35 hover:bg-white/80 sm:flex"
              aria-label="下拉了解我们"
            >
              <span
                className="text-[11px] font-medium tracking-[0.08em]"
                style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
              >
                下拉了解我们
              </span>
              <motion.svg
                className="mt-2 h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
              </motion.svg>
            </motion.button>
          )}
        </section>

        <motion.section
          id="agent-workflow"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.22 }}
          className="mx-auto mt-8 w-full max-w-6xl"
        >
          <div className="rounded-[28px] border border-[#8B6F47]/12 bg-white/70 px-5 py-5 shadow-[0_18px_60px_rgba(139,111,71,0.08)] backdrop-blur-md sm:px-7 sm:py-6">
            <div className="grid gap-5 text-left lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)] lg:items-start lg:gap-8">
              <div className="max-w-3xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#A28962]">
                  Multi-Agent Workflow
                </p>
                <h3 className="cn-latin-heading mt-3 max-w-2xl text-[2rem] font-semibold leading-[1.16] tracking-[-0.02em] text-[#2D2D2D] sm:text-[2.55rem]">
                  从房间分析到效果图生成，3 个 Agent 各司其职
                </h3>
              </div>
              <div className="max-w-lg lg:pt-8">
                <p className="cn-latin-copy text-base leading-8 text-[#6B6459] sm:text-[1.05rem]">
                  从看懂你的房间，到生成方案，再到输出效果图，整个过程由分工明确的智能体协作完成。
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {agentShowcase.map((agent, index) => (
                <motion.article
                  key={agent.name}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.28 + index * 0.08 }}
                  className="relative overflow-hidden rounded-3xl border border-[#8B6F47]/10 bg-white p-5 text-left shadow-sm"
                >
                  <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${agent.accent} opacity-90`} />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">
                          {agent.icon}
                        </div>
                        <p className="cn-latin-heading text-[1.22rem] font-bold leading-none text-[#6E532F] sm:text-[1.28rem]">
                          {agent.name}
                        </p>
                      </div>
                      <span className="agent-index-label text-[11px] font-semibold uppercase text-[#8D724E]">
                        Agent 0{index + 1}
                      </span>
                    </div>
                    <h4 className="cn-latin-heading mt-10 text-[1.58rem] font-semibold leading-[1.18] tracking-[-0.01em] text-[#2D2D2D] sm:text-[1.68rem]">
                      {agent.title}
                    </h4>
                    <p className="cn-latin-copy mt-3 text-[15px] leading-8 text-[#5A5A5A]">{agent.description}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.24 }}
          className="mx-auto mt-10 w-full max-w-7xl sm:mt-14"
        >
          <PairedCarousel pairs={pairedSlides} interval={4000} />
        </motion.section>

        <section id="about" className="mx-auto mt-12 w-full max-w-7xl px-6 pb-10 sm:mt-16 sm:pb-16">
          <div className="mx-auto max-w-6xl text-left">
            <motion.h3
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.55 }}
              className="text-center text-2xl font-semibold text-[#2D2D2D] sm:text-3xl"
            >
              这个项目能帮你什么
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="mx-auto mt-4 max-w-3xl text-center text-base leading-7 text-[#5A5A5A] sm:text-lg"
            >
              它想解决的是装修前“看不见、说不清、难落地”的问题，把灵感更早变成可以讨论的方案。
            </motion.p>

            <div className="mt-7 grid grid-cols-1 gap-5 sm:mt-10 md:grid-cols-3">
              {introCards.map((card, index) => (
                <motion.article
                  key={card.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: 0.1 * index }}
                  className="intro-zoom-card rounded-2xl border border-[#8B6F47]/15 bg-white p-6 backdrop-blur-sm transition hover:border-[#8B6F47]/35"
                >
                  <div className="card-icon text-[#8B6F47] mb-4 transition-transform duration-300">
                    {card.icon}
                  </div>
                  <h4 className="text-lg font-semibold text-[#8B6F47]">{card.title}</h4>
                  <p className="mt-3 text-sm leading-7 text-[#5A5A5A]">{card.content}</p>
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
