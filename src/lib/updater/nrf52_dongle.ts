// steps:
// select port via webusb. filter it via vids (04DA, 1915) and PIDs (3F18, 520F).
// write "o:4\n" into port to put into DFU mode, & manually select it again by filtering to new VID/PID - 1915, 521F
// then we need to write firmware. should refer to existing stuff to figure that one out
// idk how this will work lmao

import { packetSendDelay, type FirmwareVersion } from '../store/index';
import CRC32 from 'crc-32';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { DFUPackage, type DFUProgress, type DFUImage } from '.';

export class FirmwareUpdater {
	private progressCallback: ((progress: DFUProgress) => void) | null = null;
	private logCallback: ((message: string) => void) | null = null;

	// SLIP protocol constants
	private static readonly SLIP_END = 0xc0;
	private static readonly SLIP_ESC = 0xdb;
	private static readonly SLIP_ESC_END = 0xdc;
	private static readonly SLIP_ESC_ESC = 0xdd;

	// Nordic DFU opcodes
	private static readonly NRF_DFU_OP_OBJECT_SELECT = 0x06;
	private static readonly NRF_DFU_OP_OBJECT_CREATE = 0x01;
	private static readonly NRF_DFU_OP_OBJECT_WRITE = 0x08;
	private static readonly NRF_DFU_OP_CRC_GET = 0x03;
	private static readonly NRF_DFU_OP_OBJECT_EXECUTE = 0x04;
	private static readonly NRF_DFU_OP_RESPONSE = 0x60;

	// Object types
	private static readonly NRF_DFU_OBJ_TYPE_COMMAND = 0x01;
	private static readonly NRF_DFU_OBJ_TYPE_DATA = 0x02;

	constructor() {}

	setProgressCallback(callback: (progress: DFUProgress) => void) {
		this.progressCallback = callback;
	}

	setLogCallback(callback: (message: string) => void) {
		this.logCallback = callback;
	}

	// SLIP encoding/decoding
	private slipEncode(data: Uint8Array): Uint8Array {
		const result: number[] = [FirmwareUpdater.SLIP_END];

		for (let i = 0; i < data.length; i++) {
			const byte = data[i];
			if (byte === FirmwareUpdater.SLIP_END) {
				result.push(FirmwareUpdater.SLIP_ESC, FirmwareUpdater.SLIP_ESC_END);
			} else if (byte === FirmwareUpdater.SLIP_ESC) {
				result.push(FirmwareUpdater.SLIP_ESC, FirmwareUpdater.SLIP_ESC_ESC);
			} else {
				result.push(byte);
			}
		}

		result.push(FirmwareUpdater.SLIP_END);
		return new Uint8Array(result);
	}

	private slipDecode(data: Uint8Array): Uint8Array {
		const result: number[] = [];
		let inEscape = false;
		let inPacket = false;

		for (let i = 0; i < data.length; i++) {
			const byte = data[i];

			if (byte === FirmwareUpdater.SLIP_END) {
				if (inPacket) {
					// End of packet
					break;
				} else {
					// Start of packet
					inPacket = true;
					continue;
				}
			}

			if (!inPacket) continue;

			if (inEscape) {
				if (byte === FirmwareUpdater.SLIP_ESC_END) {
					result.push(FirmwareUpdater.SLIP_END);
				} else if (byte === FirmwareUpdater.SLIP_ESC_ESC) {
					result.push(FirmwareUpdater.SLIP_ESC);
				} else {
					throw new Error('Invalid SLIP escape sequence');
				}
				inEscape = false;
			} else if (byte === FirmwareUpdater.SLIP_ESC) {
				inEscape = true;
			} else {
				result.push(byte);
			}
		}

		return new Uint8Array(result);
	}

	private async sendSlipPacket(
		device: USBDevice,
		endpoint: USBEndpoint,
		packet: Uint8Array
	): Promise<void> {
		const encoded = this.slipEncode(packet);
		const result = await device.transferOut(endpoint.endpointNumber, encoded);
		if (result.status !== 'ok') {
			throw new Error(`USB transfer failed: ${result.status}`);
		}
	}

	private async receiveSlipPacket(device: USBDevice, endpoint: USBEndpoint): Promise<Uint8Array> {
		const response = await device.transferIn(endpoint.endpointNumber, 64);
		if (!response.data) {
			throw new Error('No response data received');
		}
		return this.slipDecode(new Uint8Array(response.data.buffer));
	}

	private async sendDfuCommand(
		device: USBDevice,
		outEndpoint: USBEndpoint,
		inEndpoint: USBEndpoint,
		packet: Uint8Array
	): Promise<Uint8Array> {
		await this.sendSlipPacket(device, outEndpoint, packet);
		const response = await this.receiveSlipPacket(device, inEndpoint);

		// Check if response is valid (should start with 0x60 = NRF_DFU_OP_RESPONSE)
		if (response.length < 3 || response[0] !== FirmwareUpdater.NRF_DFU_OP_RESPONSE) {
			throw new Error(
				`Invalid DFU response: ${Array.from(response)
					.map((b) => b.toString(16).padStart(2, '0'))
					.join(' ')}`
			);
		}

		// Check result code (NRF_DFU_RES_CODE_SUCCESS)
		if (response[2] !== 0x01) {
			throw new Error(`DFU command failed with result code: ${response[2]}`);
		}

		return response;
	}

