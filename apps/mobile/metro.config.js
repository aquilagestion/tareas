const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Monorepo: observar packages compartidos
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Permitir resolución hacia node_modules hoisted en la raíz del monorepo
config.resolver.disableHierarchicalLookup = false;

config.resolver.extraNodeModules = {
  "@grefa/shared": path.resolve(workspaceRoot, "packages/shared"),
  "@grefa/firebase": path.resolve(workspaceRoot, "packages/firebase"),
};

module.exports = config;
