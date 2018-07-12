const common = require('./webpack.common.js')
const merge = require('webpack-merge')
const path = require('path')
const ngAssets = require('./webpack.ngassets')
const HtmlWebpackPlugin = require('html-webpack-plugin')


module.exports = merge(common,ngAssets,{
  entry : './src/main.ts',
  mode : 'development',
  output : {
    filename : 'main.js',
    path : path.resolve(__dirname,'dist/dev')
  },
  devtool:'source-map',

  plugins : [
    new HtmlWebpackPlugin({
      template : 'src/index.html'
    })
  ]
})