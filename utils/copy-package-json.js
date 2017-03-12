const writeFileSync = require('fs').writeFileSync;
const pathResolve = require('path').resolve;

const packageName = process.argv[2];
const devPackage = require(pathResolve(__dirname, `../packages/${packageName}/package.json`));

delete devPackage.scripts;
delete devPackage.devDependencies;

const releasePackage = Object.assign(devPackage, {
  main: devPackage.main.replace(/^release\//, './'),
  module: devPackage.module.replace(/^release\//, './'),
  typings: devPackage.typings.replace(/^release\//, './'),
});

writeFileSync(
  pathResolve(__dirname, `../packages/${packageName}/release/package.json`),
  JSON.stringify(releasePackage, null, 2)
);
