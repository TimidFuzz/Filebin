# Filebin

An npm library for [filebin.net](https://filebin.net), a free file-sharing platform

---

## Installation

```bash
npm install filebin
```

---

## Usage

### Import

```js
const { Bin } = require("filebin");
```

### Fetching an existing Bin

```js
(async () => {
  try {
    const bin = await Bin.create("5cfea0cb382647af");

    console.log(`Bin id: ${bin.id}`);
  } catch (err) {
    console.log(`An error occurred: ${err}`);
  }
})();
```

### Uploading & deleting files

```js
(async () => {
  try {
    const bin = await Bin.create();

    const file = await bin.uploadFile("file.txt");
    console.log(`Uploaded ${file.filename}`);

    await bin.deleteFile("file.txt");
    console.log(`Deleted ${file.filename}`);
  } catch (err) {
    console.log(`An error occurred: ${err}`);
  }
})();
```

### Encrypt and decrypt a file & lock the bin

```js
(async () => {
  try {
    const bin = await Bin.create();

    const { key, iv, file } = await bin.uploadEncryptedFile("file.txt");
    console.log(`Uploaded ${file.filename}`);

    await bin.downloadEncryptedFile("file.txt", key, iv, "./files");
    console.log(`Downloaded file: ${file.filename}`);

    await bin.lock();
    console.log(`Locked bin ${bin.id}`);
  } catch (err) {
    console.log(`An error occurred: ${err}`);
  }
})();
```

---

## Bin

### Properties

| Property            | Description                   |
| ------------------- | ----------------------------- |
| `id`                | Bin ID                        |
| `readonly`          | Whether the bin is locked     |
| `bytes`             | Size in bytes                 |
| `bytesReadable`     | Size in human-readable format |
| `createdAt`         | Time of creation              |
| `updatedAt`         | Time of last update           |
| `expiredAt`         | Time of expiry                |
| `createdAtRelative` | Time since creation           |
| `updatedAtRelative` | Time since update             |
| `expiredAtRelative` | Time until expiry             |
| `files`             | List of files                 |

### Methods

```js
Bin.create(id);
```

Create or fetch a bin. Returns a bin object

- `id` (`string`, optional): Existing bin ID. If not provided, a new bin is created.

```js
bin.fetch();
```

Refresh bin data

```js
bin.lock();
```

Make the Bin read-only. Requires at least one uploaded file inside the bin

```js
bin.uploadFile(path);
```

Uploads a file. Returns the uploaded file

- `path` (`string`): Path to file which should be uploaded

```js
bin.uploadEncryptedFile(filePath, algorithm, key, iv);
```

Encrypts and uploads a file. Returns the encryption key, the initial vector and the uploaded file

- `filePath` (`string`): Path to file which should be uploaded
- `algorithm` (`string`, optional): The algorithm that should be used for encryption. Supports any block cipher in CBC mode. Default is aes-256-cbc
- `key` (`Buffer`, optional): Key used for encryption. If not provided, a new one will be generated
- `iv` (`Buffer`, optional): Initialization vector used by the algorithm. If not provided, a new one will be generated

```js
bin.uploadStream(stream, filename, length);
```

Uploads a file using a stream. Returns the uploaded file

- `stream` (`Readable`): A stream containing the file content
- `filename` (`string`): Filename the stream should be saved to
- `length` (`integer`): Size of the stream in bytes

```js
bin.downloadFile(filename, path);
```

Downloads a file to the specified path

- `filename` (`string`): Filename of the file which should be downloaded from the bin
- `path` (`string`, optional): Path to the directory the file should be saved to. If not specified, it will be saved to the current directory

```js
bin.downloadFileStream(filename);
```

Returns a readable stream for a file in the bin

- `filename` (`string`): Filename of the file which should be downloaded from the bin

```js
bin.downloadEncryptedFile(filename, key, iv, path, algorithm);
```

Downloads and decrypts a file to the specified path.

- `filename` (`string`): Filename of the file which should be downloaded from the bin
- `key` (`Buffer`): Key used for decryption
- `iv` (`Buffer`): Initialization vector used by the algorithm
- `path` (`string`, optional): Path to the directory the file should be saved to. If not spcecified, it will be saved to the current directory
- `algorithm` (`string`, optional): The algorithm that should be used for encryption. Supports any block cipher in CBC mode. Default is aes-256-cbc

```js
bin.downloadTarArchive(filename, path);
```

Downloads all files as a `.tar` to the specified path

- `filename` (`string`, optional): Name of the file the tar archive should be saved to. Default is archive.tar
- `path` (`string`, optional): Path to the directory the tar archive should be saved to. If not spcecified, it will be saved to the current directory

```js
bin.downloadZipArchive(filename, path);
```

Downloads all files as a `.zip` to the specified path

- `filename` (`string`, optional): Name of the file the zip archive should be saved to. Default is archive.zip
- `path` (`string`, optional): Path to the directory the zip archive should be saved to. If not spcecified, it will be saved to the current directory

```js
bin.saveQRCode(filename, path);
```

Saves the QR code for the bin

- `filename` (`string`, optional): Name of the file the QR code should be saved to
- `path` (`string`, optional): Path to a directory the tar archive should be saved to. If not spcecified, it will be saved to the current directory

```js
bin.showQRCode();
```

Displays a QR code in the terminal

```js
bin.delete();
```

Deletes the bin

```js
bin.deleteFile(filename);
```

Deletes a file from the bin. Returns the deleted file

- `filename` (`string`): Name of the file that should be deleted

```js
bin.getFile(identifier);
```

Returns the a file stored in a bin. If the file is not found, `undefined` is returned instead.

- `identifier` (`string`): Name or md5/sha256 hash of the file

---

## File

### Properties

| Property            | Description                   |
| ------------------- | ----------------------------- |
| `binId`             | Bin ID                        |
| `filename`          | Name of file                  |
| `contentType`       | MIME type                     |
| `bytes`             | Size in bytes                 |
| `bytesReadable`     | Size in human-readable format |
| `md5`               | MD5 file hash                 |
| `sha256`            | SHA256 file hash              |
| `createdAt`         | Time of creation              |
| `updatedAt`         | Time of last update           |
| `createdAtRelative` | Time since creation           |
| `updatedAtRelative` | Time since updated            |

### Methods

```js
file.delete();
```

Deletes the file from its bin. Returns the deleted file object

---
