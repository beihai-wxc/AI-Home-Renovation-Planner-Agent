"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface HeaderProps {
  variant?: "full" | "minimal";
}

export default function Header({ variant = "full" }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/80 backdrop-blur-md shadow-lg shadow-[#8B6F47]/10 border-b border-[#8B6F47]/10"
          : "bg-transparent"
      }`}
    >
      <div className="flex flex-col xs:flex-row justify-between items-center w-full py-4 sm:px-6 px-4 gap-2 max-w-7xl mx-auto">
        <Link href="/" className="flex space-x-2 group">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Image
              alt="Lumière logo"
              src="/bed.svg"
              className="sm:w-10 sm:h-10 w-9 h-9"
              width={24}
              height={24}
            />
          </motion.div>
          <motion.h1
            className="sm:text-3xl text-xl font-bold ml-2 tracking-tight text-[#2D2D2D] transition-colors duration-300 group-hover:text-[#8B6F47]"
            whileHover={{ scale: 1.02 }}
          >
            Lumière
          </motion.h1>
        </Link>

        {/* 导航链接 - 仅在 full 模式显示 */}
        {variant === "full" && (
          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-medium text-[#5A5A5A] hover:text-[#8B6F47] transition-colors duration-300 link-underline"
            >
              首页
            </Link>
            <Link
              href="/dream"
              className="text-sm font-medium text-[#5A5A5A] hover:text-[#8B6F47] transition-colors duration-300 link-underline"
            >
              设计空间
            </Link>
            <Link
              href="/#about"
              className="text-sm font-medium text-[#5A5A5A] hover:text-[#8B6F47] transition-colors duration-300 link-underline"
            >
              关于我们
            </Link>
          </nav>
        )}

        <div className="text-[#8A8A8A] text-sm hidden sm:block">
          让每个家都有温度
        </div>
      </div>
    </header>
  );
}