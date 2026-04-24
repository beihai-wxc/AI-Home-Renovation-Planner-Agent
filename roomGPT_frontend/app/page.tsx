"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import Footer from "../components/Footer";
import Header from "../components/Header";
import LumiereIntro from "../components/LumiereIntro";
import PairedCarousel, { PairedSlide } from "../components/PairedCarousel";
import { getCurrentUser } from "../utils/auth";

const pairedSlides: PairedSlide[] = [
  { beforeSrc: "/pic/pic1_before.jpg", afterSrc: "/pic/pic1_after.jpg", beforeAlt: "原始房间示例图 1", afterAlt: "生成后的房间示例图 1" },
  { beforeSrc: "/pic/pic2_before.jpg", afterSrc: "/pic/pic2_after.jpg", beforeAlt: "原始房间示例图 2", afterAlt: "生成后的房间示例图 2" },
  { beforeSrc: "/pic/pic3_before.jpg", afterSrc: "/pic/pic3_after.jpg", beforeAlt: "原始房间示例图 3", afterAlt: "生成后的房间示例图 3" },
  { beforeSrc: "/pic/pic4_before.jpg", afterSrc: "/pic/pic4_after.jpg", beforeAlt: "原始房间示例图 4", afterAlt: "生成后的房间示例图 4" },
  { beforeSrc: "/pic/pic5_before.jpg", afterSrc: "/pic/pic5_after.jpg", beforeAlt: "原始房间示例图 5", afterAlt: "生成后的房间示例图 5" },
  { beforeSrc: "/pic/pic6_before.jpg", afterSrc: "/pic/pic6_after.jpg", beforeAlt: "原始房间示例图 6", afterAlt: "生成后的房间示例图 6" },
  { beforeSrc: "/pic/pic7_before.jpg", afterSrc: "/pic/pic7_after.jpg", beforeAlt: "原始房间示例图 7", afterAlt: "生成后的房间示例图 7" },
];

