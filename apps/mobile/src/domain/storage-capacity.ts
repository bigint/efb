export interface StorageCapacity {
  readonly availableBytes: number;
  readonly totalBytes: number;
  readonly usedBytes: number;
  readonly usedPercent: number;
}

export const decodeStorageCapacity = (
  totalBytes: number,
  availableBytes: number,
): StorageCapacity => {
  if (
    !Number.isSafeInteger(totalBytes) ||
    totalBytes <= 0 ||
    !Number.isSafeInteger(availableBytes) ||
    availableBytes < 0 ||
    availableBytes > totalBytes
  ) {
    throw new Error('Device storage capacity is invalid');
  }
  const usedBytes = totalBytes - availableBytes;
  return {
    availableBytes,
    totalBytes,
    usedBytes,
    usedPercent: (usedBytes / totalBytes) * 100,
  };
};
