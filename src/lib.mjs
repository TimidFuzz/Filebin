import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

import { pipeline } from "stream/promises";
import { Readable } from "stream";

import crypto from "crypto";

import qr from "qrcode-terminal";

class File {
  constructor(
    binId,
    filename,
    contentType,
    bytes,
    bytesReadable,
    md5,
    sha256,
    updatedAt,
    updatedAtRelative,
    createdAt,
    createdAtRelative
  ) {
    this.binId = binId;
    this.filename = filename;
    this.contentType = contentType;
    this.bytes = bytes;
    this.bytesReadable = bytesReadable;
    this.md5 = md5;
    this.sha256 = sha256;
    this.updatedAt = updatedAt;
    this.updatedAtRelative = updatedAtRelative;
    this.createdAt = createdAt;
    this.createdAtRelative = createdAtRelative;
  }

  async delete() {
    const url = `https://filebin.net/${this.binId}/${this.filename}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error("Failed to delete file");
    }

    return this;
  }
}

class Bin {
  constructor(id) {
    this.id = id;
  }

  async fetch() {
    const res = await fetch(`https://filebin.net/${this.id}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Failed to load bin`);
    }

    const json = await res.json();
    this._initFromJson(json);
  }

  _initFromJson(json) {
    const binData = json.bin;

    this.readonly = binData.readonly;
    this.bytes = binData.bytes;
    this.bytesReadable = binData.bytes_readable;
    this.updatedAt = binData.updated_at;
    this.updatedAtRelative = binData.updated_at_relative;
    this.createdAt = binData.created_at;
    this.createdAtRelative = binData.created_at_relative;
    this.expiredAt = binData.expired_at;
    this.expiredAtRelative = binData.expired_at_relative;

    this.files = (json.files || []).map(
      (f) =>
        new File(
          this.id,
          f.filename,
          f["content-type"],
          f.bytes,
          f.bytes_readable,
          f.md5,
          f.sha256,
          f.updated_at,
          f.updated_at_relative,
          f.created_at,
          f.created_at_relative
        )
    );
  }

  async lock() {
    if (this.readonly == true) {
      return;
    }

    if (this.files.length == 0) {
      throw new Error("Cannot lock empty bin");
    }

    const res = await fetch(`https://filebin.net/${this.id}`, {
      method: "PUT",
      headers: { Accept: "application/json" },
    });

    if (res.status == 404) {
      throw new Error("Bin doesn't exist");
    } else if (res.status != 200) {
      throw new Error("Unknown error occured");
    }

    this.readonly = true;
  }

  static async create(u) {
    if (!u) {
      u = uuidv4().replace(/-/g, "").slice(0, 16);
    }

    const res = await fetch(`https://filebin.net/${u}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error("Failed to create new bin");
    }

    const bin = new Bin(u);
    await bin._initFromJson(await res.json());
    return bin;
  }

  async uploadFile(filePath) {
    const stream = fs.createReadStream(filePath);
    const filename = path.basename(filePath);
    const filesize = fs.statSync(filePath).size;

    return this.uploadStream(stream, filename, filesize);
  }

  async uploadEncryptedFile(
    filePath,
    algorithm = "aes-256-cbc",
    key = crypto.randomBytes(32),
    iv = crypto.randomBytes(16)
  ) {
    const filestream = fs.createReadStream(filePath);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    const filename = path.basename(filePath);
    const hiddenDir = path.join(process.cwd(), ".tmp");
    const hiddenFile = path.join(hiddenDir, `${filename}.enc`);

    if (!fs.existsSync(hiddenDir)) {
      fs.mkdirSync(hiddenDir);
    }

    await pipeline(filestream, cipher, fs.createWriteStream(hiddenFile));

    const file = await this.uploadFile(hiddenFile);

    try {
      fs.unlinkSync(hiddenFile);
    } catch (err) {
      throw new Error("Tmp directory could not be deleted");
    }

    return { key, iv, file };
  }

  async uploadStream(stream, filename, contentLength) {
    const res = await fetch(`https://filebin.net/${this.id}/${filename}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": contentLength.toString(),
        Accept: "application/json",
      },
      body: stream,
      duplex: "half",
    });

    if (!res.ok) {
      if (res.status === 405) {
        throw new Error("Bin is locked");
      } else if (res.status === 403) {
        throw new Error("Storage limit reached");
      } else if (res.status === 400) {
        throw new Error("Invalid input");
      }

      throw new Error("Failed to upload stream for unknown reason");
    }

    const data = await res.json();

    const f = data.file;
    const fileObj = new File(
      this.id,
      f.filename,
      f["content-type"],
      f.bytes,
      f.bytes_readable,
      f.md5,
      f.sha256,
      f.updated_at,
      f.updated_at_relative,
      f.created_at,
      f.created_at_relative
    );

    this.files.push(fileObj);

    return fileObj;
  }

  async downloadFile(filename, filePath) {
    if (!filePath) {
      filePath = `./${filename}`;
    }

    const stream = await this.downloadStream(filename);

    const fileStream = fs.createWriteStream(filePath);

    stream.pipe(fileStream);
  }

  async downloadEncryptedFile(
    filename,
    key,
    iv,
    folderPath = ".",
    algorithm = "aes-256-cbc"
  ) {
    if (filename.endsWith(".enc")) {
      filename = filename.slice(0, -4);
    }
    const filePath = path.join(folderPath, `${filename}`);

    const stream = await this.downloadStream(filename + ".enc");
    const cipher = crypto.createDecipheriv(algorithm, key, iv);

    await pipeline(stream, cipher, fs.createWriteStream(filePath));
  }

  async downloadStream(filename) {
    const url = `https://filebin.net/${this.id}/${filename}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "curl/7.64.1",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`Failed to download file: ${res.statusText}`);
    }

    return Readable.fromWeb(res.body);
  }

  async downloadTarArchive(fileName = "archive.tar", folderPath = ".") {
    const url = `https://filebin.net/archive/${this.id}/tar`;

    if (!fs.existsSync(folderPath)) {
      throw new Error("Invalid directory");
    }

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "curl/7.64.1",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to download tar archive: ${res.statusText}`);
    }

    await pipeline(
      res.body,
      fs.createWriteStream(path.join(folderPath, fileName))
    );
  }

  async downloadZipArchive(fileName = "archive.zip", folderPath = ".") {
    const url = `https://filebin.net/archive/${this.id}/zip`;

    if (!fs.existsSync(folderPath)) {
      throw new Error("Invalid directory");
    }

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "curl/7.64.1",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to download tar archive: ${res.statusText}`);
    }

    await pipeline(
      res.body,
      fs.createWriteStream(path.join(folderPath, fileName))
    );
  }

  async saveQRCode(fileName = "qr.png", folderPath = ".") {
    const url = `https://filebin.net/qr/${this.id}`;

    if (!fs.existsSync(folderPath)) {
      throw new Error("Invalid directory");
    }

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "image/png",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch QR code: ${res.statusText}`);
    }

    const outputPath = path.join(folderPath, fileName);

    await pipeline(res.body, fs.createWriteStream(outputPath));
  }

  async showQRCode() {
    qr.generate(`https://filebin.net/${this.id}`, { small: true });
  }

  async delete() {
    if (this.files.length == 0) {
      throw new Error("Cannot delete empty bin");
    }

    const url = `https://filebin.net/${this.id}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error("Failed to delete bin");
    }
  }

  async deleteFile(fileName) {
    const file = await this.getFile(fileName);
    return await file.delete();
  }

  async getFile(identifier) {
    return this.files.find(
      (file) =>
        file.filename === identifier ||
        file.md5 === identifier ||
        file.sha256 === identifier
    );
  }
}

export { Bin, File };
