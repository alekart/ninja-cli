const Webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');

export function runServer(webpackConfig: any) {
  const compiler = Webpack(webpackConfig);
  const devServerOptions = {...webpackConfig.devServer, open: true};
  const server = new WebpackDevServer(devServerOptions, compiler);

  server.startCallback(() => {
    console.log('Successfully started server.');
  });
}
