import { type FirmwareVersion, Device, firmwareVersions } from '$lib/store';
import { addToast } from '$lib/store/ToastProvider';
import { m } from '$lib/paraglide/messages.js';
import { get } from 'svelte/store';

export class SimulatedUpdater {
	private logCallback: ((message: string) => void) | null = null;
	private progressCallback:
		| ((progress: { currentBytes: number; totalBytes: number }) => void)
		| null = null;

	setLogCallback(callback: (message: string) => void) {
		this.logCallback = callback;
	}

	setProgressCallback(callback: (progress: { currentBytes: number; totalBytes: number }) => void) {
		this.progressCallback = callback;
	}

	private log(message: string) {
		if (this.logCallback) {
			this.logCallback(message);
		}
	}

	private updateProgress(currentBytes: number, totalBytes: number) {
		if (this.progressCallback) {
			this.progressCallback({ currentBytes, totalBytes });
		}
	}

	private async logWithDelay(message: string, delay: number = 50) {
		await new Promise((resolve) => setTimeout(resolve, delay));
		this.log(message);
	}

	private async logSequence(logs: Array<{ message: string; delay?: number }>) {
		for (const { message, delay = 50 } of logs) {
			await this.logWithDelay(message, delay);
		}
	}

	getRandomFirmwareVersion(
		selectedDevice: Device,
		currentFirmware?: FirmwareVersion
	): FirmwareVersion {
		const currentVersions = get(firmwareVersions);
		const versions = currentVersions[selectedDevice].filter(
			(fw) => fw.version !== currentFirmware?.version
		);
		return (
			versions[Math.floor(Math.random() * versions.length)] || currentVersions[selectedDevice][0]
		);
	}

	getSimulatedDeviceName(selectedDevice: Device): string {
		switch (selectedDevice) {
			case Device.HaritoraX2:
				return 'HaritoraX2-CA7B90';
			case Device.HaritoraXWireless:
				return 'HaritoraXW-AF2DM1';
			default:
				return 'HaritoraXW-Demo';
		}
	}

	getSimulatedDFUDeviceName(selectedDevice: Device): string {
		switch (selectedDevice) {
			case Device.HaritoraX2:
				return 'HaritoraX2-Update';
			case Device.HaritoraXWireless:
				return 'HaritoraXW-Update';
			default:
				return 'HaritoraXW-Update';
		}
	}

	async simulateCheckVersion(
		selectedDevice: Device,
		selectedFirmware?: FirmwareVersion
	): Promise<string> {
		const deviceName = this.getSimulatedDeviceName(selectedDevice);

		await this.logSequence([
			{ message: `Selected device: ${deviceName}`, delay: 500 },
			{ message: 'Connected to GATT server', delay: 300 },
			{ message: 'Got device_information service', delay: 200 },
			{ message: 'Got 2a28 (Software Revision String) characteristic', delay: 300 }
		]);

		const simulatedVersion = this.getRandomFirmwareVersion(selectedDevice, selectedFirmware);

		addToast('info', `${simulatedVersion.version} (${simulatedVersion.date})`, false);
		this.log(`Firmware version: ${simulatedVersion.version} (${simulatedVersion.date})`);

		return m['dfu.status.got_version']({
			version: simulatedVersion.version,
			date: simulatedVersion.date
		});
	}

	async simulateSetUpdateMode(): Promise<string> {
		await this.logSequence([
			{ message: 'connected to gatt server', delay: Math.random() * 1024 },
			{ message: 'found DFU service' },
			{ message: 'found 1 characteristic(s)' },
			{ message: 'found buttonless characteristic' },
			{ message: 'enabled buttonless notifications' },
			{ message: 'sent DFU mode', delay: 200 }
		]);

		const status = m['dfu.status.set_update_mode']();
		addToast('success', status, true);
		return status;
	}

	async simulateSelectDFUDevice(
		selectedDevice: Device
	): Promise<{ device: BluetoothDevice; status: string }> {
		await new Promise((resolve) => setTimeout(resolve, Math.random() * 1024));

		const dfuDeviceName = this.getSimulatedDFUDeviceName(selectedDevice);

		const mockDevice = { name: dfuDeviceName } as BluetoothDevice;
		const status = m['dfu.status.dfu_selected']();
		addToast('success', status, true);

		return { device: mockDevice, status };
	}

	async simulateFlashFirmware(): Promise<string> {
		const totalSteps = 20;
		const totalBytes = 339224; // random file size from an actual file, idk lol

		await this.logSequence([
			{ message: 'connected to gatt server' },
			{ message: 'found DFU service' },
			{ message: 'found 2 characteristic(s)' },
			{ message: 'found packet characteristic' },
			{ message: 'found control characteristic' },
			{ message: 'enabled control notifications' },
			{ message: 'transferring init', delay: 300 },
			{ message: 'written 145 bytes', delay: 100 },
			{ message: 'transfer complete', delay: 100 },
			{ message: 'transferring firmware' }
		]);

		// simulate flash progress
		for (let i = 0; i <= totalSteps; i++) {
			await new Promise((resolve) => setTimeout(resolve, Math.random() * 500));
			const progress = Math.round((i / totalSteps) * 100);
			const currentBytes = Math.round((progress / 100) * totalBytes);

			this.updateProgress(currentBytes, totalBytes);

			if (i > 0 && i % 2 === 0) {
				this.log(`written ${currentBytes} bytes`);
			}
		}

		await this.logSequence([
			{ message: 'transfer complete', delay: 100 },
			{ message: 'complete, disconnecting...' },
			{ message: 'disconnected' }
		]);

		const status = m['dfu.status.firmware_completed']();
		addToast('success', status, true);
		return status;
	}
}

export const simulatedUpdater = new SimulatedUpdater();
