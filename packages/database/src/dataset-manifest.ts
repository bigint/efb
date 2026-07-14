import { z } from 'zod';

export const MAX_DATASET_FILE_COUNT = 10_000;
export const MAX_DATASET_TOTAL_BYTES = 20 * 1024 * 1024 * 1024;

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u, 'Expected lowercase SHA-256 hex');
const boundedDisplayText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine(
      (value) =>
        [...value].every((character) => {
          const code = character.codePointAt(0) ?? 0;
          return code >= 32 && code !== 127;
        }),
      'Manifest display text has control characters',
    );

export const datasetFileSchema = z
  .object({
    byteLength: z.number().int().nonnegative(),
    mediaType: z.string().regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/u),
    path: z
      .string()
      .regex(/^[A-Za-z0-9._/-]{1,512}$/u, 'Dataset path contains unsupported characters')
      .refine(
        (value) =>
          !value.startsWith('/') &&
          !value
            .split('/')
            .some((component) => component === '.' || component === '..' || component === ''),
        'Dataset paths must be relative and cannot traverse directories',
      ),
    sha256: sha256Schema,
  })
  .strict();

export const datasetManifestSchema = z
  .object({
    datasetId: z.uuid(),
    effectiveAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    files: z.array(datasetFileSchema).min(1).max(MAX_DATASET_FILE_COUNT),
    formatVersion: z.literal(1),
    generatedAt: z.iso.datetime(),
    jurisdiction: boundedDisplayText(64),
    regionId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/u),
    sequence: z.number().int().positive(),
    source: boundedDisplayText(240),
    sourceVersion: boundedDisplayText(128),
  })
  .strict()
  .superRefine((manifest, context) => {
    if (Date.parse(manifest.expiresAt) <= Date.parse(manifest.effectiveAt)) {
      context.addIssue({
        code: 'custom',
        message: 'Dataset expiry must be after its effective time',
        path: ['expiresAt'],
      });
    }
    const paths = new Set<string>();
    let totalBytes = 0;
    for (const [index, file] of manifest.files.entries()) {
      if (paths.has(file.path)) {
        context.addIssue({
          code: 'custom',
          message: 'Dataset file paths must be unique',
          path: ['files', index, 'path'],
        });
      }
      paths.add(file.path);
      totalBytes += file.byteLength;
      if (!Number.isSafeInteger(totalBytes) || totalBytes > MAX_DATASET_TOTAL_BYTES) {
        context.addIssue({
          code: 'custom',
          message: 'Dataset aggregate size exceeds the supported limit',
          path: ['files', index, 'byteLength'],
        });
        break;
      }
    }
  });

export type DatasetManifest = z.infer<typeof datasetManifestSchema>;

export interface VerifiedDatasetGeneration {
  readonly integrityCheckedAt: string;
  readonly manifest: DatasetManifest;
  readonly manifestDigest: string;
  readonly signatureKeyId: string;
  readonly signatureVerifiedAt: string;
}
