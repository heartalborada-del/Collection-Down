export interface ChunkStorage {
    writeChunk(index: number, data: Uint8Array): Promise<void>;
    getChunk(index: number): Promise<Uint8Array>;
    clear(): Promise<void>;
}

export class OPFSChunkStorage implements ChunkStorage {
    constructor(private dirPattern: string) {}

    private async getDir() {
        const root = await navigator.storage.getDirectory();
        return await root.getDirectoryHandle(this.dirPattern, { create: true });
    }

    async writeChunk(index: number, data: Uint8Array) {
        const dir = await this.getDir();
        const fileHandle = await dir.getFileHandle(`chunk_${index}`, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(new Uint8Array(data)); // Force clean Uint8Array wrapper to avoid SharedArrayBuffer issues
        await writable.close();
    }

    async getChunk(index: number) {
        const dir = await this.getDir();
        const fileHandle = await dir.getFileHandle(`chunk_${index}`);
        const file = await fileHandle.getFile();
        return new Uint8Array(await file.arrayBuffer());
    }

    async clear() {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(this.dirPattern, { recursive: true });
    }
}

export class IDBChunkStorage implements ChunkStorage {
    private storeName = 'chunks';

    constructor(private dbName: string) {}

    private async getDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, 1);
            req.onupgradeneeded = () => {
                req.result.createObjectStore(this.storeName);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async writeChunk(index: number, data: Uint8Array) {
        const db = await this.getDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const req = tx.objectStore(this.storeName).put(data, index);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async getChunk(index: number) {
        const db = await this.getDB();
        return new Promise<Uint8Array>((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const req = tx.objectStore(this.storeName).get(index);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async clear() {
        return new Promise<void>((resolve, reject) => {
            const req = indexedDB.deleteDatabase(this.dbName);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
            req.onblocked = () => resolve(); // Ignore blocked errors
        });
    }
}