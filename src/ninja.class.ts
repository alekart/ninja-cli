import { resolve } from 'path';
import { NinjaBuildConfiguration } from './interfaces/ninja-configuration.interface';
import { runServer } from './server';
import { WebpackConfigBuilder } from './webpack-config-builder';
import { Configuration } from 'webpack';

const webpack = require('webpack');

export class Ninja {
  private webpackConfigBuilder: WebpackConfigBuilder;
  root = process.cwd();
  projectRoot: string;
  projectConfig!: Record<string, any>;
  locales: string[];
  configNames: string[];
  buildConfiguration: NinjaBuildConfiguration;
  isServer: boolean;
  paths: { sourceRoot: string, templates: string, data: string, assets: string };

  constructor(public config: Record<string, any>, public project: string, public args: Record<string, any>) {
    this.projectConfig = config.projects[project];
    this.projectRoot = Ninja.ninjaPath(this.projectConfig.root);
    this.locales = this.getLocales();
    this.configNames = args.configurations;
    const buildConfig = this.getBuildConfiguration()
    if(!buildConfig){
      Ninja.error('No configuration. Aborting.');
      process.exit(0);
      return;
    }
    this.buildConfiguration = buildConfig;
    this.isServer = args.server || false;
    this.paths = {
      sourceRoot: Ninja.ninjaPath(this.projectConfig.sourceRoot),
      templates: Ninja.ninjaPath(this.projectConfig.templatesRoot),
      data: Ninja.ninjaPath(this.projectConfig.dataRoot),
      assets: Ninja.ninjaPath(this.projectConfig.assetsRoot),
    };
    this.webpackConfigBuilder = new WebpackConfigBuilder(this);
  }

  static log(...args: any[]) {
    console.log('NINJA:', ...args);
  }

  static error(...args: any[]) {
    console.log('NINJA FAILED!', ...args);
  }

  static ninjaPath(relativePath: string): string {
    return resolve(process.cwd(), relativePath);
  }

  getLocales() {
    return Object.keys(this.projectConfig?.i18n?.locales || {});
  }

  getBuildConfiguration(): NinjaBuildConfiguration | undefined {
    const defaultConfig: NinjaBuildConfiguration = {
      server: false,
      ...this.projectConfig.architect.build.options,
    };
    const configurations = this.projectConfig.architect.build.configurations;
    let fullConfig = defaultConfig;
    if (!this.configNames.length) {
      this.configNames.push('production');
      Ninja.log('Building with default "production" configuration.');
    }
    fullConfig = this.configNames?.reduce((accum, configName) => {
      const config = configurations[configName];
      if (!config) {
        Ninja.error(`Project "${this.project}" does not have "${configName}" configuration.`);
        process.exit(1);
      }
      if (!this.checkConfigLocales(config)) {
        Ninja.error(`Configuration "${configName}" has provides locales that are not configured in project "${this.project}"`);
        process.exit(1);
      }
      return {
        ...accum,
        ...configurations[configName],
      };
    }, fullConfig);

    return this.addLocalizationsToConfig(fullConfig);
  }

  /**
   * If provided configuration has no localize options and project has several locales in i18n
   * configuration, add those locales to the configuration
   *
   * @param config
   */
  addLocalizationsToConfig(config: NinjaBuildConfiguration): NinjaBuildConfiguration {
    if (config?.localize?.length === 0 && this.locales.length > 0) {
      return {
        ...config,
        localize: this.locales,
      };
    }
    return {
      ...config,
    };
  }

  serve() {
    const config = this.webpackConfigBuilder.createConfig(this.buildConfiguration);
    runServer(config);
  }

  build() {
    if (this.locales.length) {
      this.locales.forEach((locale) => {
        const config = this.webpackConfigBuilder.createConfig(this.buildConfiguration, locale);
        this.runBuild(config);
      });
    } else {
      const config = this.webpackConfigBuilder.createConfig(this.buildConfiguration);
      this.runBuild(config);
    }
  }

  /**
   * Returns false if provided configuration has locales
   * that are not configured in project's i18n configuration.
   * @param config
   */
  private checkConfigLocales(config: any): boolean {
    return config.localize?.every((locale: string) => this.locales.includes(locale)) || true;
  }

  private runBuild(webpackConfig: Configuration) {
    webpack(webpackConfig, (err: any, stats: any) => {
      if (err) {
        Ninja.error(err);
      }
    });
  }
}
