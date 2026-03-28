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
      if (!menuRef.current) return;
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
          ? "bg-accent shadow-soft"
          : "bg-accent"
      }`}
    >
      <div className="flex flex-col xs:flex-row justify-between items-center w-full py-5 sm:px-6 px-5 gap-3 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-3 group">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 3 }}
            transition={{ type: "spring", stiffness: 400, damping: 12 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-primary/30 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Image
              alt="Lumière logo"
              src="/bed.svg"
              className="relative w-10 h-10 sm:w-11 sm:h-11"
              width={24}
              height={24}
            />
          </motion.div>
          <motion.h1
            className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-primary transition-colors duration-300 group-hover:text-secondary"
            whileHover={{ scale: 1.02 }}
          >
            Lumière
          </motion.h1>
        </Link>

        {/* 导航链接 - 仅在 full 模式显示 */}
        {variant === "full" && (
          <nav className="flex items-center gap-8">
            <Link
              href="/"
              className="font-body text-sm font-medium text-primary/80 hover:text-primary transition-colors duration-300 link-animated"
            >
              首页
            </Link>
            <Link
              href={isLoggedIn ? "/dream" : "/auth?redirect=/dream"}
              className="font-body text-sm font-medium text-primary/80 hover:text-primary transition-colors duration-300 link-animated"
            >
              设计空间
            </Link>
            <Link
              href="/#about"
              className="font-body text-sm font-medium text-primary/80 hover:text-primary transition-colors duration-300 link-animated"
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
              className="inline-flex items-center gap-3 rounded-xl border border-secondary/30 bg-primary px-5 py-2.5 text-sm font-medium text-accent transition-all hover:bg-surface-2 hover:border-secondary font-body"
            >
              <span className="max-w-[140px] truncate">{currentUserName}</span>
              <svg
                className={`h-4 w-4 transition-transform duration-300 ${menuOpen ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 z-50 mt-3 w-48 overflow-hidden rounded-2xl border border-secondary bg-white shadow-soft-lg"
              >
                <Link
                  href="/dream"
                  onClick={() => setMenuOpen(false)}
                  className="block px-5 py-3 text-sm font-body text-accent transition-colors hover:bg-secondary/10"
                >
                  进入设计空间
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full px-5 py-3 text-left text-sm font-body text-accent transition-colors hover:bg-secondary/10"
                >
                  退出账号
                </button>
              </motion.div>
            )}
          </div>
        ) : (
          <Link
            href="/auth?redirect=/dream"
            className="hidden sm:inline-flex items-center rounded-xl border border-secondary/30 bg-primary px-6 py-2.5 text-sm font-medium text-accent hover:bg-surface-2 hover:border-secondary transition-all font-body"
          >
            登录
          </Link>
        )}
      </div>
    </header>
  );
}
