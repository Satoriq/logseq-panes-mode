const path = require('path');

module.exports = {
  entry: './src/index.ts',
  mode: 'development',
  devtool: 'eval-source-map',
  optimization: { minimize: false },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'build'),
    clean: true,
    library: {
      type: 'umd',
      name: 'LogseqPlugin',
    },
  },
  resolve: {
    extensions: ['.ts', '.js', '.scss'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.svg$/,
        type: 'asset/source',
      },
      {
        test: /\.scss$/,
        type: 'asset/source',
      },
    ],
  },
  externals: [],
};
