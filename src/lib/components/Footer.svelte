<script lang="ts">
	import { currentLocale, updateLocale } from '$lib/store';
</script>

<footer class="w-full bg-gray-900 py-4 text-center text-gray-200">
	<div class="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
		<div class="text-sm opacity-80">
			&copy; {new Date().getFullYear()} JovannMC. All rights reserved. All wrongs unreserved. :3
		</div>
		<select
			class="btn btn-sm bg-secondary-500 rounded text-gray-100 focus:outline-none"
			value={$currentLocale}
			onchange={(e) => {
				try {
					const value = (e.target as HTMLSelectElement)?.value;
					updateLocale(value);
					console.log(`Locale changed to: ${value}`);
				} catch (err) {
					console.error(`Error updating locale: ${err}`);
					throw err;
				}
			}}
		>
			<option value="en">English</option>
			<!-- <option value="ja">日本語</option> -->
		</select>
	</div>
</footer>
