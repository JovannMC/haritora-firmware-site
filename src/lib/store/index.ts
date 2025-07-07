// ! Tracker firmware is not provided by this git repository.
// ! You may modify this (or grab the firmware by yourself on https://dfu.slimetora.dev/firmware/{path_to_firmware} OR https://archive.org/details/shiftall_firmware)

import { getLocale, setLocale } from '$lib/paraglide/runtime';
import { writable, derived } from 'svelte/store';
import { m } from '$lib/paraglide/messages.js';

export const currentLocale = writable(getLocale());

export function updateLocale(newLocale) {
	setLocale(newLocale, { reload: false });
	currentLocale.set(newLocale);
}

export const packetSendDelay = writable(1);
export const demoMode = writable(false);

export function isSemVersion(version: string): boolean {
	// check if version matches semantic versioning (e.g. 1.0.1, 1.0.21)
	const semverRegex = /^\d+\.\d+\.\d+$/;
	return semverRegex.test(version);
}

export function getDFUCommand(type: Device, filename: string, device?: string | string[]) {
	// pydfu.exe (zip) (mac address)
	// gx_update.exe dfu (zip) [serial_ports]
	// serial_ports is optional

	if (type === Device.GX) {
		// for dongle firmware, use gx_update.exe
		// the python script allows to automatically scan for the ports
		if (device) {
			return `gx_update.exe dfu ${filename} ${device}`;
		} else {
			return `gx_update.exe ${filename}`;
		}
	} else {
		// for tracker firmware, use pydfu.exe
		return `pydfu.exe ${filename} ${device}`;
	}
}

/*
 * Firmware objects
 */

export type FirmwareVersion = {
	version: string;
	date: string;
	filename: string;
	notes: string;
	untested?: boolean;
};

export type FirmwareVersionsMap = {
	[key in Device]: FirmwareVersion[];
};

export const urlPrefix = '/firmware'; // URL prefix for firmware files - could be served from a CDN

// assume all "unknown" versions (commit hashes / "unknown" notes) have dates from VR Manager's Steam depot
// notes are as-is & taken directly from the manual

// these are functions so that we can return the right notes based on the current locale
function createHaritoraX2Versions(): FirmwareVersion[] {
	return [
		{
			version: '1.0.1',
			date: '2024-12-11',
			filename: `${urlPrefix}/mc4seb/mc4seb-2-095fdce.zip`,
			notes: m['firmware.versions.unknown']()
		},
		{
			version: '1.0.3',
			date: '2024-12-17',
			filename: `${urlPrefix}/mc4seb/mc4seb-2-ce48200.zip`,
			notes: m['firmware.versions.unknown']()
		},
		{
			version: '1.0.7',
			date: '2025-01-08',
			filename: `${urlPrefix}/mc4seb/mc4seb-2-c796754.zip`,
			notes: m['firmware.versions.unknown']()
		},
		{
			version: '1.0.10',
			date: '2025-01-21',
			filename: `${urlPrefix}/mc4seb/mc4seb-2-9648bfd.zip`,
			notes: m['firmware.versions.unknown']()
		},
		{
			version: '1.0.14',
			date: '2025-01-23',
			filename: `${urlPrefix}/mc4seb/mc4seb-2-b9b09e9.zip`,
			notes: m['firmware.versions.mc4seb.1.0.14']()
		},
		{
			version: '1.0.15',
			date: '2025-01-30',
			filename: `${urlPrefix}/mc4seb/mc4seb-2-b645dee.zip`,
			notes: m['firmware.versions.mc4seb.1.0.15']()
		},
		{
			version: '1.0.19',
			date: '2025-02-27',
			filename: `${urlPrefix}/mc4seb/mc4seb-2-a85a6e5.zip`,
			notes: m['firmware.versions.unknown']()
		},
		{
			version: '1.0.21',
			date: '2025-03-24',
			filename: `${urlPrefix}/mc4seb/mc4seb-2-c4d6efb.zip`,
			notes: m['firmware.versions.unknown']()
		},
		{
			version: '1.0.24',
			date: '2025-05-12', // date from official manual
			filename: `${urlPrefix}/mc4seb/mc4seb-2-b475ca6.zip`,
			notes: m['firmware.versions.mc4seb.1.0.24']()
		},
		{
			version: '1.0.25',
			date: '2025-05-19', // date from official manual
			filename: `${urlPrefix}/mc4seb/mc4seb-2-3a1129c.zip`,
			notes: m['firmware.versions.mc4seb.1.0.25']()
		},
		{
			version: '1.0.27',
			date: '2025-06-30', // date from official manual
			filename: `${urlPrefix}/mc4seb/mc4seb-2-ab87abb.zip`,
			notes: m['firmware.versions.mc4seb.1.0.27']()
		}
	];
}

