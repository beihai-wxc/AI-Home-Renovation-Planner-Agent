"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import Footer from "../components/Footer";
import Header from "../components/Header";
import LumiereIntro from "../components/LumiereIntro";
import PairedCarousel, { PairedSlide } from "../components/PairedCarousel";

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

const features = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    title: "智能空间分析",
    description: "精准识别房间布局、采光条件和现有结构，为改造提供科学依据。",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: "个性化方案",
    description: "根据您的偏好、预算和生活方式，生成专属的设计方案。",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: "效果图生成",
    description: "一键生成高质量改造效果图，让您提前预见理想家居。",
  },
];

const agentShowcase = [
  {
    name: "视觉评估师",
    role: "空间分析专家",
    description: "识别房间布局、采光、问题点与可保留结构，也能吸收灵感图里的风格语言。",
    icon: "🔍",
  },
  {
    name: "设计规划师",
    role: "方案生成专家",
    description: "把预算、材料、配色和功能诉求整理成清晰可执行的设计方案。",
    icon: "📋",
  },
  {
    name: "项目协调员",
    role: "整合输出专家",
    description: "整合前两位智能体的结果，输出装修路线、行动建议，并生成最终效果图。",
    icon: "⚙️",
  },
];

export default function HomePage() {
  const [showIntro, setShowIntro] = useState(true);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  };

  return (
    <div className="apple-gradient-bg min-h-screen">
      {showIntro && <LumiereIntro onComplete={() => setShowIntro(false)} />}
      <Header />
      
      <main>
        {/* Hero Section */}
        <section className="apple-section apple-hero-bg">
          <div className="apple-container">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="text-center"
            >
              <motion.h1
                variants={itemVariants}
                className="text-hero-xl font-semibold apple-text-gradient mb-6"
              >
                把你的家变成
                <br />
                <span className="text-apple-blue">理想的样子</span>
              </motion.h1>
              
              <motion.p
                variants={itemVariants}
                className="text-xl text-apple-gray-500 max-w-2xl mx-auto mb-8 leading-relaxed"
              >
                上传房间照片，预览改造效果。
                <br />
                先看效果，再做决定，让装修方案更有把握。
              </motion.p>

              <motion.div variants={itemVariants}>
                <Link
                  href="/dream"
                  className="apple-btn apple-btn-primary inline-flex items-center space-x-2 text-lg px-8 py-4"
                >
                  <span>开始设计你的空间</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="apple-section bg-white">
          <div className="apple-container">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <h2 className="text-hero-md font-semibold apple-text-gradient mb-4">
                强大的 AI 设计能力
              </h2>
              <p className="text-lg text-apple-gray-500 max-w-xl mx-auto">
                三个专业智能体协作，从分析到出图，一站式解决您的装修设计需求。
              </p>
            </motion.div>

            <div className="apple-grid apple-grid-3">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="apple-card p-8 text-center group"
                >
                  <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-apple-gray-100 flex items-center justify-center text-apple-blue group-hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-apple-black mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-apple-gray-500 leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Agent Showcase Section */}
        <section className="apple-section bg-apple-gray-100">
          <div className="apple-container">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <h2 className="text-hero-md font-semibold apple-text-gradient mb-4">
                多智能体协作系统
              </h2>
              <p className="text-lg text-apple-gray-500 max-w-xl mx-auto">
                从房间分析到效果图生成，3 个 Agent 各司其职，专业分工协作。
              </p>
            </motion.div>

            <div className="apple-grid apple-grid-3">
              {agentShowcase.map((agent, index) => (
                <motion.div
                  key={agent.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="apple-card p-8 text-center"
                >
                  <div className="text-4xl mb-4">{agent.icon}</div>
                  <div className="text-xs font-medium text-apple-blue mb-2 uppercase tracking-wider">
                    {agent.role}
                  </div>
                  <h3 className="text-lg font-semibold text-apple-black mb-3">
                    {agent.name}
                  </h3>
                  <p className="text-sm text-apple-gray-500 leading-relaxed">
                    {agent.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Gallery Section */}
        <section className="apple-section bg-white">
          <div className="apple-container">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <h2 className="text-hero-md font-semibold apple-text-gradient mb-4">
                看看改造效果
              </h2>
              <p className="text-lg text-apple-gray-500 max-w-xl mx-auto">
                真实案例展示，看看 AI 如何将普通空间变成理想家居。
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <PairedCarousel pairs={pairedSlides} interval={4000} />
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="about" className="apple-section bg-apple-black">
          <div className="apple-container">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center"
            >
              <h2 className="text-hero-md font-semibold text-white mb-6">
                准备好改造你的家了吗？
              </h2>
              <p className="text-lg text-apple-gray-400 max-w-xl mx-auto mb-8">
                上传一张房间照片，让 AI 帮你预见理想家居的样子。
              </p>
              <Link
                href="/dream"
                className="apple-btn bg-white text-apple-black hover:bg-apple-gray-100 inline-flex items-center space-x-2 text-lg px-8 py-4"
              >
                <span>免费开始设计</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}