const writeFileSync = require('fs').writeFileSync;
const pathResolve = require('path').resolve;

const packageName = process.argv[2];
const devPackage = require(`../packages/${packageName}/package.json`);

delete devPackage.scripts;
delete devPackage.devDependencies;

const releaseRegex = /^release\/(.+)/;

const releasePackage = Object.assign(devPackage, {
  main: devPackage.main.match(releaseRegex)[1],
  module: devPackage.module.match(releaseRegex)[1],
  types: devPackage.types.match(releaseRegex)[1],
});

writeFileSync(
  pathResolve(__dirname, `../packages/${packageName}/release/package.json`),
  JSON.stringify(releasePackage, null, 2)
);
