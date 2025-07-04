<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { packetSendDelay, showAllVersions, type FirmwareVersion } from '$lib/store';
	import { Device, firmwareVersions } from '$lib/store';
	import { addToast } from '$lib/store/ToastProvider';
	import { firmwareUpdater as dfuBLE } from '$lib/updater/nrf52';
	import { firmwareUpdater as dfuSerial } from '$lib/updater/nrf52_dongle';
	import Icon from '@iconify/svelte';
	import { Progress } from '@skeletonlabs/skeleton-svelte';
	import { browser } from '$app/environment';

	let selectedDevice = $state<Device>(Device.HaritoraX2);
	let firmwareList = $derived(firmwareVersions[selectedDevice]);
	let selectedFirmware = $state<FirmwareVersion>();

	let firmwareUpdater = $state<typeof dfuBLE | typeof dfuSerial | null>(null);
	let dfuDevice = $state<USBDevice | BluetoothDevice | null>(null);
	let updateProgress = $state(0);
	let updateStatus = $state(m['dfu.status.waiting']());
	let isUpdating = $state(false);
	let hasSupport = $state(true);
	let logMessages = $state<string[]>([]);

	// TODO: use connection_lost and cancelled

	$effect(() => {
		// TODO: don't automatically change selectedFirmware dropdown when simply toggling the "show all versions" option
		selectedFirmware = $showAllVersions ? firmwareList[0] : firmwareList.find((fw) => !fw.untested);
	});

	$effect(() => {
		console.log(`Device: ${selectedDevice}`);
		async function run() {
			if (!browser) return;

			// set new updater when selectedDevice changes
			if (selectedDevice === Device.GX) {
				if (!navigator.usb) {
					console.log('WebUSB API supported: No');
					addToast('error', m['toasts.web_usb_not_supported'](), false);
					hasSupport = false;
					return;
				}

				console.log('Web USB API supported: Yes');
				firmwareUpdater = dfuSerial;
				if (dfuSerial) {
					dfuSerial.setProgressCallback((progress) => {
						updateProgress = Math.round((progress.currentBytes / progress.totalBytes) * 100);
						updateStatus = m['dfu.status.updating']({
							progress: updateProgress,
							total: progress.totalBytes,
							current: progress.currentBytes
						});
					});

					dfuSerial.setLogCallback((message) => {
						logMessages = [...logMessages, message];
					});
				}
			} else {
				if (!navigator.bluetooth || !(await navigator.bluetooth.getAvailability())) {
					console.log('Bluetooth API supported: No');
					addToast('error', m['toasts.web_bluetooth_not_supported'](), false);
					hasSupport = false;
					return;
				}

				console.log('Bluetooth API supported: Yes');

				firmwareUpdater = dfuBLE;
				if (dfuBLE) {
					dfuBLE.setProgressCallback((progress) => {
						updateProgress = Math.round((progress.currentBytes / progress.totalBytes) * 100);
						updateStatus = m['dfu.status.updating']({
							progress: updateProgress,
							total: progress.totalBytes,
							current: progress.currentBytes
						});
					});

					dfuBLE.setLogCallback((message) => {
						logMessages = [...logMessages, message];
					});
				}
			}
		}
		run();
	});

	// TODO: support GX dongle (serial)
	async function handleCheckVersion() {
		try {
			isUpdating = true;
			updateStatus = m['dfu.status.checking_version']();

			const device = await navigator.bluetooth.requestDevice({
				filters: [{ namePrefix: 'HaritoraX' }],
				optionalServices: ['device_information']
			});
			console.log(`Selected device: ${device.name}`);

			const server = await device?.gatt?.connect();
			console.log('Connected to GATT server');

			const service = await server?.getPrimaryService('device_information');
			console.log('Got device_information service');

			const characteristic = await service?.getCharacteristic(0x2a28);
			console.log('Got 2a28 (Software Revision String) characteristic');

			const value = await characteristic?.readValue();
			const decoder = new TextDecoder('utf-8');

			const firmwareVersion = value ? decoder.decode(new Uint8Array(value.buffer)) : '';
			let firmwareDate = '';
			const found = firmwareList.find((fw) => fw.version === firmwareVersion);
			firmwareDate = found ? found.date : 'Unknown';

			addToast('info', `${firmwareVersion} (${firmwareDate})`, false);
			console.log(`Firmware version: ${firmwareVersion} (${firmwareDate})`);
			updateStatus = m['dfu.status.got_version']({
				version: firmwareVersion,
				date: firmwareDate
			});
			logMessages = [...logMessages, `Firmware version: ${firmwareVersion} (${firmwareDate})`];
		} catch (error) {
			updateStatus = `${error instanceof Error ? error.message : 'Unknown error'}`;
			addToast('error', updateStatus, false);
			console.error('Check version error:', error);
		} finally {
			isUpdating = false;
		}
	}

	async function handleSetUpdateMode() {
		try {
			isUpdating = true;
			updateStatus = m['dfu.status.setting_update_mode']();

			if (!firmwareUpdater) {
				updateStatus = m['dfu.status.firmware_updater_not_initialized']();
				return;
			}

			await firmwareUpdater.setUpdateMode();
			updateStatus = m['dfu.status.set_update_mode']();
			addToast('success', m['dfu.status.set_update_mode'](), true);
		} catch (error) {
			updateStatus = `${error instanceof Error ? error.message : 'Unknown error'}`;
			console.error('Set update mode error:', error);
			addToast('error', updateStatus, false);
		} finally {
			isUpdating = false;
		}
	}

	async function handleSelectDFUDevice() {
		try {
			isUpdating = true;
			updateStatus = m['dfu.status.selecting_dfu']();

			if (!firmwareUpdater) {
				updateStatus = m['dfu.status.firmware_updater_not_initialized']();
				addToast('error', updateStatus, false);
				return;
			}

			dfuDevice = await firmwareUpdater.selectDFUDevice();
			updateStatus = m['dfu.status.dfu_selected']();
			addToast('success', m['dfu.status.dfu_selected'](), true);
		} catch (error) {
			updateStatus = `${error instanceof Error ? error.message : 'Unknown error'}`;
			addToast('error', updateStatus, false);
			console.error('Select DFU device error:', error);
		} finally {
			isUpdating = false;
		}
	}

	async function handleFlashFirmware() {
		if (!dfuDevice || !selectedFirmware) {
			updateStatus = m['dfu.status.please_select']();
			addToast('warning', updateStatus, false);
			return;
		}

		try {
			isUpdating = true;
			updateProgress = 0;
			updateStatus = m['dfu.status.starting_update']();

			if (!firmwareUpdater) {
				updateStatus = m['dfu.status.firmware_updater_not_initialized']();
				addToast('error', updateStatus, false);
				return;
			}

			const firmwareBuffer = await firmwareUpdater.downloadFirmware(selectedFirmware);
			if (selectedDevice === Device.GX) {
				// wtf
				await (firmwareUpdater as typeof dfuSerial)!.flashFirmware(
					dfuDevice as USBDevice,
					firmwareBuffer
				);
			} else {
				// is this lmao
				await (firmwareUpdater as typeof dfuBLE)!.flashFirmware(
					dfuDevice as BluetoothDevice,
					firmwareBuffer
				);
			}

			updateStatus = m['dfu.status.firmware_completed']();
			addToast('success', m['dfu.status.firmware_completed'](), true);
			updateProgress = 100;
		} catch (error) {
			updateStatus = `${error instanceof Error ? error.message : 'Unknown error'}`;
			addToast('error', updateStatus, false);
			console.error('Flash firmware error:', error);
		} finally {
			isUpdating = false;
		}
	}
