const pathResolve = require('path').resolve;

module.exports = {
  entry: [
    pathResolve(__dirname, 'release/core/src/index.js'),
    pathResolve(__dirname, 'release/core/src/add/auth.js'),
    pathResolve(__dirname, 'release/core/src/add/database.js'),
  ],
  devtool: 'source-map',
  externals: [
    /^\.\.\/(.*)/,
    /^rxjs(\/(.*))?$/
  ],
  output: {
    path: pathResolve(__dirname, 'release/bundles'),
    libraryTarget: 'umd',
    library: '@openflame/core',
    filename: process.env.NODE_ENV === 'production' ? 'core.umd.min.js' : 'core.umd.js'
  },
  resolve: {
    extensions: ['.js']
  }
};
