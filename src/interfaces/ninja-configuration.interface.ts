export interface NinjaConfigurationInterface {
  // TODO: this should be defined via JSON schema
  [k: string]: any;
}

export interface NinjaBuildConfiguration {
  outputPath: string;
  locale: string;
  index: string;
  main: string;
  fileReplacements?: { replace: string, with: string }[];
  optimization?: boolean;
  sourceMap?: boolean | 'source-map' | '' ;
  baseHref?: string;
  localize?: string[];
  port?: number;

  // later
  'namedChunks'?: boolean;
  'outputHashing'?: string;
}
