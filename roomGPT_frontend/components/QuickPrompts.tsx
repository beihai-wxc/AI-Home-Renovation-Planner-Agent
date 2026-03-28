"use client";

import { motion } from "framer-motion";

interface QuickPromptsProps {
  onSelect?: (prompt: string) => void;
  onSceneToggle?: () => void;
  sceneActive?: boolean;
}

const quickPrompts = [
  { icon: "🏠", text: "帮我设计客厅装修方案", prompt: "请帮我设计一个客厅的装修方案，包括布局、配色和家具建议" },
  { icon: "🛏️", text: "分析卧室空间利用", prompt: "请分析这个卧室的空间利用情况，给出优化建议" },
  { icon: "🍳", text: "厨房布局优化建议", prompt: "请分析这个厨房的布局，给出优化建议" },
  { icon: "🎨", text: "推荐装修风格", prompt: "请根据我的需求推荐适合的装修风格" },
  { icon: "💰", text: "预算估算方案", prompt: "请帮我估算这个房间的装修预算，包括各项费用" },
  { icon: "📋", text: "列出所需材料清单", prompt: "请列出完成这个装修项目所需的材料清单" },
];

export default function QuickPrompts({ onSelect, onSceneToggle, sceneActive }: QuickPromptsProps) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((item, index) => (
            <div key={index} className="contents">
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onSelect?.(item.prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#fcf9f8] hover:bg-white border border-[#bdb3a5]/20 transition text-xs text-[#4e3c30] hover:text-[#8B6F47] font-body"
              >
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </motion.button>
            </div>
          ))}
        </div>
        {onSceneToggle && (
          <button
            type="button"
            onClick={onSceneToggle}
            className={`px-4 py-2 rounded-full text-xs font-medium transition ${
              sceneActive
                ? "bg-[#7A9E7E] text-white shadow-md"
                : "bg-[#fcf9f8] text-[#5C7B60] hover:bg-[#f0e8dc]"
            }`}
          >
            场景选择
          </button>
        )}
      </div>
    </div>
  );
}
