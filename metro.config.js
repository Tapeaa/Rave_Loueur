// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.alias = config.resolver.alias || {};
config.resolver.alias['@'] = path.resolve(__dirname);
config.resolver.assetExts = [...(config.resolver.assetExts || []), 'mp4'];

module.exports = config;
