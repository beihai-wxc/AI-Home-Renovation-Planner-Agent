"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type FloorplanRoom = {
  id: string;
  name: string;
  roomType?: string;
  bbox: [number, number, number, number];
  dimensions?: {
    length?: string;
    width?: string;
    height?: string;
    unit?: string;
  };
  userRequirements?: string;
  isUserEdited?: boolean;
  isUserCreated?: boolean;
  generationStatus?: "pending" | "processing" | "completed" | "failed";
  description?: string;
  designPrompt?: string;
  imageUrl?: string;
};

type FloorplanAnalysis = {
  phase?: "analysis" | "generation";
  sourceImageUrl?: string;
  zoomedFloorplanUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  summary?: string;
  generation?: {
    started: boolean;
    status: "idle" | "processing" | "completed" | "partial" | "failed";
    currentBatch: number;
    totalBatches: number;
    completedRooms: number;
    totalRooms: number;
  };
  rooms: FloorplanRoom[];
};

interface FloorplanAnalysisCardProps {
  analysis: FloorplanAnalysis;
  activeRoomId?: string;
  onActiveRoomChange?: (roomId: string) => void;
  onPreviewImage?: (url: string, title: string) => void;
  onSaveRooms?: (rooms: FloorplanRoom[]) => Promise<void>;
  onStartGeneration?: (rooms: FloorplanRoom[]) => Promise<void>;
  isBusy?: boolean;
}

const ROOM_TYPE_OPTIONS = ["客厅", "卧室", "厨房", "餐厅", "阳台", "卫生间", "书房", "玄关", "空间"];

function createEmptyRoom(index: number, bbox: [number, number, number, number]): FloorplanRoom {
  return {
    id: `user-room-${Date.now()}-${index}`,
    name: `补充空间${index}`,
    roomType: "空间",
    bbox,
    dimensions: { length: "", width: "", height: "", unit: "m" },
    userRequirements: "",
    isUserEdited: true,
    isUserCreated: true,
    generationStatus: "pending",
    imageUrl: undefined,
    description: undefined,
    designPrompt: undefined,
  };
}