	// Step 1: put device into DFU mode
	async setUpdateMode(): Promise<USBDevice | null> {
		if (!browser) throw new Error('DFU not available in server environment');
		try {
			console.log('Scanning for devices to put into DFU mode...');
			const device: USBDevice | null = await navigator.usb.requestDevice({
				filters: [
					{ vendorId: 0x04da, productId: 0x3f18 },
					{ vendorId: 0x1915, productId: 0x520f }
				]
			});

			if (device) {
				await new Promise((resolve) => setTimeout(resolve, 100));

				try {
					await device.open();
				} catch {
					// If open fails, try to open again
					console.log('First open failed, attempting to open again...');
					await new Promise((resolve) => setTimeout(resolve, 500));
					await device.open();
				}

				if (device.configuration === null) await device.selectConfiguration(1);

				// Find the "CDC Data" interface
				if (!device.configuration) throw new Error('Device configuration is undefined');
				const iface = device.configuration.interfaces.find(
					(i) => i.alternate.interfaceClass === 10
				);
				if (!iface) throw new Error('No suitable interface found on device');
				console.log(`Using interface ${iface.interfaceNumber} for DFU`);

				await device.claimInterface(iface.interfaceNumber);
				console.log(`Claimed interface ${iface.interfaceNumber}`);

				const encoder = new TextEncoder();
				const data = encoder.encode('\no:4\n');
				console.log(`Sending command to put device into DFU mode: ${data}`);

				// Find the OUT endpoint (direction: "out")
				const outEndpoint = iface.alternate.endpoints.find((e) => e.direction === 'out');
				if (!outEndpoint) throw new Error('No OUT endpoint found on interface');
				console.log(`Using OUT endpoint ${outEndpoint.endpointNumber}`);

				const result = await device.transferOut(outEndpoint.endpointNumber, data);
				if (result.status !== 'ok') throw new Error(`USB transfer failed: ${result.status}`);
				console.log(`DFU command sent successfully`);

				if (this.logCallback)
					this.logCallback(`Sent DFU command to device on endpoint ${outEndpoint.endpointNumber}`);
			}
			console.log('Device is now in DFU mode, need to reconnect');

			return device;
		} catch (error) {
			console.error(`Error setting update mode: ${error}`);
			throw new Error(`Failed to set device to update mode: ${error}`);
		}
	}

	// Step 2: select device in DFU mode
	async selectDFUDevice(): Promise<USBDevice> {
		if (!browser) throw new Error('DFU not available in server environment');
		try {
			console.log('Scanning for DFU devices...');

			const device = await navigator.usb.requestDevice({
				filters: [{ vendorId: 0x1915, productId: 0x521f }]
			});

			if (!device) throw new Error('No DFU device selected');
			return device;
		} catch (error) {
			console.error(`Error selecting DFU device: ${error}`);
			throw new Error(`Failed to select DFU device: ${error}`);
		}
	}

	// Step 3: flash firmware to device
	async flashFirmware(device: USBDevice, firmwareBuffer: ArrayBuffer): Promise<void> {
		if (!browser) throw new Error('DFU not available in server environment');
		try {
			console.log('Loading firmware package...');

			const dfuPackage = new DFUPackage(firmwareBuffer);
			await dfuPackage.load();

			console.log('Firmware package loaded successfully');

			// Open device and claim interface for DFU mode
			await device.open();
			if (device.configuration === null) await device.selectConfiguration(1);

			if (!device.configuration) throw new Error('Device configuration is undefined');
			const iface = device.configuration.interfaces.find((i) => i.alternate.interfaceClass === 10);
			if (!iface) throw new Error('No suitable interface found on device');

			await device.claimInterface(iface.interfaceNumber);

			// Find the OUT and IN endpoints
			const outEndpoint = iface.alternate.endpoints.find((e) => e.direction === 'out');
			const inEndpoint = iface.alternate.endpoints.find((e) => e.direction === 'in');
			if (!outEndpoint || !inEndpoint) {
				throw new Error('Required endpoints not found on interface');
			}

			// Update base image (bootloader/softdevice) if present
			const baseImage = await dfuPackage.getBaseImage();
			if (baseImage) {
				console.log(`Updating ${baseImage.type}: ${baseImage.imageFile}...`);
				await this.updateImage(device, outEndpoint, inEndpoint, baseImage);
			}

			// Update application image if present
			const appImage = await dfuPackage.getAppImage();
			if (appImage) {
				console.log(`Updating ${appImage.type}: ${appImage.imageFile}...`);
				await this.updateImage(device, outEndpoint, inEndpoint, appImage);
			}

			console.log('Firmware update completed successfully!');
		} catch (error) {
			console.error(`Error flashing firmware: ${error}`);
			throw new Error(`Failed to flash firmware: ${error}`);
		}
	}

