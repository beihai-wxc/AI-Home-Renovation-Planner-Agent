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
    beforeSrc: "/pic/pic1_before.jpg",
    afterSrc: "/pic/pic1_after.jpg",
    beforeAlt: "原始房间示例图 1",
    afterAlt: "生成后的房间示例图 1",
  },
  {
    beforeSrc: "/pic/pic2_before.jpg",
    afterSrc: "/pic/pic2_after.jpg",
    beforeAlt: "原始房间示例图 2",
    afterAlt: "生成后的房间示例图 2",
  },
  {
    beforeSrc: "/pic/pic3_before.jpg",
    afterSrc: "/pic/pic3_after.jpg",
    beforeAlt: "原始房间示例图 3",
    afterAlt: "生成后的房间示例图 3",
  },
  {
    beforeSrc: "/pic/pic4_before.jpg",
    afterSrc: "/pic/pic4_after.jpg",
    beforeAlt: "原始房间示例图 4",
    afterAlt: "生成后的房间示例图 4",
  },
  {
    beforeSrc: "/pic/pic5_before.jpg",
    afterSrc: "/pic/pic5_after.jpg",
    beforeAlt: "原始房间示例图 5",
    afterAlt: "生成后的房间示例图 5",
  },
  {
    beforeSrc: "/pic/pic6_before.jpg",
    afterSrc: "/pic/pic6_after.jpg",
    beforeAlt: "原始房间示例图 6",
    afterAlt: "生成后的房间示例图 6",
  },
  {
    beforeSrc: "/pic/pic7_before.jpg",
    afterSrc: "/pic/pic7_after.jpg",
    beforeAlt: "原始房间示例图 7",
    afterAlt: "生成后的房间示例图 7",
  },
];

const introCards = [
  {
    title: "你为什么需要 Lumière",
    content:
      "装修前最难的是提前看见结果，也很难把模糊想法讲清楚。这个项目希望把灵感更早变成可以讨论的可视化方案。",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="6" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "它如何工作",
    content:
      "上传当前房间图和灵感图后，多个 Agent 会分工完成空间分析、方案规划和结果汇总，而不是只返回一句泛泛建议。",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: "你最终会得到什么",
    content:
      "你会拿到效果图、设计建议、风格方向和下一步行动思路，让装修讨论更具体，也更容易推进落地。",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
    bg: "bg-secondary/10",
  },
  {
    name: "设计规划师",
    title: "生成风格方案",
    description: "把预算、材料、配色和功能诉求整理成清晰可执行的设计方案，而不是一句模糊建议。",
    icon: "📋",
    bg: "bg-secondary/10",
  },
  {
    name: "项目协调员",
    title: "汇总并出效果图",
    description: "整合前两位智能体的结果，输出装修路线、行动建议，并生成最终的改造效果图。",
    icon: "⚙️",
    bg: "bg-secondary/10",
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
    <div className="home-background relative min-h-screen flex flex-col overflow-x-hidden">
      {showIntro && <LumiereIntro onComplete={() => setShowIntro(false)} />}
      <Header />

      <main className="relative w-full flex-1 px-6">
        {/* Hero Section */}
        <section className="relative mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-7xl flex-col items-center justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <p className="text-sm font-medium tracking-[0.2em] uppercase text-text-secondary mb-6">
              AI 智能家装规划师
            </p>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="font-display mx-auto max-w-5xl text-center text-4xl font-semibold leading-[1.1] tracking-tight text-accent sm:text-6xl md:text-7xl"
          >
            把你的家变成{" "}
            <span className="relative inline-block">
              <SquigglyLines />
              <span className="relative text-gradient">理想的样子</span>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="font-body mx-auto mt-8 max-w-2xl text-center text-lg leading-relaxed text-text-secondary sm:text-xl"
          >
            上传房间照片，预览改造效果。先看效果，再做决定，
            <br className="hidden sm:block" />
            让装修方案更有把握。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link
              className="btn-primary mt-10"
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
                if (!target) return;
                const headerOffset = 88;
                const targetTop = target.getBoundingClientRect().top + window.scrollY - headerOffset;
                window.scrollTo({
                  top: Math.max(0, targetTop),
                  behavior: "smooth",
                });
              }}
              className="absolute bottom-12 left-[calc(50%-40px)] z-10 flex -translate-x-1/2 select-none items-center justify-center text-[#8B6F47] transition-all hover:scale-105 hover:text-[#6E532F]"
              aria-label="下拉了解我们"
            >
              <motion.svg
                className="h-20 w-20"
                viewBox="0 0 72 72"
                fill="none"
                stroke="currentColor"
                animate={{ y: [0, 8, 0], opacity: [0.78, 1, 0.78] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={5} d="M18 24l18 18 18-18" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={5} d="M18 40l18 18 18-18" opacity="0.6" />
              </motion.svg>
            </motion.button>
          )}
        </section>

        {/* Agent Workflow Section */}
        <motion.section
          id="agent-workflow"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mb-20 w-full max-w-6xl py-10"
        >
          <div className="card-modern p-8 md:p-10">
            <div className="grid gap-8 text-left lg:grid-cols-[1.3fr_0.9fr] lg:items-start">
              <div>
                <p className="text-xs font-semibold tracking-[0.25em] uppercase text-text-secondary">
                  Multi-Agent Workflow
                </p>
                <h2 className="font-display mt-4 text-3xl font-semibold leading-tight text-accent sm:text-4xl">
                  从房间分析到效果图生成<br className="hidden sm:block" />
                  3 个 Agent 各司其职
                </h2>
              </div>
              <div className="lg:pt-12">
                <p className="font-body text-base leading-8 text-text-secondary">
                  从看懂你的房间，到生成方案，再到输出效果图，整个过程由分工明确的智能体协作完成。
                </p>
              </div>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {agentShowcase.map((agent, index) => (
                <motion.article
                  key={agent.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.35 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="card-modern p-6 text-left"
                >
                  <div className={`absolute inset-x-0 top-0 h-28 ${agent.bg}`} />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-soft">
                          {agent.icon}
                        </div>
                        <h3 className="font-display text-xl font-semibold text-accent">
                          {agent.name}
                        </h3>
                      </div>
                      <span className="text-[11px] font-semibold tracking-widest uppercase text-text-secondary">
                        0{index + 1}
                      </span>
                    </div>
                    <h4 className="font-display mt-12 text-2xl font-semibold leading-tight text-accent">
                      {agent.title}
                    </h4>
                    <p className="font-body mt-4 text-base leading-7 text-text-secondary">
                      {agent.description}
                    </p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Carousel Section */}
        <motion.section
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mb-20 w-full max-w-7xl py-10"
        >
          <PairedCarousel pairs={pairedSlides} interval={4000} />
        </motion.section>

        {/* About Section */}
        <section id="about" className="mx-auto mb-16 w-full max-w-7xl px-6 pb-10 sm:pb-16">
          <div className="mx-auto max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <h2 className="font-display text-3xl font-semibold text-accent sm:text-4xl">
                这个项目能帮你什么
              </h2>
              <p className="font-body mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary">
                它想解决的是装修前"看不见、说不清、难落地"的问题，
                把灵感更早变成可以讨论的方案。
              </p>
            </motion.div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {introCards.map((card, index) => (
                <motion.article
                  key={card.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
                  className="card-modern p-8 text-left"
                >
                  <div className="mb-5 text-accent">{card.icon}</div>
                  <h3 className="font-display text-xl font-semibold text-accent">
                    {card.title}
                  </h3>
                  <p className="font-body mt-4 text-base leading-7 text-text-secondary">
                    {card.content}
                  </p>
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
