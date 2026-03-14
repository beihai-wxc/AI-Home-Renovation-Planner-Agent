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
    <div className="mb-4 space-y-3">
      <div>
        <p className="text-xs text-white/40 mb-2">房间类型</p>
        <div className="flex flex-wrap gap-2">
          {scenes.map((scene, index) => (
            <motion.button
              key={scene.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelect?.(scene.name)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-sm text-white/70 hover:text-white/90"
            >
              <span className="text-lg">{scene.icon}</span>
              <span>{scene.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-white/40 mb-2">装修风格</p>
        <div className="flex flex-wrap gap-2">
          {styles.map((style, index) => (
            <motion.button
              key={style.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              onClick={() => onSelect?.("", style.name)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-sm text-white/70 hover:text-white/90"
            >
              <span className="text-lg">{style.icon}</span>
              <span>{style.name}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