	private async updateImage(
		device: USBDevice,
		outEndpoint: USBEndpoint,
		inEndpoint: USBEndpoint,
		image: DFUImage
	): Promise<void> {
		const objectType =
			image.type === 'application'
				? FirmwareUpdater.NRF_DFU_OBJ_TYPE_DATA
				: FirmwareUpdater.NRF_DFU_OBJ_TYPE_COMMAND;

		if (this.logCallback) this.logCallback(`Updating ${image.type}...`);

		// process init data first
		if (objectType === FirmwareUpdater.NRF_DFU_OBJ_TYPE_COMMAND) {
			await this.processObject(
				device,
				outEndpoint,
				inEndpoint,
				FirmwareUpdater.NRF_DFU_OBJ_TYPE_COMMAND,
				image.initData,
				'init'
			);
		}

		// then process main data (firmware)
		await this.processObject(
			device,
			outEndpoint,
			inEndpoint,
			objectType,
			image.imageData,
			image.type
		);
	}

	private async processObject(
		device: USBDevice,
		outEndpoint: USBEndpoint,
		inEndpoint: USBEndpoint,
		objectType: number,
		data: ArrayBuffer,
		name: string
	): Promise<void> {
		const dataArray = new Uint8Array(data);
		const totalSize = dataArray.length;

		if (this.logCallback) this.logCallback(`Processing ${name} object (${totalSize} bytes)...`);

		// Select object type
		const selectPacket = new Uint8Array([FirmwareUpdater.NRF_DFU_OP_OBJECT_SELECT, objectType]);
		await this.sendDfuCommand(device, outEndpoint, inEndpoint, selectPacket);

		// Create object with size
		const sizeBytes = new Uint8Array(4);
		new DataView(sizeBytes.buffer).setUint32(0, totalSize, true); // little-endian
		const createPacket = new Uint8Array([
			FirmwareUpdater.NRF_DFU_OP_OBJECT_CREATE,
			objectType,
			...sizeBytes
		]);
		await this.sendDfuCommand(device, outEndpoint, inEndpoint, createPacket);

		// Write data in chunks
		await this.writeDataInChunks(device, outEndpoint, inEndpoint, dataArray, name);

		// Get CRC to verify if sent correctly
		const crcPacket = new Uint8Array([FirmwareUpdater.NRF_DFU_OP_CRC_GET]);
		const crcResponse = await this.sendDfuCommand(device, outEndpoint, inEndpoint, crcPacket);

		// Extract CRC from response (bytes 3-6, little-endian)
		const responseCrc = new DataView(crcResponse.buffer).getUint32(3, true);
		const calculatedCrc = CRC32.buf(dataArray) >>> 0; // Ensure unsigned

		if (responseCrc !== calculatedCrc) {
			throw new Error(
				`CRC mismatch: expected ${calculatedCrc.toString(16)}, got ${responseCrc.toString(16)}`
			);
		}

		if (this.logCallback) this.logCallback(`CRC verified: ${responseCrc.toString(16)}`);

		// Execute object
		const executePacket = new Uint8Array([FirmwareUpdater.NRF_DFU_OP_OBJECT_EXECUTE]);
		await this.sendDfuCommand(device, outEndpoint, inEndpoint, executePacket);

		if (this.logCallback) this.logCallback(`${name} object completed successfully`);
	}

	private async writeDataInChunks(
		device: USBDevice,
		outEndpoint: USBEndpoint,
		inEndpoint: USBEndpoint,
		data: Uint8Array,
		type: string
	): Promise<void> {
		const maxChunkSize = 244;
		const totalBytes = data.length;
		let sentBytes = 0;

		for (let offset = 0; offset < totalBytes; offset += maxChunkSize) {
			const chunk = data.slice(offset, Math.min(offset + maxChunkSize, totalBytes));

			const writePacket = new Uint8Array([FirmwareUpdater.NRF_DFU_OP_OBJECT_WRITE, ...chunk]);
			await this.sendDfuCommand(device, outEndpoint, inEndpoint, writePacket);

			sentBytes += chunk.length;

			if (this.progressCallback) {
				this.progressCallback({
					object: type,
					currentBytes: sentBytes,
					totalBytes: totalBytes
				});
			}

			// TODO: do we need the delay? was for BLE mostly
			const delay = get(packetSendDelay) || 1;
			if (delay > 0) {
				await new Promise((resolve) => setTimeout(resolve, delay));
			}

			if (this.logCallback && sentBytes % (maxChunkSize * 10) === 0) {
				this.logCallback(`Written ${sentBytes}/${totalBytes} bytes of ${type}`);
			}
		}

		if (this.logCallback) {
			this.logCallback(`Completed writing ${totalBytes} bytes of ${type} data`);
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
