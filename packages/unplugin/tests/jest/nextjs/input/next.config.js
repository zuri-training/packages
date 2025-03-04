const { stylifyWebpack } = require('../../lib/index.cjs');

const stylifyPlugin = (dev) =>
	stylifyWebpack({
		dev: dev,
		bundles: [
			{
				outputFile: './styles/global.css',
				files: ['./pages/**/*.tsx', './components/*.tsx']
			}
		]
	});

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	swcMinify: true,
	webpack: (config, { dev }) => {
		config.plugins.push(stylifyPlugin(dev));
		return config;
	}
};

module.exports = nextConfig;
