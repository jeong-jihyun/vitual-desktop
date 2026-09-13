// host-agent/file_transfer.py 의 프로토콜과 1:1로 대응한다.
// 기존 "input" DataChannel 하나를 그대로 재사용해 JSON 제어 메시지와
// 바이너리 파일 조각을 함께 주고받는다.

const CHUNK_SIZE = 16 * 1024;
const BUFFERED_AMOUNT_LOW_THRESHOLD = 256 * 1024;

export interface SharedFile {
  name: string;
  size: number;
}

export class FileTransferChannel {
  private channel: RTCDataChannel;

  private downloadMeta: { name: string; size: number } | null = null;
  private downloadBuffers: ArrayBuffer[] = [];

  onFileList: ((files: SharedFile[]) => void) | null = null;
  onDownloadProgress: ((receivedBytes: number, totalBytes: number) => void) | null = null;
  onDownloadComplete: ((name: string, blob: Blob) => void) | null = null;
  onDownloadError: ((message: string) => void) | null = null;

  constructor(channel: RTCDataChannel) {
    this.channel = channel;
  }

  /** RemoteView의 channel.onmessage에서 문자열(JSON) 메시지를 위임받는다.
   *  파일 관련 메시지가 아니면 false를 반환해 다른 핸들러가 처리하게 한다. */
  handleTextMessage(msg: { type?: string; [key: string]: unknown }): boolean {
    switch (msg.type) {
      case "file-list-response":
        this.onFileList?.((msg.files as SharedFile[]) ?? []);
        return true;
      case "file-download-meta":
        this.downloadMeta = { name: msg.name as string, size: msg.size as number };
        this.downloadBuffers = [];
        this.onDownloadProgress?.(0, this.downloadMeta.size);
        return true;
      case "file-download-end":
        if (this.downloadMeta) {
          const blob = new Blob(this.downloadBuffers, { type: "application/octet-stream" });
          this.onDownloadComplete?.(this.downloadMeta.name, blob);
        }
        this.downloadMeta = null;
        this.downloadBuffers = [];
        return true;
      case "file-download-error":
        this.onDownloadError?.((msg.error as string) ?? "다운로드에 실패했습니다.");
        this.downloadMeta = null;
        this.downloadBuffers = [];
        return true;
      default:
        return false;
    }
  }

  /** 바이너리(ArrayBuffer) 메시지 - 다운로드 중인 파일의 조각. */
  handleBinaryMessage(data: ArrayBuffer): void {
    if (!this.downloadMeta) return;
    this.downloadBuffers.push(data);
    const received = this.downloadBuffers.reduce((sum, b) => sum + b.byteLength, 0);
    this.onDownloadProgress?.(received, this.downloadMeta.size);
  }

  requestFileList(): void {
    this.send({ type: "file-list-request" });
  }

  requestDownload(name: string): void {
    this.send({ type: "file-download-start", name });
  }

  async uploadFile(file: File, onProgress?: (sent: number, total: number) => void): Promise<void> {
    const id = crypto.randomUUID();
    this.send({ type: "file-upload-start", id, name: file.name, size: file.size });

    let offset = 0;
    while (offset < file.size) {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await slice.arrayBuffer();
      await this.sendBinaryWithBackpressure(buffer);
      offset += buffer.byteLength;
      onProgress?.(offset, file.size);
    }
    this.send({ type: "file-upload-end", id });
  }

  private send(json: Record<string, unknown>): void {
    this.channel.send(JSON.stringify(json));
  }

  private sendBinaryWithBackpressure(buffer: ArrayBuffer): Promise<void> {
    this.channel.send(buffer);
    if (this.channel.bufferedAmount < BUFFERED_AMOUNT_LOW_THRESHOLD) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.channel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_THRESHOLD;
      const handler = () => {
        this.channel.removeEventListener("bufferedamountlow", handler);
        resolve();
      };
      this.channel.addEventListener("bufferedamountlow", handler);
    });
  }
}
