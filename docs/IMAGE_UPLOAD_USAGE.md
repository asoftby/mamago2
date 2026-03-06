# Image Upload Usage Guide

## Quick Start

### 1. Upload Single Image

```typescript
import { useImageUpload } from "@/hooks/useImageUpload";

function MyComponent() {
  const { uploadImage, uploading, progress } = useImageUpload({
    onUploadComplete: (image) => {
      console.log("Uploaded:", image);
      // Save to database
    },
  });

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    await uploadImage(file);
  };

  return (
    <div>
      <input type="file" onChange={handleFileSelect} />
      {uploading && <p>Uploading... {progress}%</p>}
    </div>
  );
}
```

### 2. Upload with UI Component

```typescript
import { ImageUploader } from "@/components/image/ImageUploader";

function MyComponent() {
  const handleUpload = (image) => {
    console.log("Uploaded:", image);
    // { id, url, width, height, blurhash, preview }
  };

  return (
    <ImageUploader
      onUpload={handleUpload}
      maxSizeMB={1}
      maxWidthOrHeight={2048}
    />
  );
}
```

### 3. Upload Logo (1:1 aspect ratio)

```typescript
import { LogoUploader } from "@/components/image/LogoUploader";

function MyComponent() {
  return (
    <LogoUploader
      currentLogo="/uploads/logo.webp"
      onUpload={(image) => {
        // Save to database
      }}
      size="lg"
    />
  );
}
```

### 4. Upload Gallery (multiple images)

```typescript
import { ImageGalleryUploader } from "@/components/image/ImageUploader";
import { useImageGallery } from "@/hooks/useImageUpload";

function MyComponent() {
  const { images, addImage, removeImage } = useImageGallery();

  return (
    <ImageGalleryUploader
      images={images}
      onAdd={addImage}
      onRemove={removeImage}
      maxImages={10}
    />
  );
}
```

## Compression Options

```typescript
const { uploadImage } = useImageUpload({
  maxSizeMB: 1,              // Max file size after compression
  maxWidthOrHeight: 2048,    // Max dimension (width or height)
  quality: 0.8,              // JPEG/WebP quality (0-1)
});
```

## Save to Database

### Place Logo

```typescript
const handleLogoUpload = async (image) => {
  const res = await fetch(`/api/business/places/${placeId}/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: image.url,
      width: image.width,
      height: image.height,
      blurhash: image.blurhash,
      kind: "LOGO",
    }),
  });

  const data = await res.json();
  console.log("Saved:", data.image);
};
```

### Place Gallery

```typescript
const handleGalleryUpload = async (image) => {
  const res = await fetch(`/api/business/places/${placeId}/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: image.url,
      width: image.width,
      height: image.height,
      blurhash: image.blurhash,
      kind: "GALLERY",
      sortOrder: images.length,
    }),
  });

  const data = await res.json();
  return data.image;
};
```

### Activity Cover

```typescript
const handleCoverUpload = async (image) => {
  const res = await fetch(`/api/business/activities-v2/${activityId}/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: image.url,
      width: image.width,
      height: image.height,
      blurhash: image.blurhash,
      isCover: true,
    }),
  });

  const data = await res.json();
  return data.image;
};
```

## Delete Image

```typescript
// Delete place image
await fetch(`/api/business/places/${placeId}/images/${imageId}`, {
  method: "DELETE",
});

// Delete activity image
await fetch(`/api/business/activities-v2/${activityId}/images/${imageId}`, {
  method: "DELETE",
});
```

## Display with Blurhash

```typescript
import { Blurhash } from "react-blurhash";

