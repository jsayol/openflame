const pathResolve = require('path').resolve;

module.exports = {
  entry: pathResolve(__dirname, `release/auth/src/index.js`),
  devtool: 'source-map',
  externals: [
    /^@openflame\/core(\/(.*))?$/,
    /^rxjs(\/(.*))?$/
  ],
  output: {
    path: pathResolve(__dirname, 'release/bundles'),
    libraryTarget: 'umd',
    library: '@openflame/auth',
    filename: process.env.NODE_ENV === 'production' ? 'auth.umd.min.js' : 'auth.umd.js'
  },
  resolve: {
    extensions: ['.js']
  }
};
