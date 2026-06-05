import { useState, useCallback, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Upload, X, Star, GripVertical, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { fileUrl } from "@/lib/api";

function SortablePhoto({ id, path, index, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const isMain = index === 0;
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`photo-tile-${index}`}
      className={`relative aspect-square overflow-hidden border-2 group ${
        isMain ? "border-[#FF3B30]" : "border-zinc-200"
      }`}
    >
      <img src={fileUrl(path)} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
      {isMain && (
        <div className="absolute top-2 left-2 bg-[#FF3B30] text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 flex items-center gap-1">
          <Star size={10} fill="white" /> Principal
        </div>
      )}
      <button
        type="button"
        {...attributes}
        {...listeners}
        data-testid={`photo-drag-${index}`}
        className="absolute top-2 right-9 bg-white/90 backdrop-blur-sm p-1.5 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
        aria-label="Arrastar"
      >
        <GripVertical size={14} />
      </button>
      <button
        type="button"
        onClick={() => onRemove(id)}
        data-testid={`photo-remove-${index}`}
        className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-1.5 opacity-0 group-hover:opacity-100 hover:bg-[#FF3B30] hover:text-white"
        aria-label="Remover"
      >
        <X size={14} />
      </button>
      <div className="absolute bottom-2 left-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5">
        {index + 1}
      </div>
    </div>
  );
}

/**
 * Multi-photo uploader with drag-and-drop reorder. First photo is "Principal".
 * Props:
 *   value: string[]   array of storage paths
 *   onChange: (paths: string[]) => void
 */
export default function PhotoUploader({ value = [], onChange, testid = "photo-uploader", max = 20 }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const items = value.map((p, i) => ({ id: `${i}-${p}`, path: p }));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    onChange(arrayMove(value, oldIndex, newIndex));
  };

  const handleFiles = useCallback(
    async (files) => {
      const list = Array.from(files || []);
      if (!list.length) return;
      if (value.length + list.length > max) {
        setError(`Máximo de ${max} fotos por anúncio.`);
        return;
      }
      setError("");
      setUploading(true);
      const uploaded = [];
      for (const f of list) {
        try {
          const fd = new FormData();
          fd.append("file", f);
          const { data } = await api.post("/dealer/uploads", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          if (data?.path) uploaded.push(data.path);
        } catch (err) {
          setError(err?.response?.data?.detail || "Falha ao enviar foto.");
        }
      }
      setUploading(false);
      if (uploaded.length) onChange([...value, ...uploaded]);
    },
    [value, max, onChange]
  );

  const onRemove = (id) => {
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) return;
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
  };

  const onPickFiles = () => inputRef.current?.click();

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  };

  return (
    <div data-testid={testid} className="space-y-3">
      <div
        onClick={onPickFiles}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="border-2 border-dashed border-zinc-300 hover:border-black bg-zinc-50 hover:bg-white transition-colors cursor-pointer p-8 text-center"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          data-testid={`${testid}-input`}
        />
        <div className="inline-flex items-center justify-center w-12 h-12 bg-black text-white">
          {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
        </div>
        <div className="mt-4 font-bold uppercase tracking-tight text-sm">
          {uploading ? "Enviando…" : "Arraste fotos ou clique para enviar"}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          Múltiplas fotos · JPG/PNG · Reordene arrastando · 1ª foto = capa
        </div>
        <div className="mt-1 text-xs text-zinc-400">
          {value.length}/{max}
        </div>
      </div>

      {error && (
        <div className="border-l-4 border-[#FF3B30] bg-red-50 text-red-700 text-sm px-4 py-2">
          {error}
        </div>
      )}

      {items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {items.map((it, i) => (
                <SortablePhoto key={it.id} id={it.id} path={it.path} index={i} onRemove={onRemove} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
