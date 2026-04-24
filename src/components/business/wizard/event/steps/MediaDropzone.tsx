"use client";

import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type MediaDropzoneRenderApi = {
  openFilePicker: () => void;
};

export type MediaDropzoneHandle = {
  openFilePicker: () => void;
};

interface MediaDropzoneProps {
  selectionMode: "cover" | "gallery";
  isEditable: boolean;
  isBusy?: boolean;
  isDragging: boolean;
  onDraggingChange: (value: boolean) => void;
  onFilesSelected: (files: File[]) => void | Promise<void>;
  children: (api: MediaDropzoneRenderApi) => ReactNode;
  className?: string;
}

export const MediaDropzone = forwardRef<MediaDropzoneHandle, MediaDropzoneProps>(function MediaDropzone({
  selectionMode,
  isEditable,
  isBusy = false,
  isDragging,
  onDraggingChange,
  onFilesSelected,
  children,
  className,
}, ref) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const normalizeFiles = (incoming: FileList | File[] | null | undefined) => {
    if (!incoming) return [];
    const files = Array.from(incoming);
    if (files.length === 0) return [];
    if (selectionMode === "cover" && files.length > 1) {
      toast.message("Для обложки будет использован только первый файл");
      return [files[0]];
    }
    return files;
  };

  const submitFiles = (incoming: FileList | File[] | null | undefined) => {
    const files = normalizeFiles(incoming);
    if (files.length === 0) return;
    void onFilesSelected(files);
  };

  const openFilePicker = () => {
    if (!isEditable || isBusy) return;
    inputRef.current?.click();
  };

  useImperativeHandle(ref, () => ({
    openFilePicker,
  }), [isEditable, isBusy]);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple={selectionMode === "gallery"}
        className="sr-only"
        onChange={(e) => {
          submitFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        role="button"
        tabIndex={isEditable && !isBusy ? 0 : -1}
        onClick={openFilePicker}
        onKeyDown={(e) => {
          if (!isEditable || isBusy) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openFilePicker();
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDraggingChange(false);
          if (!isEditable || isBusy) return;
          submitFiles(e.dataTransfer.files);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isEditable || isBusy) return;
          onDraggingChange(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          onDraggingChange(false);
        }}
        className={cn(
          "rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-gray-300",
          isEditable && !isBusy ? "cursor-pointer hover:bg-muted" : "cursor-not-allowed opacity-50",
          className,
        )}
      >
        {/* eslint-disable-next-line react-hooks/refs -- openFilePicker reads inputRef only when invoked from user events */}
        {children({ openFilePicker })}
      </div>
    </>
  );
});
