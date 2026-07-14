import { z } from 'zod';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u, 'Expected lowercase SHA-256 hex');

export const datasetFileSchema = z
  .object({
    byteLength: z.number().int().nonnegative(),
    mediaType: z.string().min(1),
    path: z
      .string()
      .min(1)
      .refine(
        (value) =>
          !value.startsWith('/') &&
          !value.split('/').some((component) => component === '..' || component === ''),
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
    files: z.array(datasetFileSchema).min(1),
    formatVersion: z.literal(1),
    generatedAt: z.iso.datetime(),
    jurisdiction: z.string().min(1),
    regionId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/u),
    sequence: z.number().int().positive(),
    source: z.string().min(1),
    sourceVersion: z.string().min(1),
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
    for (const [index, file] of manifest.files.entries()) {
      if (paths.has(file.path)) {
        context.addIssue({
          code: 'custom',
          message: 'Dataset file paths must be unique',
          path: ['files', index, 'path'],
        });
      }
      paths.add(file.path);
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
