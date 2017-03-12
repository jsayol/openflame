const pathResolve = require('path').resolve;
// const {CheckerPlugin} = require('awesome-typescript-loader');

module.exports = {
  entry: [
    // pathResolve(__dirname, './src/index.ts'),
    // pathResolve(__dirname, './add/auth.ts'),
    // pathResolve(__dirname, './add/database.ts'),
    pathResolve(__dirname, './release/src/index.js'),
    pathResolve(__dirname, './release/add/auth.js'),
    pathResolve(__dirname, './release/add/database.js'),
  ],
  devtool: 'source-map',
  externals: [
    /^@openflame\/(.*)/,
    /^rxjs(\/(.*))?$/
  ],
  // module: {
  //   loaders: [
  //     {
  //       test: /\.ts$/,
  //       loader: 'awesome-typescript-loader'
  //     }
  //   ]
  // },
  // plugins: [
  //   new CheckerPlugin()
  // ],
  output: {
    path: pathResolve(__dirname, './release/bundles'),
    publicPath: '/',
    libraryTarget: 'umd',
    library: 'openflame_core',
    filename: process.env.NODE_ENV === 'production' ? 'core.umd.min.js' : 'core.umd.js'
  },
  resolve: {
    extensions: ['.ts', '.js']
  }
};
