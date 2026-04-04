"use client";

import { useState, useRef } from "react";
import { Camera } from "lucide-react";
import { useProfileSave } from "@/hooks/useProfileSave";

interface Props {
  initial: string;
  avatarUrl?: string | null;
  displayName?: string | null;
}

export function ProfileSettingsClient({ initial, avatarUrl: initialAvatarUrl, displayName: initialName }: Props) {
  const { save, saving } = useProfileSave();
  const [name, setName] = useState(initialName ?? "");
  const [preview, setPreview] = useState<string | null>(initialAvatarUrl ?? null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    const result = await save({ displayName: name, avatarFile });
    if (result) {
      setAvatarFile(null);
      if (result.avatarUrl) setPreview(result.avatarUrl);
    }
  };

  const hasChanges = name !== (initialName ?? "") || !!avatarFile;

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 space-y-6">
      {/* Avatar */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative group"
          aria-label="Изменить фото"
        >
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden ring-2 ring-white shadow-sm">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Аватар" className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl font-semibold text-primary">
                {initial.toUpperCase()}
              </span>
            )}
          </div>
          <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="h-6 w-6 text-white" />
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-neutral-700">Имя</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Введите имя"
          className="w-full h-11 rounded-2xl border border-neutral-200 px-4 text-sm outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || !hasChanges}
        className="w-full h-11 rounded-2xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
      >
        {saving ? "Сохранение..." : "Сохранить"}
      </button>
    </div>
  );
}
