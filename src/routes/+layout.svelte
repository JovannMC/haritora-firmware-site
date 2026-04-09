<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { currentLocale, demoMode, hasSupport } from '$lib/store';
	import '../app.css';
	import Toast from '$lib/components/Toast.svelte';
	import { type Toast as ToastType, addToast, toasts } from '$lib/store/ToastProvider';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';

	let { children } = $props();

	const url = page.url.pathname;

	let toastList = $state<ToastType[]>([]);
	toasts.subscribe((value) => {
		toastList = value as ToastType[];
	});

	onMount(async () => {
		console.log(`Browser: ${browser}`);
		if (!browser || url !== '/') return;

		if (!navigator.bluetooth || !(await navigator.bluetooth.getAvailability())) {
			console.log('Bluetooth API supported: No');
			if (!$demoMode) {
				addToast('error', m['toasts.web_bluetooth_not_supported'](), false);
				hasSupport.set(false);
			}
			return;
		} else {
			console.log('Bluetooth API supported: Yes');
		}
	});
</script>

<svelte:head>
	<!-- Favicons -->
	<link rel="apple-touch-icon" sizes="57x57" href="/icons/apple-touch-icon-57x57.png" />
	<link rel="apple-touch-icon" sizes="60x60" href="/icons/apple-touch-icon-60x60.png" />
	<link rel="apple-touch-icon" sizes="72x72" href="/icons/apple-touch-icon-72x72.png" />
	<link rel="apple-touch-icon" sizes="76x76" href="/icons/apple-touch-icon-76x76.png" />
	<link rel="apple-touch-icon" sizes="114x114" href="/icons/apple-touch-icon-114x114.png" />
	<link rel="apple-touch-icon" sizes="120x120" href="/icons/apple-touch-icon-120x120.png" />
	<link rel="apple-touch-icon" sizes="144x144" href="/icons/apple-touch-icon-144x144.png" />
	<link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152x152.png" />
	<link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon-167x167.png" />
	<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180x180.png" />
	<link rel="apple-touch-icon" sizes="1024x1024" href="/icons/apple-touch-icon-1024x1024.png" />
	<link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
	<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
	<link rel="icon" type="image/png" sizes="48x48" href="/icons/favicon-48x48.png" />
	<link rel="icon" type="image/png" sizes="64x64" href="/icons/favicon-64x64.png" />
	<link rel="icon" type="image/png" sizes="128x128" href="/icons/favicon-128x128.png" />
	<link rel="icon" type="image/png" sizes="256x256" href="/icons/favicon-256x256.png" />
	<link rel="manifest" href="/site.webmanifest" />
	<meta name="msapplication-TileImage" content="/icons/mstile-144x144.png" />

	<!-- SEO -->
	<meta name="description" content="A website to update your Haritora devices through WebBluetooth." />
	<meta name="keywords" content="Haritora, HaritoraX, HaritoraX Wireless, HaritoraX 2, GX6, Shiftall, DFU, Firmware, WebBluetooth" />
	<meta name="author" content="JovannMC" />

	<!-- Open Graph Tags -->
	<meta content="SlimeTora: Haritora Firmware Website" property="og:title" />
	<meta content="site" property="og:type" />
	<meta
		content="A website to update your Haritora devices through WebBluetooth."
		property="og:description"
	/>
	<meta content="https://dfu.slimetora.dev" property="og:url" />
	<meta content="https://dfu.slimetora.dev/logo.png" property="og:image" />
	<meta content="#663499" data-react-helmet="true" name="theme-color" />

	<!-- Twitter Meta Tags -->
	<meta name="twitter:card" content="summary_large_image">
	<meta property="twitter:url" content="https://dfu.slimetora.dev">
	<meta name="twitter:title" content="site">
	<meta name="twitter:description" content="A website to update your Haritora devices through WebBluetooth.">
	<meta name="twitter:image" content="https://dfu.slimetora.dev/logo.png">
</svelte:head>

<!-- #key used so we can force re-render when locale updates -->
{#key $currentLocale}
	<div
		class="app flex min-h-screen flex-col bg-gradient-to-b from-gray-950 via-gray-900 to-gray-800 text-gray-100"
	>
		<Header />

		<main class="flex flex-1 flex-col items-center justify-center px-4 py-8">
			{@render children()}
		</main>

		<Footer />
	</div>
{/key}

<div class="fixed right-0 bottom-0 z-50 flex flex-col-reverse gap-4 p-4">
	{#each toastList as { id, type, message, durations }}
		<div class="flex justify-end">
			<Toast {id} {type} {message} {durations} />
		</div>
	{/each}
</div>
