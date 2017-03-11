const pathResolve = require('path').resolve;

module.exports = {
  entry: pathResolve(__dirname, `release/database/src/index.js`),
  devtool: 'source-map',
  externals: [
    /^@openflame\/core(\/(.*))?$/,
    /^rxjs(\/(.*))?$/
  ],
  output: {
    path: pathResolve(__dirname, 'release/bundles'),
    libraryTarget: 'umd',
    library: '@openflame/database',
    filename: process.env.NODE_ENV === 'production' ? 'database.umd.min.js' : 'database.umd.js'
  },
  resolve: {
    extensions: ['.js']
  }
};
