const pathResolve = require('path').resolve;
// const {CheckerPlugin} = require('awesome-typescript-loader');

module.exports = {
  entry: [
    // pathResolve(__dirname, './src/index.ts')
    pathResolve(__dirname, './release/src/index.js')
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
    libraryTarget: 'umd',
    library: '@openflame/database',
    filename: process.env.NODE_ENV === 'production' ? 'database.umd.min.js' : 'database.umd.js'
  },
  resolve: {
    extensions: ['.js']
  }
};
