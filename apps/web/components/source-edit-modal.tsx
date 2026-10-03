"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ExternalLink,
  Filter,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  SOURCE_TIERS,
  SOURCE_TIER_LABELS,
  type SourceItem,
  type SourceTier,
} from "@repo/contracts";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const TIER_BADGE_STYLE: Record<SourceTier, string> = {
  TIER_1_CHINH_SU: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  TIER_2_KHAO_CO: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  TIER_3_KHOA_HOC: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  TIER_4_DA_SU: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

interface SourceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSources: SourceItem[];
  onSave: (updatedSources: SourceItem[]) => Promise<void>;
  isSubmitting: boolean;
}

export function SourceEditModal({
  isOpen,
  onClose,
  initialSources,
  onSave,
  isSubmitting,
}: SourceEditModalProps) {
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state cho thêm mới
  const [newName, setNewName] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newTier, setNewTier] = useState<SourceTier>("TIER_1_CHINH_SU");
  const [newScore, setNewScore] = useState<number>(8);
  const [newUrl, setNewUrl] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Form state cho chỉnh sửa inline
  const [editName, setEditName] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editTier, setEditTier] = useState<SourceTier>("TIER_1_CHINH_SU");
  const [editScore, setEditScore] = useState<number>(8);
  const [editUrl, setEditUrl] = useState("");

  // Sao chép danh sách nguồn vào state nháp khi mở modal
  useEffect(() => {
    if (isOpen) {
      try {
        setSources(structuredClone(initialSources));
      } catch {
        setSources([...initialSources]);
      }
      setEditingId(null);
      setIsAddingNew(false);
      setErrorMsg(null);
      setSearchQuery("");
      setSelectedTier("ALL");
    }
  }, [isOpen, initialSources]);

  // Xử lý phím Escape để đóng modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const filteredSources = useMemo(() => {
    return sources.filter((s) => {
      const matchTier = selectedTier === "ALL" || s.tier === selectedTier;
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.authorOrOrigin.toLowerCase().includes(q);
      return matchTier && matchQuery;
    });
  }, [sources, selectedTier, searchQuery]);

  const handleDelete = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleStartEdit = (source: SourceItem) => {
    setEditingId(source.id);
    setEditName(source.name);
    setEditAuthor(source.authorOrOrigin);
    setEditTier(source.tier);
    setEditScore(source.reliabilityScore);
    setEditUrl(source.url ?? "");
  };

  const handleSaveInlineEdit = (id: string) => {
    if (!editName.trim()) {
      setErrorMsg("Tên nguồn không được để trống");
      return;
    }
    setSources((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              name: editName.trim(),
              authorOrOrigin: editAuthor.trim() || "Chưa rõ",
              tier: editTier,
              tierDescription: SOURCE_TIER_LABELS[editTier],
              reliabilityScore: editScore,
              url: editUrl.trim() || undefined,
            }
          : s
      )
    );
    setEditingId(null);
    setErrorMsg(null);
  };

  const handleCreateSource = () => {
    if (!newName.trim()) {
      setErrorMsg("Vui lòng nhập tên nguồn tài liệu");
      return;
    }
    const newSource: SourceItem = {
      id: `src-custom-${Date.now()}`,
      name: newName.trim(),
      authorOrOrigin: newAuthor.trim() || "Chưa rõ",
      tier: newTier,
      tierDescription: SOURCE_TIER_LABELS[newTier],
      reliabilityScore: newScore,
      crossVerificationNotes: newNotes.trim() || "Nguồn bổ sung bởi người dùng",
      isPrimaryAssertionSource: true,
      url: newUrl.trim() || undefined,
    };

    setSources((prev) => [newSource, ...prev]);
    setIsAddingNew(false);
    setNewName("");
    setNewAuthor("");
    setNewUrl("");
    setNewNotes("");
    setNewScore(8);
    setErrorMsg(null);
  };

  const handleSaveAll = async () => {
    if (sources.length === 0) {
      setErrorMsg("Danh sách nguồn không thể trống rỗng. Hãy giữ lại ít nhất 1 nguồn.");
      return;
    }
    setErrorMsg(null);
    await onSave(sources);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 id="source-modal-title" className="text-base font-semibold text-foreground">
                Chỉnh sửa danh sách nguồn tài liệu
              </h2>
              <Badge variant="outline" className="text-xs font-medium">
                {sources.length} nguồn
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Xóa các nguồn không phù hợp hoặc thêm tài liệu mới trước khi chuyển sang bước tiếp theo
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Đóng cửa sổ"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Toolbar: Tìm kiếm, lọc và nút thêm */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-6 py-3">
          <div className="flex flex-1 items-center gap-2 min-w-[240px]">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm tên nguồn, tác giả..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="size-3.5 text-muted-foreground" />
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                aria-label="Lọc theo nhóm nguồn"
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">Tất cả nhóm</option>
                {SOURCE_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {SOURCE_TIER_LABELS[tier]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setIsAddingNew(!isAddingNew);
              setErrorMsg(null);
            }}
            variant={isAddingNew ? "outline" : "default"}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            {isAddingNew ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {isAddingNew ? "Đóng form thêm" : "Thêm nguồn mới"}
          </Button>
        </div>

        {/* Alert thông báo lỗi */}
        {errorMsg && (
          <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-6 py-2.5 text-xs font-medium text-red-600 dark:text-red-400">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body danh sách và form */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {/* Form thêm nguồn mới */}
          {isAddingNew && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">Thông tin nguồn tài liệu mới</span>
                <span className="text-[11px] text-muted-foreground">Các trường có dấu (*) là bắt buộc</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Tên tài liệu / bài viết *</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Đại Việt sử ký toàn thư"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Tác giả / Cơ quan xuất bản</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Ngô Sĩ Liên"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Nhóm phân loại nguồn</label>
                  <select
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value as SourceTier)}
                    aria-label="Nhóm phân loại nguồn mới"
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {SOURCE_TIERS.map((tier) => (
                      <option key={tier} value={tier}>
                        {SOURCE_TIER_LABELS[tier]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Điểm tin cậy (1 - 10)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={newScore}
                      onChange={(e) => setNewScore(Number(e.target.value))}
                      className="h-2 flex-1 accent-primary"
                    />
                    <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                      {newScore}/10
                    </span>
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-medium text-muted-foreground">Đường dẫn liên kết (tùy chọn)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAddingNew(false)}
                  className="h-7 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateSource}
                  className="h-7 gap-1 text-xs"
                >
                  <Plus className="size-3" />
                  Thêm vào danh sách
                </Button>
              </div>
            </div>
          )}

          {/* Danh sách các nguồn */}
          {filteredSources.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 py-12 text-center">
              <p className="text-xs text-muted-foreground">
                Không tìm thấy nguồn tài liệu nào phù hợp với bộ lọc.
              </p>
            </div>
          ) : (
            filteredSources.map((source) => {
              const isEditing = editingId === source.id;

              if (isEditing) {
                return (
                  <div
                    key={source.id}
                    className="rounded-lg border border-ring/50 bg-card p-3 space-y-3 shadow-xs"
                  >
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Tên nguồn *</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 w-full rounded border border-input bg-background px-2 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Tác giả</label>
                        <input
                          type="text"
                          value={editAuthor}
                          onChange={(e) => setEditAuthor(e.target.value)}
                          className="h-7 w-full rounded border border-input bg-background px-2 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Nhóm phân loại</label>
                        <select
                          value={editTier}
                          onChange={(e) => setEditTier(e.target.value as SourceTier)}
                          aria-label="Nhóm phân loại đang sửa"
                          className="h-7 w-full rounded border border-input bg-background px-2 text-xs"
                        >
                          {SOURCE_TIERS.map((tier) => (
                            <option key={tier} value={tier}>
                              {SOURCE_TIER_LABELS[tier]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Điểm tin cậy (1-10)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={1}
                            max={10}
                            value={editScore}
                            onChange={(e) => setEditScore(Number(e.target.value))}
                            className="h-2 flex-1 accent-primary"
                          />
                          <span className="font-mono text-xs tabular-nums text-foreground">{editScore}/10</span>
                        </div>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[10px] font-medium text-muted-foreground">Đường dẫn URL</label>
                        <input
                          type="url"
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          placeholder="https://..."
                          className="h-7 w-full rounded border border-input bg-background px-2 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-1.5 pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        className="h-7 px-2 text-xs"
                      >
                        <X className="size-3 mr-1" />
                        Hủy
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveInlineEdit(source.id)}
                        className="h-7 px-2 text-xs"
                      >
                        <Check className="size-3 mr-1" />
                        Xong
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={source.id}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/60 p-3 hover:border-border transition-colors"
                >
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-medium", TIER_BADGE_STYLE[source.tier])}
                      >
                        {SOURCE_TIER_LABELS[source.tier]}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                        Tin cậy: {source.reliabilityScore}/10
                      </span>
                    </div>

                    <h4 className="text-xs font-medium text-foreground truncate">{source.name}</h4>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="truncate">Tác giả: {source.authorOrOrigin}</span>
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-primary hover:underline"
                        >
                          <span>Liên kết</span>
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartEdit(source)}
                      aria-label={`Chỉnh sửa nguồn: ${source.name}`}
                      className="size-7 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(source.id)}
                      aria-label={`Xóa nguồn: ${source.name}`}
                      className="size-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/80 bg-muted/20 px-6 py-3.5">
          <span className="text-xs text-muted-foreground">
            {sources.length} nguồn trong danh sách
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isSubmitting}
              onClick={onClose}
              className="h-8 text-xs"
            >
              Hủy
            </Button>
            <Button
              size="sm"
              disabled={isSubmitting}
              onClick={() => void handleSaveAll()}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <Check className="size-3.5" />
              {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