function createHaritoraXWirelessVersions(): FirmwareVersion[] {
	return [
		{
			version: '1.0.22',
			date: '2023-11-30', // date from official manual
			filename: `${urlPrefix}/mc3s/mc3_sensor_20231117_e53a9ce.zip`,
			notes: m['firmware.versions.mc3s.1.0.22']()
		},
		{
			version: '1.0.25',
			date: '2024-07-28', // date from official manual
			filename: `${urlPrefix}/mc3s/mc3_sensor_20240613_e1dd725.zip`,
			notes: m['firmware.versions.mc3s.1.0.25']()
		},
		{
			version: '1.0.26',
			date: '2024-08-01', // date from file name
			filename: `${urlPrefix}/mc3s/mc3_sensor_20240801_ea3497b.zip`,
			notes: m['firmware.versions.unknown']()
		},
		{
			version: '1.0.27',
			date: '2025-01-20', // date from file name
			filename: `${urlPrefix}/mc3s/mc3_sensor_mc3_bootloader_20250120_68aced4.zip`,
			notes: m['firmware.versions.unknown']()
		},
		{
			version: '1.0.28',
			date: '2025-06-03', // date from official manual
			filename: `${urlPrefix}/mc3s/mc3_sensor_20250430_5398332.zip`,
			notes: m['firmware.versions.mc3s.1.0.28']()
		}
	];
}

function createGXVersions(): FirmwareVersion[] {
	return [
		{
			version: '1.0.17',
			date: '2023-10-30', // date from official manual
			filename: `${urlPrefix}/mc3s_dongle/mc3_dongle_20230927_477d506.zip`,
			notes: m['firmware.versions.mc3s_dongle.1.0.17']()
		},
		{
			version: '1.0.19',
			date: '2023-10-31', // date from official manual
			filename: `${urlPrefix}/mc3s_dongle/mc3_dongle_20231005_fece09a.zip`,
			notes: m['firmware.versions.mc3s_dongle.1.0.19']()
		},
		{
			version: '1.0.26',
			date: '2025-01-30', // date from official manual
			filename: `${urlPrefix}/mc3s_dongle/mc3_dongle_mc3_bootloader_20240801_ea3497b.zip`,
			notes: m['firmware.versions.mc3s_dongle.1.0.26']()
		}
	];
}

// const haritorax11bVersions: FirmwareVersion[] = [
// 	{ version: '1.0.0', date: '2021-05-10', filename: '', notes: 'HaritoraX 1.1b initial release' },
// 	{ version: '1.1.0', date: '2021-08-22', filename: '', notes: 'HaritoraX 1.1b feature update' }
// ];

// const haritorax11Versions: FirmwareVersion[] = [
// 	{ version: '1.1.0', date: '2020-11-11', filename: '', notes: 'HaritoraX 1.1 initial release' },
// 	{ version: '1.1.1', date: '2021-01-15', filename: '', notes: 'HaritoraX 1.1 bug fixes' }
// ];

// const haritorax10Versions: FirmwareVersion[] = [
// 	{ version: '1.0.0', date: '2020-01-01', filename: '', notes: 'HaritoraX 1.0 initial release' },
// 	{ version: '1.0.2', date: '2020-03-10', filename: '', notes: 'HaritoraX 1.0 bug fixes' }
// ];

export enum Device {
	HaritoraX2 = 'HaritoraX 2',
	HaritoraXWireless = 'HaritoraX Wireless',
	//HaritoraX11b = 'HaritoraX 1.1b',
	//HaritoraX11 = 'HaritoraX 1.1',
	//HaritoraX10 = 'HaritoraX (1.0)',
	GX = 'GX (6/2)'
}

export const firmwareVersions = derived(currentLocale, () => ({
	[Device.HaritoraX2]: createHaritoraX2Versions(),
	[Device.HaritoraXWireless]: createHaritoraXWirelessVersions(),
	//[Device.HaritoraX11b]: haritorax11bVersions,
	//[Device.HaritoraX11]: haritorax11Versions,
	//[Device.HaritoraX10]: haritorax10Versions,
	[Device.GX]: createGXVersions()
}));