const introCards = [
  {
    title: "你为什么需要 Lumière",
    content:
      "装修前最难的是提前看见结果，也很难把模糊想法讲清楚。这个项目希望把灵感更早变成可以讨论的可视化方案。",
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: "你最终会得到什么",
    content:
      "你会拿到效果图、设计建议、风格方向和下一步行动思路，让装修讨论更具体，也更容易推进落地。",
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20 20l-3.5-3.5" />
      </svg>
    ),
  },
  {
    name: "设计规划师",
    title: "生成风格方案",
    description: "把预算、材料、配色和功能诉求整理成清晰可执行的设计方案，而不是一句模糊建议。",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5h11M9 12h11M9 19h11" />
        <circle cx="4" cy="5" r="1.3" fill="currentColor" />
        <circle cx="4" cy="12" r="1.3" fill="currentColor" />
        <circle cx="4" cy="19" r="1.3" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "项目协调员",
    title: "汇总并出效果图",
    description: "整合前两位智能体的结果，输出装修路线、行动建议，并生成最终的改造效果图。",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 7h16M4 12h16M4 17h16" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 4v6M16 10v6M12 14v6" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const [showIntro, setShowIntro] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // 检查是否已经播放过开屏动画
    if (!sessionStorage.getItem("lumiere_intro_seen")) {
      setShowIntro(true);
      sessionStorage.setItem("lumiere_intro_seen", "true");
    }

    const sync = () => setIsLoggedIn(Boolean(getCurrentUser()));
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  return (
    <div className="home-background lux-shell relative min-h-screen overflow-x-hidden text-text-primary">
      {showIntro && <LumiereIntro onComplete={() => setShowIntro(false)} />}
      <Header />

      <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <section className="grid min-h-[calc(100vh-8rem)] items-center gap-9 lg:grid-cols-[1.3fr_0.9fr]">
          <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}>
            <span className="lux-tag">AI 设计助手</span>
            <h1 className="font-body mt-5 max-w-4xl text-5xl font-semibold leading-[1.02] text-accent sm:text-6xl md:text-7xl">
              开工之前
              <br />
              <span className="font-display text-gradient">&nbsp;&nbsp;&nbsp;&nbsp;先看见空间方案</span>
            </h1>
            <p className="mt-6 max-w-2xl font-body text-base leading-8 text-text-secondary sm:text-lg">
              上传房间图,AI生成空间分析、设计方案和效果图。
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link className="btn-primary" href={isLoggedIn ? "/dream" : "/auth?redirect=/dream"}>
                立即免费设计
              </Link>
              <Link href="#case-showcase" className="inline-flex items-center gap-2 rounded-full border border-[rgba(93,74,50,0.22)] bg-[rgba(255,250,243,0.72)] px-5 py-3 text-sm font-semibold text-accent transition-all duration-300 hover:-translate-y-0.5 hover:bg-[rgba(255,250,243,0.9)] hover:shadow-soft">
                查看案例
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17l10-10M10 7h7v7" />
                </svg>
              </Link>
            </div>
          </motion.div>

          <motion.aside initial={{ opacity: 0, y: 34 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.14, ease: [0.22, 1, 0.36, 1] }} className="lux-panel lux-grain relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(175,135,80,0.42),transparent_72%)]" />
            <p className="text-xs uppercase tracking-[0.2em] text-text-secondary">Design Outcome</p>
            <h2 className="font-body mt-4 text-3xl font-semibold text-accent">一次上传，生成完整设计结果</h2>
            <div className="mt-7 space-y-4">
              {[
                "空间分析：结构 · 动线 · 采光",
                "设计方案：风格 · 预算 · 材料",
                "效果图生成：可继续微调",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-[rgba(93,74,50,0.18)] bg-[rgba(255,250,242,0.72)] px-4 py-3 text-sm text-text-secondary">
                  {item}
                </div>
              ))}
            </div>
          </motion.aside>
        </section>

        <motion.section id="agent-workflow" initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="mb-20 py-10">
          <div className="flex items-end justify-between gap-6">
            <div>
              <span className="lux-tag">Multi-Agent Workflow</span>
              <h2 className="font-body mt-4 text-4xl font-semibold leading-tight text-accent sm:text-5xl">从识别空间到生成效果图</h2>
            </div>
            <p className="hidden max-w-sm text-sm leading-7 text-text-secondary lg:block">
              每个 Agent 都有明确职责，协作过程可视化，避免“黑盒式”结果输出。
            </p>
          </div>
          <div className="lux-divider mt-7 h-px w-full" />

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {agentShowcase.map((agent, index) => (
              <motion.article key={agent.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.6, delay: index * 0.1 }} className="card-modern p-6">
                <div className="flex items-start justify-between">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(93,74,50,0.2)] bg-[rgba(255,251,245,0.85)] text-accent">
                    {agent.icon}
                  </span>
                  <span className="text-xs uppercase tracking-[0.18em] text-text-tertiary">0{index + 1}</span>
                </div>
                <h3 className="font-body mt-6 text-2xl font-semibold text-accent">{agent.name}</h3>
                <p className="mt-1 text-sm font-semibold text-[#8a6b46]">{agent.title}</p>
                <p className="mt-4 text-sm leading-7 text-text-secondary">{agent.description}</p>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section id="case-showcase" initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }} className="mb-20 py-4">
          <PairedCarousel pairs={pairedSlides} interval={4200} />
        </motion.section>

        <section id="about" className="pb-10">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.7 }} className="mx-auto max-w-3xl text-center">
            <span className="lux-tag">About Lumière</span>
            <h2 className="font-body mt-5 text-4xl font-semibold text-accent sm:text-5xl">让装修决策更快、更稳、更可讨论</h2>
            <p className="mt-5 text-base leading-8 text-text-secondary">
              我们把“看见效果”和“理解代价”放在同一个流程里，让你在开工前就能把方向说清楚。
            </p>
          </motion.div>

          <div className="mx-auto mt-10 grid max-w-6xl gap-5 md:grid-cols-3">
            {introCards.map((card, index) => (
              <motion.article key={card.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.6, delay: index * 0.12 }} className="card-modern p-7">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(93,74,50,0.2)] bg-[rgba(255,251,244,0.78)] text-accent">
                  {card.icon}
                </div>
                <h3 className="font-body mt-5 text-2xl font-semibold text-accent">{card.title}</h3>
                <p className="mt-4 text-sm leading-7 text-text-secondary">{card.content}</p>
              </motion.article>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
