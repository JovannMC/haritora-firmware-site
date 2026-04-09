# Haritora Firmware Site

A website to manage the firmware of your Haritora / other Shiftall devices, making use of Web Bluetooth. Made in SvelteKit & Skeleton.

Currently supports the `HaritoraX Wireless` & `HaritoraX 2 trackers` which both update using the [web-bluetooth-dfu](https://github.com/thegecko/web-bluetooth-dfu) package. `HaritoraX Wired` and `GX(6/2)` dongles are still being investigated! Most devices use the `nRF52` platform.

Check out the live instance @ [dfu.slimetora.dev](https://dfu.slimetora.dev)!

## Contribution

If you want to contribute, please make sure to follow GitHub's [Community Guidelines](https://docs.github.com/en/site-policy/github-terms/github-community-guidelines) and [Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).<br>
If you have followed all of them, you can make a pull request [here](https://github.com/JovannMC/haritora-firmware-site/pulls) after using the following instructions:

- Install bun - [bun.sh](https://bun.sh/)
- Clone the project - `git clone https://github.com/JovannMC/haritora-firmware-site.git`
- Install the dependencies - `bun i`
- Create a local certificate with [mkcert](https://github.com/FiloSottile/mkcert) in the root directory - `mkcert localhost`
- Start the dev environment - `bun dev`
- Make your changes and build - `bun run build`

## License

This project is licensed under the [MIT](https://opensource.org/license/MIT/) License - see the [LICENSE](LICENSE) file for details<br>

## Acknowledgments

- [SvelteKit](https://kit.svelte.dev/)
- [Skeleton](https://www.skeleton.dev/)
- [web-bluetooth-dfu](https://github.com/thegecko/web-bluetooth-dfu)