export default function FloorplanAnalysisCard({
  analysis,
  activeRoomId: controlledActiveRoomId,
  onActiveRoomChange,
  onPreviewImage,
  onSaveRooms,
  onStartGeneration,
  isBusy = false,
}: FloorplanAnalysisCardProps) {
  const [draftRooms, setDraftRooms] = useState<FloorplanRoom[]>(analysis.rooms || []);
  const [internalActiveRoomId, setInternalActiveRoomId] = useState<string>((analysis.rooms || [])[0]?.id || "");
  const [isEditing, setIsEditing] = useState((analysis.phase || "analysis") !== "generation");
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [draftBox, setDraftBox] = useState<[number, number, number, number] | null>(null);
  const activeRoomId = controlledActiveRoomId ?? internalActiveRoomId;

  const selectRoom = useCallback((roomId: string) => {
    setInternalActiveRoomId(roomId);
    onActiveRoomChange?.(roomId);
  }, [onActiveRoomChange]);

  useEffect(() => {
    setDraftRooms(analysis.rooms || []);
    setIsEditing((analysis.phase || "analysis") !== "generation");
  }, [analysis]);

  const preloadImages = () => {
    analysis.rooms?.forEach((room) => {
      if (room.imageUrl) {
        const img = new window.Image();
        img.src = room.imageUrl;
      }
    });
  };

  useEffect(() => {
    if (analysis.phase === "generation" || analysis.generation?.started) {
      preloadImages();
    }
  }, [analysis.rooms, analysis.phase, analysis.generation?.started]);

  useEffect(() => {
    const rooms = analysis.rooms || [];
    if (!rooms.length) {
      selectRoom("");
      return;
    }
    if (activeRoomId && rooms.some((room) => room.id === activeRoomId)) {
      return;
    }
    selectRoom(rooms[0]?.id || "");
  }, [analysis.rooms, activeRoomId, selectRoom]);

  const activeRoom = useMemo(
    () => draftRooms.find((room) => room.id === activeRoomId) || draftRooms[0],
    [activeRoomId, draftRooms]
  );

  const isGenerationPhase = (analysis.phase || "analysis") === "generation" || Boolean(analysis.generation?.started);

  const updateRoom = (roomId: string, patch: Partial<FloorplanRoom>) => {
    setDraftRooms((prev) =>
      prev.map((room) =>
        room.id === roomId
          ? { ...room, ...patch, isUserEdited: true }
          : room
      )
    );
  };

  const handleSave = async () => {
    if (!onSaveRooms) return;
    setSaving(true);
    try {
      await onSaveRooms(draftRooms);
    } finally {
      setSaving(false);
    }
  };

  const handleStartGeneration = async () => {
    if (!onStartGeneration) return;
    setSaving(true);
    try {
      await onStartGeneration(draftRooms);
    } finally {
      setSaving(false);
    }
  };

  const removeActiveRoom = () => {
    if (!activeRoom) return;
    const next = draftRooms.filter((room) => room.id !== activeRoom.id);
    setDraftRooms(next);
    selectRoom(next[0]?.id || "");
  };

  const toNormalizedCoords = (clientX: number, clientY: number) => {
    const rect = imageWrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.max(0, Math.min(1000, Math.round(((clientX - rect.left) / rect.width) * 1000)));
    const y = Math.max(0, Math.min(1000, Math.round(((clientY - rect.top) / rect.height) * 1000)));
    return { x, y };
  };

  const beginDraw = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditing || !isDrawing) return;
    const point = toNormalizedCoords(event.clientX, event.clientY);
    if (!point) return;
    dragStartRef.current = point;
    setDraftBox([point.x, point.y, point.x, point.y]);
  };

  const moveDraw = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || !isEditing || !isDrawing) return;
    const point = toNormalizedCoords(event.clientX, event.clientY);
    if (!point) return;
    setDraftBox([dragStartRef.current.x, dragStartRef.current.y, point.x, point.y]);
  };

  const endDraw = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || !isEditing || !isDrawing) return;
    const point = toNormalizedCoords(event.clientX, event.clientY);
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!point) {
      setDraftBox(null);
      return;
    }
    const bbox: [number, number, number, number] = [
      Math.min(start.x, point.x),
      Math.min(start.y, point.y),
      Math.max(start.x, point.x),
      Math.max(start.y, point.y),
    ];
    setDraftBox(null);
    if (bbox[2] - bbox[0] < 30 || bbox[3] - bbox[1] < 30) return;
    const room = createEmptyRoom(draftRooms.length + 1, bbox);
    setDraftRooms((prev) => [...prev, room]);
    selectRoom(room.id);
    setIsDrawing(false);
  };

  return (
    <div className="mt-4 overflow-hidden rounded-[24px] border border-[rgba(93,74,50,0.16)] bg-[rgba(255,251,244,0.88)] shadow-soft-lg">
      <div className="border-b border-[rgba(93,74,50,0.12)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-accent">
              {isGenerationPhase ? "效果图生成" : "户型校对"}
            </div>
            <div className="mt-1 text-xs text-text-secondary">
              {analysis.summary || "请先校对房间信息，确认后再开始生成效果图。"}
            </div>
          </div>
          {!isGenerationPhase && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsDrawing((prev) => !prev)}
                className={`rounded-full px-3 py-1.5 text-xs transition ${
                  isDrawing ? "bg-[#8C6A41] text-white" : "bg-[#F6EEE3] text-[#8C6A41]"
                }`}
              >
                {isDrawing ? "拖拽中..." : "补充空间"}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || isBusy}
                className="rounded-full bg-[#F6EEE3] px-3 py-1.5 text-xs text-[#8C6A41] transition hover:bg-[#EEDFCB] disabled:opacity-60"
              >
                保存校对
              </button>
              <button
                type="button"
                onClick={() => void handleStartGeneration()}
                disabled={saving || isBusy || draftRooms.length === 0}
                className="rounded-full bg-[linear-gradient(135deg,#2f261f_0%,#6d5232_100%)] px-3 py-1.5 text-xs text-white transition disabled:opacity-60"
              >
                开始生成效果图
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div>
          <div
            ref={imageWrapRef}
            className={`relative overflow-hidden rounded-[20px] border border-[rgba(93,74,50,0.12)] bg-white ${isDrawing ? "cursor-crosshair" : ""}`}
            onPointerDown={beginDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={() => {
              if (dragStartRef.current) {
                dragStartRef.current = null;
                setDraftBox(null);
              }
            }}
          >
            <img
              src={analysis.zoomedFloorplanUrl}
              alt="放大后的户型图"
              className="h-auto w-full object-contain"
              draggable={false}
            />

            {draftRooms.map((room) => {
              const [x1, y1, x2, y2] = room.bbox;
              const isActive = activeRoom?.id === room.id;
              const statusTone =
                room.generationStatus === "completed"
                  ? "border-[#5C7B60] bg-[rgba(92,123,96,0.18)]"
                  : room.generationStatus === "processing"
                  ? "border-[#8C6A41] bg-[rgba(140,106,65,0.18)]"
                  : room.generationStatus === "failed"
                  ? "border-[#C35D5D] bg-[rgba(195,93,93,0.16)]"
                  : "border-[rgba(140,106,65,0.24)] bg-[rgba(255,255,255,0.2)]";
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => selectRoom(room.id)}
                  className={`absolute rounded-2xl border text-left transition-all duration-200 ${statusTone} ${isActive ? "shadow-[0_8px_20px_rgba(140,106,65,0.18)]" : ""}`}
                  style={{
                    left: `${(x1 / 1000) * 100}%`,
                    top: `${(y1 / 1000) * 100}%`,
                    width: `${((x2 - x1) / 1000) * 100}%`,
                    height: `${((y2 - y1) / 1000) * 100}%`,
                  }}
                  title={room.name}
                >
                  <span className="absolute left-2 top-2 rounded-full bg-[rgba(47,38,31,0.84)] px-2 py-0.5 text-[11px] font-medium text-white">
                    {room.name}
                  </span>
                </button>
              );
            })}

            {draftBox && (
              <div
                className="absolute border-2 border-dashed border-[#8C6A41] bg-[rgba(140,106,65,0.12)]"
                style={{
                  left: `${(Math.min(draftBox[0], draftBox[2]) / 1000) * 100}%`,
                  top: `${(Math.min(draftBox[1], draftBox[3]) / 1000) * 100}%`,
                  width: `${(Math.abs(draftBox[2] - draftBox[0]) / 1000) * 100}%`,
                  height: `${(Math.abs(draftBox[3] - draftBox[1]) / 1000) * 100}%`,
                }}
              />
            )}
          </div>

          {analysis.sourceImageUrl && (
            <button
              type="button"
              onClick={() => onPreviewImage?.(analysis.sourceImageUrl!, "原始户型图")}
              className="mt-2 text-xs text-[#7A5E3A] transition hover:text-accent"
            >
              查看原始户型图
            </button>
          )}
        </div>

        <div className="rounded-[20px] border border-[rgba(93,74,50,0.12)] bg-white/82 p-3">
          {activeRoom ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-accent">{activeRoom.name}</div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {activeRoom.roomType || "空间"}{isGenerationPhase ? "效果图" : "校对信息"}
                  </div>
                </div>
                {isGenerationPhase ? (
                  <div className="rounded-full bg-[#F6EEE3] px-2.5 py-1 text-[11px] text-[#8C6A41]">
                    已完成 {analysis.generation?.completedRooms || 0}/{analysis.generation?.totalRooms || draftRooms.length}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={removeActiveRoom}
                    className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] text-red-600"
                  >
                    删除房间
                  </button>
                )}
              </div>

              {!isGenerationPhase && (
                <div className="mt-3 space-y-3">
                  <input
                    value={activeRoom.name}
                    onChange={(e) => updateRoom(activeRoom.id, { name: e.target.value })}
                    className="w-full rounded-2xl border border-secondary/20 bg-white px-3 py-2 text-sm text-accent outline-none"
                    placeholder="房间名称"
                  />
                  <select
                    value={activeRoom.roomType || "空间"}
                    onChange={(e) => updateRoom(activeRoom.id, { roomType: e.target.value })}
                    className="w-full rounded-2xl border border-secondary/20 bg-white px-3 py-2 text-sm text-accent outline-none"
                  >
                    {ROOM_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-4 gap-2">
                    <input
                      value={activeRoom.dimensions?.length || ""}
                      onChange={(e) => updateRoom(activeRoom.id, { dimensions: { ...activeRoom.dimensions, length: e.target.value } })}
                      className="rounded-2xl border border-secondary/20 bg-white px-3 py-2 text-sm text-accent outline-none"
                      placeholder="长"
                    />
                    <input
                      value={activeRoom.dimensions?.width || ""}
                      onChange={(e) => updateRoom(activeRoom.id, { dimensions: { ...activeRoom.dimensions, width: e.target.value } })}
                      className="rounded-2xl border border-secondary/20 bg-white px-3 py-2 text-sm text-accent outline-none"
                      placeholder="宽"
                    />
                    <input
                      value={activeRoom.dimensions?.height || ""}
                      onChange={(e) => updateRoom(activeRoom.id, { dimensions: { ...activeRoom.dimensions, height: e.target.value } })}
                      className="rounded-2xl border border-secondary/20 bg-white px-3 py-2 text-sm text-accent outline-none"
                      placeholder="高"
                    />
                    <select
                      value={activeRoom.dimensions?.unit || "m"}
                      onChange={(e) => updateRoom(activeRoom.id, { dimensions: { ...activeRoom.dimensions, unit: e.target.value } })}
                      className="rounded-2xl border border-secondary/20 bg-white px-3 py-2 text-sm text-accent outline-none"
                    >
                      <option value="m">m</option>
                      <option value="cm">cm</option>
                    </select>
                  </div>
                  <textarea
                    value={activeRoom.userRequirements || ""}
                    onChange={(e) => updateRoom(activeRoom.id, { userRequirements: e.target.value })}
                    className="min-h-[120px] w-full rounded-2xl border border-secondary/20 bg-white px-3 py-2 text-sm text-accent outline-none"
                    placeholder="输入该房间的装修要求，例如风格、功能、收纳、采光等"
                  />
                </div>
              )}

              {isGenerationPhase && (
                <>
                  {activeRoom.imageUrl ? (
                    <button
                      type="button"
                      className="mt-3 block w-full overflow-hidden rounded-[18px] border border-[rgba(93,74,50,0.12)]"
                      onClick={() => onPreviewImage?.(activeRoom.imageUrl!, `${activeRoom.name} 效果图`)}
                    >
                      <img
                        src={activeRoom.imageUrl}
                        alt={`${activeRoom.name} 效果图`}
                        className="h-56 w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ) : (
                    <div className="mt-3 flex h-56 items-center justify-center rounded-[18px] border border-dashed border-[rgba(93,74,50,0.16)] bg-[rgba(255,251,244,0.7)] text-sm text-text-secondary">
                      {activeRoom.generationStatus === "failed"
                        ? "当前房间生成失败"
                        : activeRoom.generationStatus === "processing"
                        ? "当前房间效果图生成中"
                        : "等待轮到该房间生成"}
                    </div>
                  )}

                  {activeRoom.description && (
                    <div className="mt-3 rounded-2xl bg-[#FCF7F0] px-3 py-2.5 text-xs leading-6 text-[#6E6256]">
                      {activeRoom.description}
                    </div>
                  )}

                </>
              )}
            </>
          ) : (
            <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-text-secondary">
              未识别到房间信息
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
