"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RefObject, useEffect, useRef, useState } from "react";
import { isAuthenticated, login, register } from "../../utils/auth";

const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
    <path d="M9.9 5.1A12.8 12.8 0 0 1 12 5c6.5 0 10 7 10 7a18.6 18.6 0 0 1-4.1 5.1" />
    <path d="M6.6 6.6A18.8 18.8 0 0 0 2 12s3.5 7 10 7c1.8 0 3.4-.4 4.9-1.1" />
  </svg>
);

interface PupilProps {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
  forceLookX?: number;
  forceLookY?: number;
}

const Pupil = ({
  size = 12,
  maxDistance = 5,
  pupilColor = "black",
  forceLookX,
  forceLookY,
}: PupilProps) => {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const pupilRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const calculatePupilPosition = () => {
    if (!pupilRef.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }

    const pupil = pupilRef.current.getBoundingClientRect();
    const pupilCenterX = pupil.left + pupil.width / 2;
    const pupilCenterY = pupil.top + pupil.height / 2;

    const deltaX = mouseX - pupilCenterX;
    const deltaY = mouseY - pupilCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);
    const angle = Math.atan2(deltaY, deltaX);

    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
  };

  const pupilPosition = calculatePupilPosition();

  return (
    <div
      ref={pupilRef}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
        transition: "transform 0.1s ease-out",
      }}
    />
  );
};

interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
}

const EyeBall = ({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = "white",
  pupilColor = "black",
  isBlinking = false,
  forceLookX,
  forceLookY,
}: EyeBallProps) => {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const calculatePupilPosition = () => {
    if (!eyeRef.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }

    const eye = eyeRef.current.getBoundingClientRect();
    const eyeCenterX = eye.left + eye.width / 2;
    const eyeCenterY = eye.top + eye.height / 2;

    const deltaX = mouseX - eyeCenterX;
    const deltaY = mouseY - eyeCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);
    const angle = Math.atan2(deltaY, deltaX);

    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
  };

  const pupilPosition = calculatePupilPosition();

  return (
    <div
      ref={eyeRef}
      className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{
        width: `${size}px`,
        height: isBlinking ? "2px" : `${size}px`,
        backgroundColor: eyeColor,
        overflow: "hidden",
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
            transition: "transform 0.1s ease-out",
          }}
        />
      )}
    </div>
  );
};

