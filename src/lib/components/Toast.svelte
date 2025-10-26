<!-- HAHA STOLEN ONCE AGAIN FROM https://github.com/VERT-sh/VERT (because i wrote it)  -->
<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { removeToast } from '$lib/store/ToastProvider';
	import Icon from '@iconify/svelte';

	type Props = {
		id: number;
		type: 'success' | 'error' | 'info' | 'warning';
		message: string;
		durations: {
			enter: number;
			stay: number;
			exit: number;
		};
	};

	let { id, type, message, durations }: Props = $props();

	const colors = {
		success: 'purple',
		error: 'red',
		info: 'blue',
		warning: 'pink'
	};

	const Icons = {
		success: 'ri:check-fill',
		error: 'ri:close-circle-fill',
		info: 'ri:information-fill',
		warning: 'ri:alert-fill'
	};

	let color = $derived(colors[type]);
	let iconName = $derived(Icons[type]);

	// intentionally unused. this is so tailwind can generate the css for these colours as it doesn't detect if it's dynamically loaded
	// this would lead to the colours not being generated in the final css file by tailwind
	const colourVariants = [
		'bg-pink-300',
		'bg-red-300',
		'bg-purple-300',
		'bg-blue-300',
		'border-pink-500',
		'border-red-500',
		'border-purple-500',
		'border-blue-500'
	];
</script>

<!-- modified the main class to be full on mobile, and limited on larger screens - should push this to VERT -->
<div
	class="flex max-w-[100%] md:max-w-md items-center justify-between gap-4 p-4 bg-{color}-300 border-{color}-500 rounded-lg border-l-4 shadow-md"
	in:fly={{
		duration: durations.enter,
		easing: quintOut,
		x: 0,
		y: 100
	}}
	out:fade={{
		duration: durations.exit,
		easing: quintOut
	}}
>
	<div class="flex items-center gap-4">
		<Icon
			icon={iconName}
			class="h-6 w-6 flex-shrink-0 text-black"
			width="32"
			stroke="2"
			fill="none"
		/>
		<p class="font-normal whitespace-pre-wrap text-black">{message}</p>
	</div>
	<button class="flex-shrink-0 text-gray-600 hover:text-black" onclick={() => removeToast(id)}>
		<Icon width="16" icon="ri:close-line" />
	</button>
</div>
