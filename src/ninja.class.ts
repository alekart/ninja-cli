import { join, resolve } from 'path';
import { NinjaBuildConfiguration, NinjaConfigurationInterface } from './interfaces/ninja-configuration.interface';
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
  buildConfiguration: NinjaBuildConfiguration | undefined;
  isServer = false;
  paths: { sourceRoot: string, templates: string, data: string, assets: string };

  constructor(public config: Record<string, any>, public project: string, public args?: Record<string, any>) {
    this.projectConfig = config.projects[project];
    this.projectRoot = Ninja.ninjaPath(this.projectConfig.root);
    this.locales = this.getLocales();
    this.paths = {
      sourceRoot: Ninja.ninjaPath(this.projectConfig.sourceRoot),
      templates: Ninja.ninjaPath(this.projectConfig.templatesRoot),
      data: Ninja.ninjaPath(this.projectConfig.dataRoot),
      assets: Ninja.ninjaPath(this.projectConfig.assetsRoot),
    };
    this.configNames = this.args?.configurations || [];
    this.isServer = this.args?.server || false;
    this.webpackConfigBuilder = new WebpackConfigBuilder(this);

    // TODO: Add configuration Validation for project
    //  should check is provided project is defined...
  }

  static log(...args: any[]) {
    console.log('NINJA:', ...args);
  }

  static error(...args: any[]) {
    console.log('NINJA FAILED!', ...args);
  }

  static fatalError(...args: any[]) {
    Ninja.error(...args);
    process.exit(1);
  }

  static ninjaPath(...relativePaths: string[]): string {
    return resolve(process.cwd(), join(...relativePaths));
  }

  static loadConfig(): NinjaConfigurationInterface {
    return require(Ninja.ninjaPath('ninja.config.json'));
  }

  getLocales() {
    return Object.keys(this.projectConfig?.i18n?.locales || {});
  }

  getBuildConfiguration(): NinjaBuildConfiguration {
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

    const config = this.addLocalizationsToConfig(fullConfig);
    if (!config) {
      Ninja.error('No configuration. Aborting.');
      process.exit(0);
    }
    return config;
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
    const buildConfiguration: NinjaBuildConfiguration = this.getBuildConfiguration();
    const config = this.webpackConfigBuilder.createConfig(buildConfiguration);
    runServer(config);
  }

  build() {
    const buildConfiguration: NinjaBuildConfiguration = this.getBuildConfiguration();
    if (this.locales.length) {
      this.locales.forEach((locale) => {
        const config = this.webpackConfigBuilder.createConfig(buildConfiguration, locale);
        this.runBuild(config);
      });
    } else {
      const config = this.webpackConfigBuilder.createConfig(buildConfiguration);
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