type AuthMode = "login" | "register";

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dream";

  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);
  const [isBlackBlinking, setIsBlackBlinking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = useState(false);

  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace(redirectTo);
    }
  }, [redirectTo, router]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000;
    const scheduleBlink = () => {
      const blinkTimeout = setTimeout(() => {
        setIsPurpleBlinking(true);
        setTimeout(() => {
          setIsPurpleBlinking(false);
          scheduleBlink();
        }, 150);
      }, getRandomBlinkInterval());
      return blinkTimeout;
    };
    const timeout = scheduleBlink();
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000;
    const scheduleBlink = () => {
      const blinkTimeout = setTimeout(() => {
        setIsBlackBlinking(true);
        setTimeout(() => {
          setIsBlackBlinking(false);
          scheduleBlink();
        }, 150);
      }, getRandomBlinkInterval());
      return blinkTimeout;
    };
    const timeout = scheduleBlink();
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!isTyping) {
      setIsLookingAtEachOther(false);
      return;
    }
    setIsLookingAtEachOther(true);
    const timer = setTimeout(() => {
      setIsLookingAtEachOther(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [isTyping]);

  useEffect(() => {
    if (password.length > 0 && showPassword) {
      const peekTimer = setTimeout(() => {
        setIsPurplePeeking(true);
        setTimeout(() => setIsPurplePeeking(false), 800);
      }, Math.random() * 3000 + 2000);
      return () => clearTimeout(peekTimer);
    }
    setIsPurplePeeking(false);
  }, [password, showPassword, isPurplePeeking]);

  const calculatePosition = (ref: RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 3;
    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;
    const faceX = Math.max(-15, Math.min(15, deltaX / 20));
    const faceY = Math.max(-10, Math.min(10, deltaY / 30));
    const bodySkew = Math.max(-6, Math.min(6, -deltaX / 120));
    return { faceX, faceY, bodySkew };
  };

  const purplePos = calculatePosition(purpleRef);
  const blackPos = calculatePosition(blackRef);
  const yellowPos = calculatePosition(yellowRef);
  const orangePos = calculatePosition(orangeRef);

  const resetMessage = () => {
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessage();
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    if (mode === "login") {
      const result = login(email, password);
      if (!result.ok) {
        setError(result.message);
        setIsLoading(false);
        return;
      }
      router.push(redirectTo);
      return;
    }

    const result = register(name, email, password);
    if (!result.ok) {
      setError(result.message);
      setIsLoading(false);
      return;
    }
    setSuccess(result.message);
    setMode("login");
    setPassword("");
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-[#F5F5F7] via-[#FAFAFA] to-[#FFFFFF] p-12 text-[#1D1D1F] overflow-hidden">
        <div className="relative z-20" />

        <div className="relative z-20 flex items-end justify-center h-[500px]">
          <div className="relative" style={{ width: "550px", height: "400px" }}>
            <div
              ref={purpleRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: "70px",
                width: "180px",
                height: isTyping || (password.length > 0 && !showPassword) ? "440px" : "400px",
                backgroundColor: "#007AFF",
                borderRadius: "10px 10px 0 0",
                zIndex: 1,
                transform:
                  password.length > 0 && showPassword
                    ? "skewX(0deg)"
                    : isTyping || (password.length > 0 && !showPassword)
                    ? `skewX(${(purplePos.bodySkew || 0) - 12}deg) translateX(40px)`
                    : `skewX(${purplePos.bodySkew || 0}deg)`,
                transformOrigin: "bottom center",
              }}
            >
              <div
                className="absolute flex gap-8 transition-all duration-700 ease-in-out"
                style={{
                  left:
                    password.length > 0 && showPassword
                      ? "20px"
                      : isLookingAtEachOther
                      ? "55px"
                      : `${45 + purplePos.faceX}px`,
                  top:
                    password.length > 0 && showPassword
                      ? "35px"
                      : isLookingAtEachOther
                      ? "65px"
                      : `${40 + purplePos.faceY}px`,
                }}
              >
                <EyeBall
                  size={18}
                  pupilSize={7}
                  maxDistance={5}
                  eyeColor="white"
                  pupilColor="#1D1D1F"
                  isBlinking={isPurpleBlinking}
                  forceLookX={
                    password.length > 0 && showPassword
                      ? isPurplePeeking
                        ? 4
                        : -4
                      : isLookingAtEachOther
                      ? 3
                      : undefined
                  }
                  forceLookY={
                    password.length > 0 && showPassword
                      ? isPurplePeeking
                        ? 5
                        : -4
                      : isLookingAtEachOther
                      ? 4
                      : undefined
                  }
                />
                <EyeBall
                  size={18}
                  pupilSize={7}
                  maxDistance={5}
                  eyeColor="white"
                  pupilColor="#1D1D1F"
                  isBlinking={isPurpleBlinking}
                  forceLookX={
                    password.length > 0 && showPassword
                      ? isPurplePeeking
                        ? 4
                        : -4
                      : isLookingAtEachOther
                      ? 3
                      : undefined
                  }
                  forceLookY={
                    password.length > 0 && showPassword
                      ? isPurplePeeking
                        ? 5
                        : -4
                      : isLookingAtEachOther
                      ? 4
                      : undefined
                  }
                />
              </div>
            </div>

            <div
              ref={blackRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: "240px",
                width: "120px",
                height: "310px",
                backgroundColor: "#1D1D1F",
                borderRadius: "8px 8px 0 0",
                zIndex: 2,
                transform:
                  password.length > 0 && showPassword
                    ? "skewX(0deg)"
                    : isLookingAtEachOther
                    ? `skewX(${(blackPos.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
                    : isTyping || (password.length > 0 && !showPassword)
                    ? `skewX(${(blackPos.bodySkew || 0) * 1.5}deg)`
                    : `skewX(${blackPos.bodySkew || 0}deg)`,
                transformOrigin: "bottom center",
              }}
            >
              <div
                className="absolute flex gap-6 transition-all duration-700 ease-in-out"
                style={{
                  left:
                    password.length > 0 && showPassword
                      ? "10px"
                      : isLookingAtEachOther
                      ? "32px"
                      : `${26 + blackPos.faceX}px`,
                  top:
                    password.length > 0 && showPassword
                      ? "28px"
                      : isLookingAtEachOther
                      ? "12px"
                      : `${32 + blackPos.faceY}px`,
                }}
              >
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#1D1D1F"
                  isBlinking={isBlackBlinking}
                  forceLookX={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined}
                  forceLookY={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined}
                />
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#1D1D1F"
                  isBlinking={isBlackBlinking}
                  forceLookX={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined}
                  forceLookY={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined}
                />
              </div>
            </div>

            <div
              ref={orangeRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: "0px",
                width: "240px",
                height: "200px",
                zIndex: 3,
                backgroundColor: "#FF9B6B",
                borderRadius: "120px 120px 0 0",
                transform: password.length > 0 && showPassword ? "skewX(0deg)" : `skewX(${orangePos.bodySkew || 0}deg)`,
                transformOrigin: "bottom center",
              }}
            >
              <div
                className="absolute flex gap-8 transition-all duration-200 ease-out"
                style={{
                  left: password.length > 0 && showPassword ? "50px" : `${82 + (orangePos.faceX || 0)}px`,
                  top: password.length > 0 && showPassword ? "85px" : `${90 + (orangePos.faceY || 0)}px`,
                }}
              >
                <Pupil size={12} maxDistance={5} pupilColor="#1D1D1F" forceLookX={password.length > 0 && showPassword ? -5 : undefined} forceLookY={password.length > 0 && showPassword ? -4 : undefined} />
                <Pupil size={12} maxDistance={5} pupilColor="#1D1D1F" forceLookX={password.length > 0 && showPassword ? -5 : undefined} forceLookY={password.length > 0 && showPassword ? -4 : undefined} />
              </div>
            </div>

            <div
              ref={yellowRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: "310px",
                width: "140px",
                height: "230px",
                backgroundColor: "#FFCC00",
                borderRadius: "70px 70px 0 0",
                zIndex: 4,
                transform: password.length > 0 && showPassword ? "skewX(0deg)" : `skewX(${yellowPos.bodySkew || 0}deg)`,
                transformOrigin: "bottom center",
              }}
            >
              <div
                className="absolute flex gap-6 transition-all duration-200 ease-out"
                style={{
                  left: password.length > 0 && showPassword ? "20px" : `${52 + (yellowPos.faceX || 0)}px`,
                  top: password.length > 0 && showPassword ? "35px" : `${40 + (yellowPos.faceY || 0)}px`,
                }}
              >
                <Pupil size={12} maxDistance={5} pupilColor="#1D1D1F" forceLookX={password.length > 0 && showPassword ? -5 : undefined} forceLookY={password.length > 0 && showPassword ? -4 : undefined} />
                <Pupil size={12} maxDistance={5} pupilColor="#1D1D1F" forceLookX={password.length > 0 && showPassword ? -5 : undefined} forceLookY={password.length > 0 && showPassword ? -4 : undefined} />
              </div>
              <div
                className="absolute w-20 h-[4px] bg-[#1D1D1F] rounded-full transition-all duration-200 ease-out"
                style={{
                  left: password.length > 0 && showPassword ? "10px" : `${40 + (yellowPos.faceX || 0)}px`,
                  top: password.length > 0 && showPassword ? "88px" : `${88 + (yellowPos.faceY || 0)}px`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.45),transparent_45%)]" />
      </div>

      <div className="relative flex items-center justify-center p-8 bg-white">
        <Link href="/" className="absolute top-6 right-6 text-sm font-medium text-[#007AFF] hover:underline">
          返回首页
        </Link>
        <div className="w-full max-w-[420px]">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-[#1D1D1F]">欢迎回来</h1>
            <p className="text-[#86868B] text-sm">登录后即可开始你的理想空间设计</p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-6 bg-white p-1 rounded-xl border border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                resetMessage();
              }}
              className={`h-10 rounded-lg text-sm font-medium transition ${
                mode === "login" ? "bg-[#007AFF] text-white shadow-sm" : "text-[#6E6E73] hover:bg-[#F5F5F7]"
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                resetMessage();
              }}
              className={`h-10 rounded-lg text-sm font-medium transition ${
                mode === "register" ? "bg-[#007AFF] text-white shadow-sm" : "text-[#6E6E73] hover:bg-[#F5F5F7]"
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-[#1D1D1F]">
                  昵称
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="请输入昵称"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full h-11 px-3 rounded-lg border border-[var(--color-border)] bg-white text-[#1D1D1F] placeholder:text-[#86868B] outline-none focus:ring-2 focus:ring-[#007AFF]/40"
                />
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-[#1D1D1F]">
                邮箱
              </label>
              <input
                id="email"
                type="email"
                placeholder="请输入邮箱"
                value={email}
                autoComplete="off"
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                required
                className="w-full h-11 px-3 rounded-lg border border-[var(--color-border)] bg-white text-[#1D1D1F] placeholder:text-[#86868B] outline-none focus:ring-2 focus:ring-[#007AFF]/40"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-[#1D1D1F]">
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-11 px-3 pr-12 rounded-lg border border-[var(--color-border)] bg-white text-[#1D1D1F] placeholder:text-[#86868B] outline-none focus:ring-2 focus:ring-[#007AFF]/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#007AFF]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>
            )}
            {success && (
              <div className="p-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-lg bg-[#007AFF] text-white font-medium hover:bg-[#0056CC] transition-all duration-200 disabled:opacity-70 shadow-sm"
            >
              {isLoading ? "处理中..." : mode === "login" ? "登录" : "注册"}
            </button>
          </form>
          <div className="mt-4 text-center text-sm text-[#86868B]">让每一次空间设计都从安心登录开始</div>
        </div>
      </div>
    </div>
  );
}
