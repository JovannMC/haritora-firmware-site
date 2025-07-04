import JSZip, { type JSZipObject } from "jszip";

export interface DFUProgress {
    object: string;
    totalBytes: number;
    currentBytes: number;
}

export interface DFUImage {
    type: string;
    initFile: string;
    imageFile: string;
    initData: ArrayBuffer;
    imageData: ArrayBuffer;
}

export class DFUPackage {
	private zipFile: JSZip | null = null;
	private manifest: JSZipObject | null = null;

	constructor(private buffer: ArrayBuffer) {}

	async load(): Promise<DFUPackage> {
		try {
			this.zipFile = await JSZip.loadAsync(this.buffer);

			const manifestFile = this.zipFile.file('manifest.json');
			if (!manifestFile) throw new Error('manifest.json not found in DFU package');
			const manifestContent = await manifestFile.async('string');
			this.manifest = JSON.parse(manifestContent).manifest;
			return this;
		} catch {
			throw new Error('Unable to find manifest, is this a proper DFU package?');
		}
	}

	private async getImage(types: string[]): Promise<DFUImage | null> {
		for (const type of types) {
			if (this.manifest && this.manifest[type]) {
				const entry = this.manifest[type];
				const result = {
					type: type,
					initFile: entry.dat_file,
					imageFile: entry.bin_file,
					initData: null as unknown as ArrayBuffer,
					imageData: null as unknown as ArrayBuffer
				};

				if (!this.zipFile) throw new Error('DFU package ZIP file is not loaded');
				const initFileObj = this.zipFile.file(result.initFile);
				if (!initFileObj) throw new Error(`Init file ${result.initFile} not found in DFU package`);
				result.initData = await initFileObj.async('arraybuffer');

				const imageFileObj = this.zipFile.file(result.imageFile);
				if (!imageFileObj)
					throw new Error(`Image file ${result.imageFile} not found in DFU package`);
				result.imageData = await imageFileObj.async('arraybuffer');
				return result;
			}
		}
		return null;
	}

	async getBaseImage(): Promise<DFUImage | null> {
		return this.getImage(['softdevice', 'bootloader', 'softdevice_bootloader']);
	}

	async getAppImage(): Promise<DFUImage | null> {
		return this.getImage(['application']);
	}
}