</script>

<svelte:head>
	<title>SlimeTora: DFU</title>
</svelte:head>

<div class="mx-auto w-full max-w-2xl space-y-6">
	<!-- Device and firmware selection -->
	<div class="flex flex-col flex-wrap gap-6 rounded-lg bg-gray-800 p-6 shadow">
		<!-- Selection row -->
		<div class="flex w-full min-w-0 flex-col gap-6 md:flex-row">
			<div class="min-w-0 flex-1">
				<label class="mb-2 block font-semibold" for="device-select">{m['select.device']()}</label>
				<select id="device-select" class="select w-full" bind:value={selectedDevice}>
					{#each Object.values(Device) as device}
						<option value={device}>{device}</option>
					{/each}
				</select>
			</div>
			<div class="min-w-0 flex-1">
				<label class="mb-2 block font-semibold" for="firmware-select"
					>{m['select.firmware']()}</label
				>
				<select id="firmware-select" class="select w-full" bind:value={selectedFirmware}>
					{#each firmwareList as fw}
						<!-- hide any "unknown" versions if showAllVersions is disabled (e.g. is a commit hash) -->
						{#if $showAllVersions || !fw.untested}
							<option value={fw}
								>{m['firmware.version']({ version: fw.version, date: fw.date })}</option
							>
						{/if}
					{/each}
				</select>
			</div>
		</div>
		<hr class="hr" />
		<!-- Settings row -->
		<div class="flex w-full min-w-[250px] flex-col">
			<p class="mb-2 block font-semibold">{m['settings.settings']?.()}</p>
			<div class="flex flex-col justify-between gap-2 md:flex-row">
				<div class="flex items-center gap-2">
					<span class="text-sm">{m['settings.packet_send_delay']?.()}:</span>
					<input
						type="number"
						min="-1"
						placeholder="1"
						class="input input-sm w-20"
						bind:value={$packetSendDelay}
					/>
					<button
						class="btn-icon variant-ghost"
						onclick={() => addToast('info', m['toasts.packet_send_delay_description'](), false)}
					>
						<Icon icon="mdi:information-outline" />
					</button>
				</div>
				<div class="flex items-center gap-2">
					<label for="show-untested" class="text-sm">{m['settings.show_all_versions']?.()}:</label>
					<input
						type="checkbox"
						id="show-untested"
						class="checkbox"
						bind:checked={$showAllVersions}
					/>
					<button
						class="btn-icon variant-ghost"
						onclick={() => addToast('info', m['toasts.show_all_versions_description'](), false)}
					>
						<Icon icon="mdi:information-outline" />
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Release notes -->
	{#if selectedFirmware}
		<div class="rounded-lg bg-gray-800 p-6 shadow">
			<strong class="mb-2 block">{m['firmware.release_notes']()}:</strong>
			<div class="whitespace-pre-line text-gray-300">{selectedFirmware?.notes}</div>
		</div>
	{/if}

	<!-- DFU Steps -->
	<div class="flex flex-col items-center gap-6 rounded-lg bg-gray-800 p-6 shadow">
		<div class="flex flex-col items-center justify-center gap-3">
			<div class="text-center">
				<p>{m['dfu.step.check_version']({ device: selectedDevice })}</p>
				<p class="text-sm opacity-70">{m['dfu.step_note.check_version']()}</p>
			</div>
			<button
				class="btn bg-primary-500"
				disabled={isUpdating || !hasSupport}
				onclick={handleCheckVersion}
			>
				{m['dfu.button.check_version']()}
			</button>
		</div>
		<hr class="hr" />
		<div class="flex flex-col items-center justify-center gap-3">
			<div class="text-center">
				<p>{m['dfu.step.set_update_mode']({ device: selectedDevice })}</p>
				<p class="text-sm opacity-70">
					{selectedDevice === Device.HaritoraX2
						? m['dfu.step_note.set_update_mode']().replace('HaritoraXW-Update', 'HaritoraX2-Update')
						: m['dfu.step_note.set_update_mode']()}
				</p>
			</div>
			<button
				class="btn bg-primary-500"
				disabled={isUpdating || !hasSupport}
				onclick={handleSetUpdateMode}
			>
				{m['dfu.button.set_update_mode']()}
			</button>
		</div>
		<hr class="hr" />
		<div class="flex flex-col items-center justify-center gap-3">
			<div class="text-center">
				<p>{m['dfu.step.select_update_mode']({ device: selectedDevice })}</p>
				<p class="text-sm opacity-70">
					{selectedDevice === Device.HaritoraX2
						? m['dfu.step_note.select_update_mode']().replace(
								'HaritoraXW-Update',
								'HaritoraX2-Update'
							)
						: m['dfu.step_note.select_update_mode']()}
				</p>
			</div>
			<button
				class="btn bg-primary-500"
				disabled={isUpdating || !hasSupport}
				onclick={handleSelectDFUDevice}
			>
				{m['dfu.button.select_update_mode']()}
			</button>
		</div>
		<hr class="hr" />
		<div class="flex flex-col items-center justify-center gap-3">
			<div class="text-center">
				<p>{m['dfu.step.flash']({ device: selectedDevice })}</p>
				<p class="text-sm opacity-70">{m['dfu.step_note.flash']()}</p>
			</div>
			<button
				class="btn bg-secondary-500"
				disabled={isUpdating || !dfuDevice || !selectedFirmware}
				onclick={handleFlashFirmware}
			>
				{m['dfu.button.flash']()}
			</button>
		</div>
		<hr class="hr" />
		<div class="flex w-full flex-col items-center justify-center gap-4 text-center">
			<p>{m['dfu.status.status']({ status: updateStatus })}</p>
			<Progress value={updateProgress > 0 ? updateProgress : null} />
		</div>
	</div>

	<!-- Debug log -->
	{#if logMessages.length > 0}
		<div class="rounded-lg bg-gray-800 p-6 shadow">
			<strong class="mb-2 block">Debug Log:</strong>
			<div class="max-h-40 overflow-y-auto font-mono text-xs text-gray-400">
				{#each logMessages as message}
					<div>{message}</div>
				{/each}
			</div>
		</div>
	{/if}

	<p class="mt-10 text-center text-sm opacity-70">
		{m['disclaimer']()}
	</p>
	<p class="text-center text-sm opacity-70">
		{__APP_VERSION__} - {__COMMIT_HASH__}
	</p>
</div>
