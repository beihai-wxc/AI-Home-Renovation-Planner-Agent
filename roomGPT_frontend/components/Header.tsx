"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { getCurrentUser, logout } from "../utils/auth";

interface HeaderProps {
  variant?: "full" | "minimal";
}

export default function Header({ variant = "full" }: HeaderProps) {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserName, setCurrentUserName] = useState("用户");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const sync = () => {
      const user = getCurrentUser();
      setIsLoggedIn(Boolean(user));
      setCurrentUserName(user?.name || "用户");
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", closeOnOutsideClick);
    return () => window.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    setIsLoggedIn(false);
    setCurrentUserName("用户");
    router.push("/");
  };

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
              href={isLoggedIn ? "/dream" : "/auth?redirect=/dream"}
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

        {isLoggedIn ? (
          <div ref={menuRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#8B6F47]/25 bg-white/70 px-4 py-2 text-sm font-medium text-[#6B6459] transition-colors hover:bg-white hover:text-[#8B6F47]"
            >
              <span className="max-w-[120px] truncate">{currentUserName}</span>
              <svg className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-[#8B6F47]/15 bg-white/95 shadow-lg backdrop-blur">
                <Link
                  href="/dream"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-[#5A5A5A] transition-colors hover:bg-[#F6EFE4] hover:text-[#8B6F47]"
                >
                  进入设计空间
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full px-4 py-2 text-left text-sm text-[#5A5A5A] transition-colors hover:bg-[#F6EFE4] hover:text-[#8B6F47]"
                >
                  退出账号
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/auth?redirect=/dream"
            className="hidden sm:inline-flex items-center rounded-lg border border-[#8B6F47]/25 bg-white/70 px-4 py-2 text-sm font-medium text-[#6B6459] hover:bg-white hover:text-[#8B6F47] transition-colors"
          >
            登录
          </Link>
        )}
      </div>
    </header>
  );
}
