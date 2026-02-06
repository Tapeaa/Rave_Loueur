// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.alias = config.resolver.alias || {};
config.resolver.alias['@'] = path.resolve(__dirname);
config.resolver.assetExts = [...(config.resolver.assetExts || []), 'mp4'];

// Exclure react-native-maps sur le web
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Sur le web, remplacer react-native-maps par un module vide
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      filePath: require.resolve('./lib/maps.web.tsx'),
      type: 'sourceFile',
    };
  }
  // Utiliser le resolver par défaut pour les autres modules
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
