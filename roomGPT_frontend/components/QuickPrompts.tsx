"use client";

import { motion } from "framer-motion";

interface QuickPromptsProps {
  onSelect?: (prompt: string) => void;
}

const quickPrompts = [
  { icon: "🏠", text: "帮我设计客厅装修方案", prompt: "请帮我设计一个客厅的装修方案，包括布局、配色和家具建议" },
  { icon: "🛏️", text: "分析卧室空间利用", prompt: "请分析这个卧室的空间利用情况，给出优化建议" },
  { icon: "🍳", text: "厨房布局优化建议", prompt: "请分析这个厨房的布局，给出优化建议" },
  { icon: "🎨", text: "推荐装修风格", prompt: "请根据我的需求推荐适合的装修风格" },
  { icon: "💰", text: "预算估算方案", prompt: "请帮我估算这个房间的装修预算，包括各项费用" },
  { icon: "📋", text: "列出所需材料清单", prompt: "请列出完成这个装修项目所需的材料清单" },
];

export default function QuickPrompts({ onSelect }: QuickPromptsProps) {
  return (
    <div className="mb-2">
      <div className="flex flex-wrap gap-2">
        {quickPrompts.map((item, index) => (
          <div key={index} className="contents">
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelect?.(item.prompt)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/70 hover:bg-white border border-secondary/20 transition text-xs text-text-secondary hover:text-accent font-body"
            >
              <span>{item.icon}</span>
              <span>{item.text}</span>
            </motion.button>
          </div>
        ))}
      </div>
    </div>
  );
}
