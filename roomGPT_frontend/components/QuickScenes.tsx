"use client";

import { motion } from "framer-motion";

interface QuickScenesProps {
  onSelect?: (scene: string, style?: string) => void;
}

const scenes = [
  { icon: "🛋️", name: "客厅", id: "living_room" },
  { icon: "🛏️", name: "卧室", id: "bedroom" },
  { icon: "🍳", name: "厨房", id: "kitchen" },
  { icon: "🚿", name: "卫生间", id: "bathroom" },
  { icon: "📚", name: "书房", id: "study" },
  { icon: "🌿", name: "阳台", id: "balcony" },
  { icon: "🍽", name: "餐厅", id: "dining_room" },
  { icon: "🎥", name: "娱乐室", id: "entertainment" },
];

const styles = [
  { icon: "🏢", name: "现代简约", id: "modern" },
  { icon: "🏔", name: "北欧风", id: "nordic" },
  { icon: "🏮", name: "新中式", id: "chinese" },
  { icon: "🏛️", name: "美式", id: "american" },
  { icon: "🎨", name: "ins风", id: "industrial" },
];

export default function QuickScenes({ onSelect }: QuickScenesProps) {
  return (
    <div className="mb-3 space-y-2.5">
      <div>
        <p className="text-xs text-[#8A8A8A] mb-2">房间类型</p>
        <div className="flex flex-wrap gap-1.5">
          {scenes.map((scene, index) => (
            <motion.button
              key={scene.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelect?.(scene.name)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/70 hover:bg-white border border-[#8B6F47]/20 transition text-xs text-[#5A5A5A] hover:text-[#2D2D2D]"
            >
              <span className="text-base">{scene.icon}</span>
              <span>{scene.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-[#8A8A8A] mb-2">装修风格</p>
        <div className="flex flex-wrap gap-1.5">
          {styles.map((style, index) => (
            <motion.button
              key={style.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              onClick={() => onSelect?.("", style.name)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/70 hover:bg-white border border-[#8B6F47]/20 transition text-xs text-[#5A5A5A] hover:text-[#2D2D2D]"
            >
              <span className="text-base">{style.icon}</span>
              <span>{style.name}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
