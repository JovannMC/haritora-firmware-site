<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
</script>

{#snippet faqItem(titleKey, content, isHtml = false)}
	<div class="rounded-lg bg-gray-800 p-4 shadow">
		<h2 class="text-xl font-semibold">{m[titleKey]()}</h2>
		<p class="text-gray-300">
			{#if isHtml}
				{@html content.replace(/\n/g, '<br>')}
			{:else}
				{@html content.replace(/\n/g, '<br>')}
			{/if}
		</p>
	</div>
{/snippet}

<svelte:head>
	<title>SlimeTora: DFU FAQ</title>
</svelte:head>

<div class="mx-auto w-full max-w-2xl space-y-6">
	<!-- FAQ -->
	<h1 class="text-center text-3xl font-bold">{m['faq.title']()}</h1>
	<div class="space-y-4">
		{@render faqItem('faq.what_is_this_website.title', m['faq.what_is_this_website.description']())}

		{@render faqItem('faq.what_is_supported.title', m['faq.what_is_supported.description']())}

		{@render faqItem('faq.how_does_it_work.title', m['faq.how_does_it_work.description']())}

		{@render faqItem(
			'faq.how_update_mobile.title',
			m['faq.how_update_mobile.description']({
				ios: `<a class="text-gray-200 underline" href="https://apps.apple.com/us/app/nrf-connect-for-mobile/id1054362403">${m['faq.how_update_mobile.ios_text']()}</a>`,
				android: `<a class="text-gray-200 underline" href="https://play.google.com/store/apps/details?id=no.nordicsemi.android.mcp">${m['faq.how_update_mobile.android_text']()}</a>`
			}),
			true
		)}

		{@render faqItem(
			'faq.how_can_i_contribute.title',
			m['faq.how_can_i_contribute.description']({
				github_link: `<a class="text-gray-200 underline" href="https://github.com/JovannMC/haritora-firmware-site">${m['faq.how_can_i_contribute.github_text']()}</a>`,
				discord_link: `<a class="text-gray-200 underline" href="https://discord.gg/XdfnKD9QVM">${m['faq.how_can_i_contribute.discord_text']()}</a>`
			}),
			true
		)}

		{@render faqItem(
			'faq.how_did_you_gather_firmware.title',
			m['faq.how_did_you_gather_firmware.description']({
				official_website: `<a class="text-gray-200 underline" href="https://haritorax-dfu.shiftall.net">${m['faq.how_did_you_gather_firmware.website_text']()}</a>`,
				shiftall_vr_manager: `<a class="text-gray-200 underline" href="https://store.steampowered.com/app/3060770/Shiftall_VR_Manager/">${m['faq.how_did_you_gather_firmware.shiftall_vr_manager_text']()}</a>`,
				playtest_link: `<a class="text-gray-200 underline" href="https://steamdb.info/app/3065440/">${m['faq.how_did_you_gather_firmware.playtest_text']()}</a>`,
				depot_link: `<a class="text-gray-200 underline" href="https://steamdb.info/depot/3060771/">${m['faq.how_did_you_gather_firmware.depot_text']()}</a>`,
				manifests_link: `<a class="text-gray-200 underline" href="https://steamdb.info/depot/3060771/manifests/">${m['faq.how_did_you_gather_firmware.manifests_text']()}</a>`,
				contributing_link: `<a class="text-gray-200 underline" href="https://discord.gg/XdfnKD9QVM">${m['faq.how_did_you_gather_firmware.contributing_text']()}</a>`
			}),
			true
		)}

		<hr class="hr" />

		{@render faqItem('faq.why_did_it_not_work.title', m['faq.why_did_it_not_work.description']())}

		{@render faqItem('faq.web_bluetooth_error.title', m['faq.web_bluetooth_error.description']())}

		{@render faqItem('faq.why_bluetooth_needed.title', m['faq.why_bluetooth_needed.description']())}
	</div>
</div>
