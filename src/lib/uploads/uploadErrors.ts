import { NextResponse } from "next/server";
import type { UploadErrorCode } from "./uploadTypes";

export function jsonUploadError(
  code: UploadErrorCode,
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      error: code,
      message,
    },
    { status },
  );
}
