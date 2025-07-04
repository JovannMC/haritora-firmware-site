import { packetSendDelay, type FirmwareVersion } from '../store/index';
import CRC32 from 'crc-32';
import SecureDfu from 'web-bluetooth-dfu';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { DFUPackage, type DFUProgress } from '.';

export class FirmwareUpdater {
	private dfu: SecureDfu | null = null;
	private progressCallback: ((progress: DFUProgress) => void) | null = null;
	private logCallback: ((message: string) => void) | null = null;

	constructor() {
		if (browser) {
			// adding the delay helps with lower-end/cheap BT adapters - it will make it slower, but will actually succeed!
			const delay = get(packetSendDelay);
			if (delay === -1) this.dfu = new SecureDfu(CRC32.buf, navigator.bluetooth);
			else this.dfu = new SecureDfu(CRC32.buf, navigator.bluetooth, delay);

			this.dfu.addEventListener('log', (event) => {
				console.log(`DFU Log: ${event.message}`);
				if (this.logCallback) this.logCallback(event.message);
			});

			// log every 4096 bytes
			let lastLoggedBytes = 0;
			this.dfu.addEventListener('progress', (event: DFUProgress) => {
				if (
					event.currentBytes - lastLoggedBytes >= 4096 ||
					event.currentBytes === event.totalBytes
				) {
					console.log(
						`DFU Progress: ${event.currentBytes}/${event.totalBytes} ${event.object} bytes`
					);
					lastLoggedBytes = event.currentBytes;
				}

				if (this.progressCallback) this.progressCallback(event);
			});
		}
	}

	setProgressCallback(callback: (progress: DFUProgress) => void) {
		this.progressCallback = callback;
	}

	setLogCallback(callback: (message: string) => void) {
		this.logCallback = callback;
	}

	// Step 1: put device into DFU mode
	async setUpdateMode(): Promise<BluetoothDevice | null> {
		if (!browser || !this.dfu) throw new Error('DFU not available in server environment');
		try {
			console.log('Scanning for devices to put into DFU mode...');
			// request device to put into DFU mode, when connected automatically puts it into DFU mode
			const device = await this.dfu.requestDevice(true, [{ namePrefix: 'HaritoraX' }]);

			if (!device) {
				console.log('Device is now in DFU mode, need to reconnect');
				return null;
			}

			return device;
		} catch (error) {
			console.error(`Error setting update mode: ${error}`);
			throw new Error(`Failed to set device to update mode: ${error}`);
		}
	}

	// Step 2: select device in DFU mode
	async selectDFUDevice(): Promise<BluetoothDevice> {
		if (!browser || !this.dfu) throw new Error('DFU not available in server environment');
		try {
			console.log('Scanning for DFU devices...');

			const device = await this.dfu.requestDevice(false, [{ services: [SecureDfu.SERVICE_UUID] }]);

			if (!device) throw new Error('No DFU device selected');

			console.log(`Selected DFU device: ${device.name}`);
			return device;
		} catch (error) {
			console.error(`Error selecting DFU device: ${error}`);
			throw new Error(`Failed to select DFU device: ${error}`);
		}
	}

	// Step 3: flash firmware to device
	async flashFirmware(device: BluetoothDevice, firmwareBuffer: ArrayBuffer): Promise<void> {
		if (!browser || !this.dfu) throw new Error('DFU not available in server environment');
		try {
			console.log('Loading firmware package...');

			const dfuPackage = new DFUPackage(firmwareBuffer);
			await dfuPackage.load();

			console.log('Firmware package loaded successfully');

			// Update base image (bootloader/softdevice) if present
			const baseImage = await dfuPackage.getBaseImage();
			if (baseImage) {
				console.log(`Updating ${baseImage.type}: ${baseImage.imageFile}...`);
				await this.dfu.update(device, baseImage.initData, baseImage.imageData);
			}

			// Update application image if present
			const appImage = await dfuPackage.getAppImage();
			if (appImage) {
				console.log(`Updating ${appImage.type}: ${appImage.imageFile}...`);
				await this.dfu.update(device, appImage.initData, appImage.imageData);
			}

			console.log('Firmware update completed successfully!');
		} catch (error) {
			console.error(`Error flashing firmware: ${error}`);
			throw new Error(`Failed to flash firmware: ${error}`);
		}
	}

	async downloadFirmware(firmwareVersion: FirmwareVersion): Promise<ArrayBuffer> {
		if (!browser) throw new Error('Firmware download not available in server environment');
		try {
			console.log(`Downloading firmware: ${firmwareVersion.filename}`);

			const response = await fetch(`${firmwareVersion.filename}`);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const buffer = await response.arrayBuffer();
			console.log(`Downloaded ${buffer.byteLength} bytes`);
			return buffer;
		} catch (error) {
			console.error(`Error downloading firmware: ${error}`);
			throw new Error(`Failed to download firmware: ${error}`);
		}
	}

	async updateFirmware(firmwareVersion: FirmwareVersion): Promise<void> {
		if (!browser) throw new Error('DFU not available in server environment');
		try {
			const firmwareBuffer = await this.downloadFirmware(firmwareVersion);
			const device = await this.selectDFUDevice();
			await this.flashFirmware(device, firmwareBuffer);
		} catch (error) {
			console.error(`Update process failed: ${error}`);
			throw error;
		}
	}
}

export const firmwareUpdater = browser ? new FirmwareUpdater() : null;
