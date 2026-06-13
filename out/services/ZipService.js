"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createArchive = createArchive;
exports.scanZipContents = scanZipContents;
exports.extractArchive = extractArchive;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const zlib = __importStar(require("zlib"));
let crcTable = null;
function initCRC32Table() {
    const table = Buffer.alloc(1024);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            if (c & 1) {
                c = 0xedb88320 ^ (c >>> 1);
            }
            else {
                c >>>= 1;
            }
        }
        table.writeUInt32LE(c >>> 0, i * 4);
    }
    return table;
}
function crc32(data) {
    if (!crcTable) {
        crcTable = initCRC32Table();
    }
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        const idx = (crc ^ data[i]) & 0xff;
        crc = (crcTable.readUInt32LE(idx * 4) ^ (crc >>> 8)) >>> 0;
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function dosTime(date) {
    return (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >>> 1);
}
function dosDate(date) {
    return ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
}
function walkFilesRecursive(dir, relativePath = '') {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const entryName = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            files.push(...walkFilesRecursive(fullPath, entryName));
        }
        else if (entry.isFile()) {
            files.push(entryName);
        }
    }
    return files;
}
function findEOCD(buffer) {
    const signature = 0x06054b50;
    const searchStart = Math.max(0, buffer.length - 65557);
    for (let i = buffer.length - 22; i >= searchStart; i--) {
        if (buffer.readUInt32LE(i) === signature) {
            const commentLength = buffer.readUInt16LE(i + 20);
            if (i + 22 + commentLength === buffer.length) {
                return i;
            }
        }
    }
    throw new Error('Invalid ZIP file: end of central directory not found');
}
function readCentralDirectory(buffer) {
    const eocdOffset = findEOCD(buffer);
    const numEntries = buffer.readUInt16LE(eocdOffset + 8);
    const centralSize = buffer.readUInt32LE(eocdOffset + 12);
    const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
    const entries = [];
    let pos = centralOffset;
    const end = centralOffset + centralSize;
    while (pos < end) {
        const sig = buffer.readUInt32LE(pos);
        if (sig !== 0x02014b50)
            throw new Error('Invalid ZIP file: bad central directory entry');
        const compressionMethod = buffer.readUInt16LE(pos + 10);
        const crc32Value = buffer.readUInt32LE(pos + 16);
        const compressedSize = buffer.readUInt32LE(pos + 20);
        const uncompressedSize = buffer.readUInt32LE(pos + 24);
        const fileNameLength = buffer.readUInt16LE(pos + 28);
        const extraLength = buffer.readUInt16LE(pos + 30);
        const commentLength = buffer.readUInt16LE(pos + 32);
        const localHeaderOffset = buffer.readUInt32LE(pos + 42);
        const fileName = buffer.toString('utf-8', pos + 46, pos + 46 + fileNameLength);
        entries.push({
            fileName,
            crc32: crc32Value,
            compressedSize,
            uncompressedSize,
            compressionMethod,
            localHeaderOffset,
        });
        pos += 46 + fileNameLength + extraLength + commentLength;
    }
    return { entries, eocdOffset };
}
function readLocalFileData(buffer, entry) {
    const pos = entry.localHeaderOffset;
    const sig = buffer.readUInt32LE(pos);
    if (sig !== 0x04034b50)
        throw new Error('Invalid ZIP file: bad local file header');
    const fileNameLength = buffer.readUInt16LE(pos + 26);
    const extraLength = buffer.readUInt16LE(pos + 28);
    const dataStart = pos + 30 + fileNameLength + extraLength;
    return buffer.subarray(dataStart, dataStart + entry.compressedSize);
}
function validatePath(destDir, fileName) {
    const resolvedDest = path.resolve(destDir);
    const resolvedEntry = path.resolve(destDir, fileName);
    if (!resolvedEntry.startsWith(resolvedDest + path.sep) && resolvedEntry !== resolvedDest) {
        throw new Error(`Invalid ZIP entry: path traversal detected in "${fileName}"`);
    }
    return resolvedEntry;
}
function createArchive(sourceDir, outputPath) {
    const fileNames = walkFilesRecursive(sourceDir);
    const now = new Date();
    const dt = dosDate(now);
    const tt = dosTime(now);
    const entries = [];
    for (const name of fileNames) {
        const fullPath = path.join(sourceDir, name);
        const data = fs.readFileSync(fullPath);
        const compressedData = zlib.deflateRawSync(data);
        const useCompression = compressedData.length < data.length;
        entries.push({
            fileName: name,
            crc32: crc32(data),
            compressedData: useCompression ? compressedData : data,
            uncompressedSize: data.length,
            compressionMethod: useCompression ? 8 : 0,
        });
    }
    const centralEntries = [];
    const chunks = [];
    let offset = 0;
    for (const entry of entries) {
        const fileNameBuffer = Buffer.from(entry.fileName, 'utf-8');
        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0x0800, 6);
        localHeader.writeUInt16LE(entry.compressionMethod, 8);
        localHeader.writeUInt16LE(tt, 10);
        localHeader.writeUInt16LE(dt, 12);
        localHeader.writeUInt32LE(entry.crc32, 14);
        localHeader.writeUInt32LE(entry.compressedData.length, 18);
        localHeader.writeUInt32LE(entry.uncompressedSize, 22);
        localHeader.writeUInt16LE(fileNameBuffer.length, 26);
        localHeader.writeUInt16LE(0, 28);
        chunks.push(localHeader, fileNameBuffer, entry.compressedData);
        centralEntries.push({
            fileName: entry.fileName,
            crc32: entry.crc32,
            compressedSize: entry.compressedData.length,
            uncompressedSize: entry.uncompressedSize,
            compressionMethod: entry.compressionMethod,
            localHeaderOffset: offset,
        });
        offset += 30 + fileNameBuffer.length + entry.compressedData.length;
    }
    const centralStart = offset;
    for (const entry of centralEntries) {
        const fileNameBuffer = Buffer.from(entry.fileName, 'utf-8');
        const cdEntry = Buffer.alloc(46);
        cdEntry.writeUInt32LE(0x02014b50, 0);
        cdEntry.writeUInt16LE(0x0314, 4);
        cdEntry.writeUInt16LE(20, 6);
        cdEntry.writeUInt16LE(0x0800, 8);
        cdEntry.writeUInt16LE(entry.compressionMethod, 10);
        cdEntry.writeUInt16LE(tt, 12);
        cdEntry.writeUInt16LE(dt, 14);
        cdEntry.writeUInt32LE(entry.crc32, 16);
        cdEntry.writeUInt32LE(entry.compressedSize, 20);
        cdEntry.writeUInt32LE(entry.uncompressedSize, 24);
        cdEntry.writeUInt16LE(fileNameBuffer.length, 28);
        cdEntry.writeUInt16LE(0, 30);
        cdEntry.writeUInt16LE(0, 32);
        cdEntry.writeUInt16LE(0, 34);
        cdEntry.writeUInt16LE(0, 36);
        cdEntry.writeUInt32LE(0, 38);
        cdEntry.writeUInt32LE(entry.localHeaderOffset, 42);
        chunks.push(cdEntry, fileNameBuffer);
        offset += 46 + fileNameBuffer.length;
    }
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(centralEntries.length, 8);
    eocd.writeUInt16LE(centralEntries.length, 10);
    eocd.writeUInt32LE(offset - centralStart, 12);
    eocd.writeUInt32LE(centralStart, 16);
    eocd.writeUInt16LE(0, 20);
    chunks.push(eocd);
    const fd = fs.openSync(outputPath, 'w');
    try {
        for (const chunk of chunks) {
            fs.writeSync(fd, chunk);
        }
    }
    finally {
        fs.closeSync(fd);
    }
    return Promise.resolve();
}
function scanZipContents(zipPath) {
    const buffer = fs.readFileSync(zipPath);
    const { entries } = readCentralDirectory(buffer);
    const names = entries
        .filter((e) => !e.fileName.endsWith('/'))
        .map((e) => e.fileName);
    return Promise.resolve(names);
}
function extractArchive(zipPath, destDir) {
    const buffer = fs.readFileSync(zipPath);
    const { entries } = readCentralDirectory(buffer);
    for (const entry of entries) {
        const safePath = validatePath(destDir, entry.fileName);
        if (entry.fileName.endsWith('/')) {
            fs.mkdirSync(safePath, { recursive: true });
            continue;
        }
        const compressedData = readLocalFileData(buffer, entry);
        const parentDir = path.dirname(safePath);
        fs.mkdirSync(parentDir, { recursive: true });
        let data;
        if (entry.compressionMethod === 8) {
            data = zlib.inflateRawSync(compressedData);
        }
        else if (entry.compressionMethod === 0) {
            data = compressedData;
        }
        else {
            throw new Error(`Unsupported compression method: ${entry.compressionMethod}`);
        }
        fs.writeFileSync(safePath, data);
    }
    return Promise.resolve();
}
//# sourceMappingURL=ZipService.js.map