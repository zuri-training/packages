import type { AstroIntegration } from 'astro';
import { UnpluginConfigInterface, stylifyVite, defineConfig as stylifyUnpluginConfig } from '@stylify/unplugin';
import { Configurator } from '@stylify/stylify';
import { fileURLToPath } from 'url';
import { join } from 'path';
import type { BundleConfigInterface } from '@stylify/bundler';

export const defineConfig = stylifyUnpluginConfig;

export const stylify = (options: UnpluginConfigInterface = {}): AstroIntegration => {

	return {
		name: '@stylify/astro',
		hooks: {
			'astro:config:setup': ({ updateConfig, config, injectScript, command}): void => {
				const srcDir = join(fileURLToPath(config.root), 'src');
				const singleBundleOutputFilePath = join(srcDir, 'styles', 'stylify.css');
				const isDev = options?.dev ?? (import.meta?.env?.DEV === true
					|| import.meta?.env?.MODE === 'development'
					|| command === 'dev'
					|| null);

				const includeDefaultBundle = typeof options.bundles === 'undefined';
				const defaultConfig: UnpluginConfigInterface = {
					dev: options?.dev ?? isDev,
					bundler: {
						autoprefixerEnabled: false
					},
					compiler: {
						mangleSelectors: options?.compiler?.mangleSelectors ?? !isDev,
						selectorsAreas: [
							'(?:^|\\s+)class:list=\\{\\[((?:.|\\n)+)\\]\\}',
							`addAttribute\\(([\\s\\S]+), (?:"|\\')class:list(?:"|\\')\\)`,
							`addAttribute\\(([\\s\\S]+), (?:"|')class(?:"|')\\)`
						]
					},
					bundles: includeDefaultBundle
						? [{
							outputFile: singleBundleOutputFilePath,
							rewriteSelectorsInFiles: false,
							files: [join(srcDir, `**`, `*.{astro,html,js,jsx,svelte,ts,tsx,vue}`)]
						}]
						: []
				};

				const configs = Configurator.getDefaultExistingConfigFiles(fileURLToPath(config.root));
				const configsTypes = Object.keys(configs);

				if (configsTypes.length > 0) {
					defaultConfig.configFile = configs[configsTypes[0]];
				}

				const optionsConfig = options ?? {};

				const configureBundles = <T = BundleConfigInterface>(bundlesConfigs: T[]): T[] => {
					return bundlesConfigs.map((bundleConfig: T) => {
						bundleConfig.rewriteSelectorsInFiles = false;
						return bundleConfig;
					});
				};

				if (Object.keys(optionsConfig).length) {
					if (!includeDefaultBundle) {
						optionsConfig.bundles = configureBundles(optionsConfig.bundles);
					}

					if (typeof optionsConfig?.bundler?.bundles !== 'undefined') {
						optionsConfig.bundler.bundles = configureBundles(optionsConfig.bundles);
					}
				}

				updateConfig({
					vite: {
						plugins: [
							stylifyVite([defaultConfig, optionsConfig])
						]
					}
				});

				if (includeDefaultBundle) {
					injectScript('page-ssr', `import '${singleBundleOutputFilePath}';`);
				}
			}
		}
	};
};

export default stylify;
