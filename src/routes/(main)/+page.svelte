<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import {
		packetSendDelay,
		demoMode,
		type FirmwareVersion,
		urlPrefix,
		getDFUCommand
	} from '$lib/store';
	import { Device, firmwareVersions } from '$lib/store';
	import { addToast } from '$lib/store/ToastProvider';
	import { firmwareUpdater } from '$lib/store/updater';
	import { simulatedUpdater } from '$lib/store/simulated-updater';
	import Icon from '@iconify/svelte';
	import { Progress } from '@skeletonlabs/skeleton-svelte';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	let selectedDevice = $state(Device.HaritoraX2);
	let firmwareList = $derived($firmwareVersions[selectedDevice]);
	let selectedFirmware = $state<FirmwareVersion>();
	let showAllVersions = $state(false);
	let manualUpdate = $state(false);

	let dfuDevice = $state<BluetoothDevice | null>(null);
	let updateProgress = $state(0);
	let updateStatus = $state(m['dfu.status.waiting']());
	let isUpdating = $state(false);
	let hasSupport = $state(true);
	let logMessages = $state<string[]>([]);
	let logContainer = $state<HTMLDivElement | null>(null);
	let wasScrolledToBottom = $state(true);

	function handleScroll() {
		if (!logContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = logContainer;
		wasScrolledToBottom = scrollTop + clientHeight >= scrollHeight - 5; // 5px tolerance
	}

	// auto-scroll for debug log
	$effect(() => {
		// if user was at bottom/is first message, scroll to bottom
		if (logContainer && logMessages.length > 0 && wasScrolledToBottom)
			requestAnimationFrame(() => {
				logContainer!.scrollTop = logContainer!.scrollHeight;
				wasScrolledToBottom = true;
			});
	});

	// TODO: use connection_lost and cancelled

	$effect(() => {
		// TODO: don't automatically change selectedFirmware dropdown when simply toggling the "show all versions" option
		selectedFirmware = showAllVersions ? firmwareList[0] : firmwareList.find((fw) => !fw.untested);
	});

	$effect(() => {
		// can only download firmware for gx dongles
		if (selectedDevice === Device.GX) {
			manualUpdate = true;
			const manualCheckbox = document.getElementById('manual-update') as HTMLInputElement;
			const demoModeCheckbox = document.getElementById('demo-mode') as HTMLInputElement;
			if (manualCheckbox) {
				manualCheckbox.checked = true;
				manualCheckbox.disabled = true;
				manualUpdate = true;
			}
			if (demoModeCheckbox) {
				demoModeCheckbox.checked = false;
				demoModeCheckbox.disabled = true;
			}
		} else {
			const downloadOnlyCheckbox = document.getElementById('manual-update') as HTMLInputElement;
			const demoModeCheckbox = document.getElementById('demo-mode') as HTMLInputElement;
			if (downloadOnlyCheckbox) {
				downloadOnlyCheckbox.disabled = false;
				manualUpdate = false;
			}
			if (demoModeCheckbox) demoModeCheckbox.disabled = false;
		}
	});

	$effect(() => {
		if ($demoMode && browser) {
			addToast('info', m['toasts.demo_enabled'](), true);
		}
	});

	$effect(() => {
		if (manualUpdate && browser) {
			// check if user is NOT on Windows
			const isWindows = navigator.userAgent.includes('Windows');
			if (!isWindows) {
				addToast('warning', m['toasts.os_unsupported']?.(), false);
				console.log(`Unsupported OS platform, user agent: ${navigator.userAgent}`);
			}
		}
	});

	$effect(() => {
		// disable demo mode if manual update is enabled, else enable
		if (!browser) return;
		const demoModeCheckbox = document.getElementById('demo-mode') as HTMLInputElement;
		if (demoModeCheckbox) {
			if (manualUpdate) {
				demoModeCheckbox.checked = false;
				demoModeCheckbox.disabled = true;
			} else {
				demoModeCheckbox.disabled = false;
			}
		}
	});

	function setupUpdaterCallbacks() {
		const progressCallback = (progress: { currentBytes: number; totalBytes: number }) => {
			updateProgress = Math.round((progress.currentBytes / progress.totalBytes) * 100);
			updateStatus = m['dfu.status.updating']({
				progress: updateProgress,
				total: progress.totalBytes,
				current: progress.currentBytes
			});
		};

		const logCallback = (message: string) => {
			logMessages = [...logMessages, message];
		};

		if (firmwareUpdater) {
			firmwareUpdater.setProgressCallback(progressCallback);
			firmwareUpdater.setLogCallback(logCallback);
		}

		if (simulatedUpdater) {
			simulatedUpdater.setProgressCallback(progressCallback);
			simulatedUpdater.setLogCallback(logCallback);
		}
	}

	async function handleDownload(type: 'firmware' | 'updater') {
		if (type === 'firmware') {
			if (!selectedFirmware?.filename) throw new Error('No firmware file specified');
			window.open(selectedFirmware.filename, '_blank');
		} else {
			if (selectedDevice === Device.GX) {
				window.open(`${urlPrefix}/gx_update.exe`, '_blank');
			} else {
				window.open(`${urlPrefix}/pydfu.exe`, '_blank');
			}
		}
	}

	async function handleCopy(command: string) {
		try {
			await navigator.clipboard.writeText(command);
			addToast('success', m['toasts.command_copied'](), true);
		} catch (error) {
			addToast('error', m['toasts.command_copy_failed'](), false);
			console.error('Failed to copy command:', error);
		}
	}

	async function handleCheckVersion() {
		try {
			isUpdating = true;
			updateStatus = m['dfu.status.checking_version']();

			if ($demoMode) {
				updateStatus = await simulatedUpdater.simulateCheckVersion(
					selectedDevice,
					selectedFirmware
				);
				return;
			}

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

			if ($demoMode) {
				updateStatus = await simulatedUpdater.simulateSetUpdateMode();
				return;
			}

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

			if ($demoMode) {
				const result = await simulatedUpdater.simulateSelectDFUDevice(selectedDevice);
				dfuDevice = result.device;
				updateStatus = result.status;
				return;
			}

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

			if ($demoMode) {
				updateStatus = await simulatedUpdater.simulateFlashFirmware();
				updateProgress = 100;
				return;
			}

			if (!firmwareUpdater) {
				updateStatus = m['dfu.status.firmware_updater_not_initialized']();
				addToast('error', updateStatus, false);
				return;
			}

			const firmwareBuffer = await firmwareUpdater.downloadFirmware(selectedFirmware);
			await firmwareUpdater.flashFirmware(dfuDevice, firmwareBuffer);

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

	// set up updater callbacks & check for Web Bluetooth support on page load
	onMount(async () => {
		setupUpdaterCallbacks();

		console.log(`Browser: ${browser}`);
		if (!browser) return;

		if (!navigator.bluetooth || !(await navigator.bluetooth.getAvailability())) {
			console.log('Bluetooth API supported: No');
			if (!$demoMode) {
				addToast('error', m['toasts.web_bluetooth_not_supported'](), false);
				hasSupport = false;
			}
			return;
		} else {
			console.log('Bluetooth API supported: Yes');
		}
	});
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
						{#if showAllVersions || !fw.untested}
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
			<div class="flex flex-col justify-between gap-2 md:grid md:grid-cols-2">
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
				<div class="flex items-center gap-2 md:justify-end">
					<label for="show-untested" class="text-sm">{m['settings.show_all_versions']?.()}:</label>
					<input
						type="checkbox"
						id="show-untested"
						class="checkbox"
						bind:checked={showAllVersions}
					/>
					<button
						class="btn-icon variant-ghost"
						onclick={() => addToast('info', m['toasts.show_all_versions_description'](), false)}
					>
						<Icon icon="mdi:information-outline" />
					</button>
				</div>
				<div class="flex items-center gap-2">
					<label for="manual-update" class="text-sm">{m['settings.manual_update']?.()}:</label>
					<input type="checkbox" id="manual-update" class="checkbox" bind:checked={manualUpdate} />
					<button
						class="btn-icon variant-ghost"
						onclick={() => addToast('info', m['toasts.manual_update_description'](), false)}
					>
						<Icon icon="mdi:information-outline" />
					</button>
				</div>
				<div class="flex items-center gap-2 md:justify-end">
					<label for="demo-mode" class="text-sm">{m['settings.demo_mode']?.()}:</label>
					<input type="checkbox" id="demo-mode" class="checkbox" bind:checked={$demoMode} />
					<button
						class="btn-icon variant-ghost"
						onclick={() => addToast('info', m['toasts.demo_mode_description'](), false)}
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
		{#if manualUpdate}
			<!-- Manual update -->
			<div class="flex flex-col items-center justify-center gap-3">
				<div class="text-center">
					<p>{m['dfu.step.download_firmware']()}</p>
					<p class="text-sm opacity-70">{m['dfu.step_note.download_firmware']()}</p>
				</div>
				<button
					class="btn bg-primary-500"
					disabled={isUpdating || !selectedFirmware}
					onclick={() => handleDownload('firmware')}
				>
					{m['dfu.button.download_firmware']()}
				</button>
			</div>
			<hr class="hr" />
			<div class="flex flex-col items-center justify-center gap-3">
				<div class="text-center">
					<p>{m['dfu.step.download_updater']()}</p>
					<p class="text-sm opacity-70">{m['dfu.step_note.download_updater']()}</p>
				</div>
				<button
					class="btn bg-primary-500"
					disabled={isUpdating || !selectedFirmware}
					onclick={() => handleDownload('updater')}
				>
					{m['dfu.button.download_updater']()}
				</button>
			</div>
			<hr class="hr" />
			{@const isDongle = selectedDevice === Device.GX}
			{@const filename = selectedFirmware?.filename?.split('/').pop() || 'Unknown'}
			{@const command = getDFUCommand(
				selectedDevice,
				filename,
				!isDongle ? '(MAC_ADDRESS)' : undefined
			)}
			<div class="flex flex-col items-center justify-center gap-3">
				<div class="text-center">
					<p>{m['dfu.step.copy_command']()}</p>
					<p class="text-sm opacity-70">{m['dfu.step_note.copy_command']({ command })}</p>
				</div>
				<button
					class="btn bg-secondary-500"
					disabled={isUpdating || !selectedFirmware}
					onclick={() => handleCopy(command)}
				>
					{m['dfu.button.copy_command']()}
				</button>
			</div>
		{:else}
			<!-- Automatic update -->
			<div class="flex flex-col items-center justify-center gap-3">
				<div class="text-center">
					<p>{m['dfu.step.check_version']({ device: selectedDevice })}</p>
					<p class="text-sm opacity-70">{m['dfu.step_note.check_version']()}</p>
				</div>
				<button
					class="btn bg-primary-500"
					disabled={isUpdating || (!hasSupport && !$demoMode)}
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
							? m['dfu.step_note.set_update_mode']().replace(
									'HaritoraXW-Update',
									'HaritoraX2-Update'
								)
							: m['dfu.step_note.set_update_mode']()}
					</p>
				</div>
				<button
					class="btn bg-primary-500"
					disabled={isUpdating || (!hasSupport && !$demoMode)}
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
					disabled={isUpdating || (!hasSupport && !$demoMode)}
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
		{/if}
	</div>

	<!-- Debug log -->
	{#if logMessages.length > 0}
		<div class="rounded-lg bg-gray-800 p-6 shadow">
			<strong class="mb-2 block">{m['dfu.debug_log']()}</strong>
			<div
				bind:this={logContainer}
				onscroll={handleScroll}
				class="max-h-40 overflow-y-auto font-mono text-xs text-gray-400"
			>
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
