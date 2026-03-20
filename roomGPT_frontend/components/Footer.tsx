import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    {
      title: "产品",
      links: [
        { href: "/dream", label: "设计空间" },
        { href: "/#about", label: "功能介绍" },
      ],
    },
    {
      title: "支持",
      links: [
        { href: "/#about", label: "使用帮助" },
        { href: "/#about", label: "常见问题" },
      ],
    },
    {
      title: "关于",
      links: [
        { href: "/#about", label: "关于我们" },
        { href: "/#about", label: "隐私政策" },
      ],
    },
  ];

  return (
    <footer className="bg-apple-gray-100 border-t border-apple-gray-200">
      <div className="max-w-[980px] mx-auto px-6 py-12">
        {/* Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Section */}
          <div className="md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <svg
                className="w-6 h-6 text-apple-black"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <span className="text-sm font-semibold text-apple-black">
                Lumière
              </span>
            </div>
            <p className="text-xs text-apple-gray-500 leading-relaxed">
              让每个家都有温度
            </p>
          </div>

          {/* Links Sections */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-apple-black mb-4">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-xs text-apple-gray-500 hover:text-apple-black transition-colors duration-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-apple-gray-200 my-8" />

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-xs text-apple-gray-400">
            © {currentYear} Lumière. 保留所有权利。
          </div>

          <div className="flex items-center space-x-6">
            <Link
              href="/#about"
              className="text-xs text-apple-gray-400 hover:text-apple-black transition-colors duration-300"
            >
              隐私政策
            </Link>
            <Link
              href="/#about"
              className="text-xs text-apple-gray-400 hover:text-apple-black transition-colors duration-300"
            >
              使用条款
            </Link>
            <Link
              href="/#about"
              className="text-xs text-apple-gray-400 hover:text-apple-black transition-colors duration-300"
            >
              联系我们
            </Link>
          </div>
        </div>

        {/* Made with Love */}
        <div className="mt-8 text-center">
          <p className="text-xs text-apple-gray-400">
            由 <span className="font-medium text-apple-gray-500">Lumière</span>{" "}
            强力驱动
          </p>
        </div>
      </div>
    </footer>
  );
}