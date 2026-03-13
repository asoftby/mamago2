/**
 * Format bytes to human-readable size
 * 
 * Returns "—" for unknown/zero sizes instead of misleading "0 KB"
 */

export function formatBytes(bytes: number | null | undefined): string {
  // Unknown or zero size
  if (!bytes || bytes <= 0) {
    return "—";
  }
  
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  
  // Format with appropriate precision
  if (i === 0) {
    // Bytes - no decimals
    return `${value} ${sizes[i]}`;
  } else if (value < 10) {
    // < 10 - show 2 decimals
    return `${value.toFixed(2)} ${sizes[i]}`;
  } else if (value < 100) {
    // < 100 - show 1 decimal
    return `${value.toFixed(1)} ${sizes[i]}`;
  } else {
    // >= 100 - no decimals
    return `${Math.round(value)} ${sizes[i]}`;
  }
}

/**
 * Format bytes compactly (for tight spaces)
 */
export function formatBytesCompact(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) {
    return "—";
  }
  
  const k = 1024;
  
  if (bytes < k) {
    return `${bytes}B`;
  } else if (bytes < k * k) {
    return `${(bytes / k).toFixed(0)}KB`;
  } else if (bytes < k * k * k) {
    return `${(bytes / (k * k)).toFixed(1)}MB`;
  } else {
    return `${(bytes / (k * k * k)).toFixed(1)}GB`;
  }
}
