import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { config } from './../config/index.js';

export interface StoredFile {
  /** Storage key, e.g. "listings/abc/cover.webp". Stored in the database. */
  key: string;
  /** Absolute URL the client can fetch. */
  url: string;
}

export interface StorageAdapter {
  put(key: string, body: Buffer, contentType: string): Promise<StoredFile>;
  remove(key: string): Promise<void>;
  urlFor(key: string): string;
}

/**
 * v1 storage: files on the API server's own disk, served by Express. Swapping to
 * object storage is a matter of implementing this interface and flipping
 * STORAGE_DRIVER — nothing above this layer knows the difference.
 */
class LocalDiskStorage implements StorageAdapter {
  constructor(
    private readonly baseDir: string,
    private readonly publicBase: string,
  ) {}

  urlFor(key: string): string {
    return `${this.publicBase}/media/${key}`;
  }

  async put(key: string, body: Buffer): Promise<StoredFile> {
    const path = join(this.baseDir, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return { key, url: this.urlFor(key) };
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(join(this.baseDir, key));
    } catch (err) {
      // Already gone is the desired end state either way.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
}

class UnconfiguredS3Storage implements StorageAdapter {
  private fail(): never {
    throw new Error(
      'STORAGE_DRIVER=s3 but the S3 adapter is not implemented yet. Use STORAGE_DRIVER=local.',
    );
  }
  urlFor(): string {
    this.fail();
  }
  put(): Promise<StoredFile> {
    this.fail();
  }
  remove(): Promise<void> {
    this.fail();
  }
}

export const storage: StorageAdapter =
  config.storage.driver === 'local'
    ? new LocalDiskStorage(config.storage.localDir, config.storage.publicBaseUrl)
    : new UnconfiguredS3Storage();

export const localStorageDir = config.storage.localDir;
