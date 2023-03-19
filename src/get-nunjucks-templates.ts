import { sync } from 'glob';
import { basename } from 'path';

const HTMLWebpackPlugin = require('html-webpack-plugin');

export function getNunjucksTemplates(templatesPath: string, htmlWebpackPluginOptions = {}) {
  return sync(templatesPath).map((fileName: string) => {
    const templateName = basename(fileName).replace(/\.njk$/, '');
    return new HTMLWebpackPlugin({
      template: fileName,
      filename: `${templateName}.html`,
      ...htmlWebpackPluginOptions,
    });
  });
}
