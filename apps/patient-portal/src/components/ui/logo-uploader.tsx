"use client";

import { ImageUploader } from "./image-uploader";

// Thin specialisation of ImageUploader with clinic-logo defaults — bigger
// preview, SVG allowed, dimension hint. Splitting it keeps the call sites
// in /clinic/profile readable.
export function LogoUploader(
  props: Omit<React.ComponentProps<typeof ImageUploader>, "previewClassName" | "label" | "hint" | "accept"> & {
    label?: string;
    hint?: string;
  },
) {
  return (
    <ImageUploader
      {...props}
      label={props.label ?? "Upload logo"}
      hint={props.hint ?? "PNG, SVG or JPG up to 4 MB. Recommended 512×512."}
      accept="image/png,image/svg+xml,image/jpeg,image/webp"
      previewClassName="size-24 rounded-xl"
    />
  );
}
