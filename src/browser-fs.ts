declare global {
  interface Navigator {
    webkitPersistentStorage: any
  }

  interface Window {
    webkitRequestFileSystem: any
    requestFileSystem: any
    PERSISTENT: any
    TEMPORARY: any
    storageInfo: any
    webkitStorageInfo: any
  }
}

//
// ─── ANCHOR FALLBACKS ───────────────────────────────────────────────────────────
//
window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem
const PERSISTENT = window.PERSISTENT
const TEMPORARY = window.TEMPORARY

//
// ─── ANCHOR UTILS ───────────────────────────────────────────────────────────────
//
function checkBrowser() {
  if (!navigator.storage || !navigator.storage.persist) throw new Error('FS not supported')
}
// Disabled for Illegal error
// function promisify<T>(fn: (...args: any[]) => void, ...args: any[]): Promise<T> {
//   return new Promise((resolve, reject) => {
//     args.push((success: any) => resolve(success))
//     args.push((err: Error) => reject(err))
//     fn(...args)
//   })
// }

interface IConfig {
  size?: number
  temporary?: boolean
}

//
// ─── ANCHOR WORKSPACE CLASS ─────────────────────────────────────────────────────
//
export default class Workspace {
  private config: IConfig
  private mode: string
  private size: number

  public fs: Promise<any>

  constructor(config: IConfig = {}) {
    checkBrowser()
    const defaultSize = 1024 * 1024 * 500
    const defaultOptions = { size: defaultSize, temporary: false }
    this.config = { ...defaultOptions, ...config }

    this.mode = this.config.temporary ? TEMPORARY : PERSISTENT
    this.size = this.config.size || defaultSize
    this.fs = this.getFS()
  }

  static create(config: IConfig): Workspace {
    return new Workspace(config)
  }

  //
  // ─── ANCHOR CORE METHODS ────────────────────────────────────────────────────────
  //
  private requestQuota(): Promise<number> {
    return new Promise((resolve, reject) =>
      navigator.webkitPersistentStorage.requestQuota(
        this.size,
        (bytes: number) => resolve(bytes),
        (err: Error) => reject(err)
      )
    )
  }

  private requestFS(bytes: number) {
    bytes = bytes || this.size
    return new Promise((resolve, reject) =>
      window.requestFileSystem(
        this.mode,
        bytes,
        (success: any) => resolve(success),
        (err: any) => reject(err)
      )
    )
  }

  private async getFS(): Promise<any> {
    const availableBytes = await this.requestQuota()
    const canPersist = await navigator.storage.persist()
    if (!canPersist) throw new Error('Not possible to persist storage')
    const fs = await this.requestFS(availableBytes)
    return fs
  }

  //
  // ─── ANCHOR PUBLIC API ──────────────────────────────────────────────────────────
  //
  public removeFile(file: string) {}

  public async createFolder(folderName: string) {
    const fs = await this.fs
    return new Promise((resolve, reject) =>
      fs.root.getDirectory(
        folderName,
        { create: true },
        (success: any) => resolve(success),
        (err: any) => reject(err)
      )
    )
  }

  public async getFolder(folderName: string) {
    const fs = await this.fs
    return new Promise((resolve, reject) =>
      fs.root.getDirectory(
        folderName,
        { create: false },
        (success: any) => resolve(success),
        (err: any) => reject(err)
      )
    )
  }

  public async getFileEntry(filePath: string): Promise<any> {
    const fs = await this.fs
    return new Promise((resolve, reject) => {
      fs.root.getFile(
        filePath,
        { create: false },
        (fileEntry: any) => resolve(fileEntry),
        (err: any) => reject(err)
      )
    })
  }

  public async getFile(filePath: string): Promise<any> {
    const fs = await this.fs
    const fileEntry: any = this.getFileEntry(filePath)

    return new Promise((resolve, reject) =>
      fileEntry.file((file: Blob) => resolve(file), (err: any) => reject(err))
    )
  }

  public async createFile(filePath: string): Promise<any> {
    const fs = await this.fs
    return new Promise((resolve, reject) =>
      fs.root.getFile(
        filePath,
        { create: true },
        (success: any) => resolve(success),
        (err: any) => reject(err)
      )
    )
  }

  public async saveFile(name: string, blob: Blob, folderName?: string) {
    const file: any = await this.createFile(name)
    return new Promise((resolve, reject) =>
      file.createWriter(async (content: any) => {
        await content.write(blob)

        if (!folderName) return resolve(true)
        const folder = await this.getFolder(folderName)
        file.moveTo(folder)
        return resolve(true)
      })
    )
  }
}
