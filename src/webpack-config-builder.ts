import { readFileSync } from 'fs';
import { extname, relative, resolve } from 'path';
import { Ninja } from './ninja.class';
import { NinjaBuildConfiguration } from './interfaces/ninja-configuration.interface';
import { Configuration } from 'webpack';
import { WebpackDevServerOptions } from 'webpack-cli';
import { getNunjucksTemplates } from './get-nunjucks-templates';

export type WebPackConfig = Configuration | WebpackDevServerOptions;

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const ImageMinimizerPlugin = require('image-minimizer-webpack-plugin');

const webpack = require('webpack');

export class WebpackConfigBuilder {
  constructor(private ninja: Ninja) {
  }

  private getFileReplacements(config: NinjaBuildConfiguration): any[] {
    if (config.fileReplacements?.length) {
      return config.fileReplacements?.map((file) => {
        const from = this.normalizeReplacementPath(file.replace);
        const to = this.normalizeReplacementPath(file.with);
        const regex = new RegExp(from.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&') + '$');
        return new webpack.NormalModuleReplacementPlugin(
          regex, (resource: any) => resource.request = resource.request.replace(from, to),
        );
      });
    }
    return [];
  }

  private normalizeReplacementPath(path: string): string {
    return relative(this.ninja.paths.sourceRoot, path).replace(extname(path), '');
  }

  private loadEnv() {
    let evnFilePath = 'src/environments/environment.ts';
    const replacement = this.ninja.buildConfiguration?.fileReplacements?.find((r) => r.replace === evnFilePath);
    if (replacement) {
      evnFilePath = replacement.with;
    }
    const env = eval(
      readFileSync(resolve(this.ninja.root, evnFilePath), 'utf-8').replace(/^export\s?/, '')
      + '; (() => { return environment; })()',
    );
    return env;
  }

  createConfig(buildConfig: NinjaBuildConfiguration, locale = ''): WebPackConfig {
    const isServer = this.ninja.isServer;
    const dist = resolve(this.ninja.root, buildConfig.outputPath, locale ? locale : '');

    const config: WebPackConfig = {
      mode: isServer ? 'development' : 'production',
      entry: Ninja.ninjaPath(buildConfig.main),
      output: {
        path: dist,
        filename: '[name].js',
        clean: !isServer,
      },
      devtool: buildConfig.sourceMap === true ? 'source-map' : buildConfig.sourceMap || false,
      devServer: {
        open: true,
        hot: true,
        port: buildConfig.port || 3000,
        static: [this.ninja.paths.templates, this.ninja.paths.data, this.ninja.paths.assets],
      },
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            use: buildConfig.optimization ? [
              {
                loader: 'babel-loader',
                options: {
                  plugins: [
                    ['lodash'],
                  ],
                },
              },
              'ts-loader',
            ] : 'ts-loader',
            exclude: /node_modules/,
          },
          {
            test: /\.(jpe?g|png|gif|svg)$/i,
            type: 'asset',
          },
          {
            test: /\.(eot|woff|woff2|ttf|pdf)$/,
            type: 'asset/resource',
          },
          {
            test: /\.(sa|sc|c)ss$/,
            use: [
              MiniCssExtractPlugin.loader,
              'css-loader',
              {
                loader: 'sass-loader',
                options: {
                  // Prefer `dart-sass`
                  implementation: require('sass'),
                  sourceMap: buildConfig.optimization && !!buildConfig.sourceMap,
                  sassOptions: {
                    outputStyle: buildConfig.optimization ? 'compressed' : 'expanded',
                  },
                },
              },
            ],
          },
          {
            test: /\.njk$/,
            use: [
              'html-loader',
              {
                loader: '@alekart/nunjucks-html-loader',
                options: {
                  templates: this.ninja.paths.templates,
                  locale: locale || buildConfig.localize?.[0] || buildConfig.locale,
                  dataPath: this.ninja.paths.data,
                  data: {
                    locale: locale || buildConfig.localize?.[0] || buildConfig.locale,
                    ninja: {
                      project: this.ninja.project,
                      configurations: this.ninja.configNames,
                      environment: this.loadEnv(),
                    },
                    env: require(Ninja.ninjaPath('src/data/_env.json')).acc,
                  },
                  nunjucks: {
                    trimBlocks: true,
                    throwOnUndefined: true,
                  },
                },
              },
            ],
          },
        ],
      },
      resolve: {
        roots: [this.ninja.paths.sourceRoot],
        extensions: ['.ts', '.js', '.json'],
      },
      plugins: [
        new MiniCssExtractPlugin(),
        // https://github.com/jantimon/html-webpack-plugin#options
        ...getNunjucksTemplates(`${this.ninja.paths.templates}/!(_*).njk`),
        ...this.getFileReplacements(buildConfig),
      ],
      optimization: {
        minimize: buildConfig.optimization,
        minimizer: [
          new TerserPlugin(),
          new ImageMinimizerPlugin({
            minimizer: {
              implementation: ImageMinimizerPlugin.imageminMinify,
              options: {
                // Lossless optimization with custom option
                // Feel free to experiment with options for better result for you
                plugins: buildConfig.optimization ? [
                  // https://github.com/imagemin/imagemin-mozjpeg#api
                  ['mozjpeg', { progressive: true, quality: 65 }],
                  // https://github.com/imagemin/imagemin-optipng#api
                  ['optipng', { optimizationLevel: 3 }],
                ] : [],
              },
            },
          }),
        ],
      },
    };

    if (!isServer) {
      config.plugins = [
        ...(config.plugins || []),
        new webpack.ProgressPlugin({
          handler(percentage: number, message: string, ...args: any[]) {
            const percent = (percentage * 100).toFixed(0).replace('%', '');
            if (percent === '100') {
              message = 'Build complete.';
            }
            process.stdout.write('\r\x1b[K');
            process.stdout.write(`${percent}% ${message}`);
          },
        }),
      ];
    }

    return config;
  }
}