function ImageWithPlaceholder({ image }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative w-full h-64">
      {!loaded && image.blurhash && (
        <Blurhash
          hash={image.blurhash}
          width="100%"
          height="100%"
          resolutionX={32}
          resolutionY={32}
        />
      )}
      <img
        src={image.url}
        alt=""
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
```

## Error Handling

```typescript
const { uploadImage, error, clearError } = useImageUpload({
  onUploadError: (error) => {
    alert(`Upload failed: ${error}`);
  },
});

// Or check error state
{error && (
  <div className="text-red-600">
    {error}
    <button onClick={clearError}>Dismiss</button>
  </div>
)}
```

## Validation

```typescript
import { validateImageFile } from "@/lib/image/compression";

const handleFileSelect = (file) => {
  const validation = validateImageFile(file, {
    maxSizeMB: 10,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
  });

  if (!validation.valid) {
    alert(validation.error);
    return;
  }

  // Proceed with upload
  uploadImage(file);
};
```

## Advanced: Compress Only

```typescript
const { compressOnly } = useImageUpload();

const handleCompress = async (file) => {
  const compressed = await compressOnly(file);
  if (compressed) {
    console.log("Compressed:", compressed);
    // { file, width, height, blurhash, preview }
    // Use compressed.file for upload
  }
};
```

## Gallery Management

```typescript
const {
  images,
  addImage,
  addImages,
  removeImage,
  reorderImages,
  updateImage,
  clearImages,
} = useImageGallery();

// Add single
addImage(uploadedImage);

// Add multiple
addImages([image1, image2, image3]);

// Remove
removeImage(imageId);

// Reorder (drag & drop)
reorderImages(0, 2); // Move from index 0 to index 2

// Update
updateImage(imageId, { uploading: false });

// Clear all
clearImages();
```

## Custom Upload Button

```typescript
<ImageUploader onUpload={handleUpload}>
  <button className="btn-primary">
    Choose Image
  </button>
</ImageUploader>
```

## Drag & Drop

The `ImageUploader` component supports drag & drop by default:

```typescript
<ImageUploader
  onUpload={handleUpload}
  className="w-full"
/>
// Users can drag files onto this component
```

## Best Practices

1. **Always compress before upload**
   ```typescript
   // ✅ Good - uses hook
   const { uploadImage } = useImageUpload();
   await uploadImage(file);

   // ❌ Bad - direct upload without compression
   const formData = new FormData();
   formData.append("file", file);
   await fetch("/api/upload", { method: "POST", body: formData });
   ```

2. **Show upload progress**
   ```typescript
   const { uploading, progress } = useImageUpload();
   {uploading && <ProgressBar value={progress} />}
   ```

3. **Handle errors**
   ```typescript
   const { error } = useImageUpload({
     onUploadError: (error) => {
       toast.error(error);
     },
   });
   ```

4. **Validate aspect ratio for logos**
   ```typescript
   // LogoUploader automatically validates 1:1 aspect ratio
   <LogoUploader onUpload={handleUpload} />
   ```

5. **Use blurhash for smooth loading**
   ```typescript
   // Store blurhash in database
   { url, width, height, blurhash }
   
   // Display with placeholder
   <ImageWithPlaceholder image={image} />
   ```

## API Reference

### useImageUpload

```typescript
const {
  uploadImage,      // (file: File) => Promise<UploadedImage | null>
  uploadImages,     // (files: File[]) => Promise<UploadedImage[]>
  compressOnly,     // (file: File) => Promise<CompressedImage | null>
  uploading,        // boolean
  progress,         // number (0-100)
  error,           // string | null
  clearError,      // () => void
} = useImageUpload(options);
```

### useImageGallery

```typescript
const {
  images,          // UploadedImage[]
  addImage,        // (image: UploadedImage) => void
  addImages,       // (images: UploadedImage[]) => void
  removeImage,     // (id: string) => void
  reorderImages,   // (startIndex: number, endIndex: number) => void
  updateImage,     // (id: string, updates: Partial<UploadedImage>) => void
  clearImages,     // () => void
  setImages,       // (images: UploadedImage[]) => void
} = useImageGallery(initialImages);
```

### Compression Functions

```typescript
// Compress image
compressImage(file, options): Promise<CompressedImage>

// Get dimensions
getImageDimensions(file): Promise<{ width, height }>

// Generate blurhash
generateBlurhash(file, componentX?, componentY?): Promise<string>

// Generate tiny placeholder
generateTinyPlaceholder(file, size?): Promise<string>

// Validate file
validateImageFile(file, options): { valid, error? }
```
