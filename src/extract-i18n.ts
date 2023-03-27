import { join } from 'path';
import { ExecException } from 'child_process';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { GettextExtractor, JsExtractors } from 'gettext-extractor';
import { map, mergeMap, Observable } from 'rxjs';
import { Ninja } from './ninja.class';

const child_process = require('child_process');
const commandExistsSync = require('command-exists').sync;

const fnName = 'i18n';
const fnPluralName = 'i18nPlural';

export class Extractor {
  canMerge = !!commandExistsSync('msgmerge');
  extractor: GettextExtractor;
  paths = {
    templates: '',
    output: '',
  };

  constructor(private ninja: Ninja) {
    if (!this.canMerge) {
      Ninja.log('`gettext` is required to update PO files with `msgmerge` command.');
      Ninja.log('Install it via `brew install gettext` or use Poedit app (https://poedit.net).');
    }

    this.paths = {
      templates: join(this.ninja.paths.templates, '**/*.njk'),
      output: Ninja.ninjaPath(this.ninja.projectConfig.architect['i18n-extract'].outputPath),
    };
    this.extractor = new GettextExtractor();
  }

  extract() {
    this.extractor.createJsParser([
      JsExtractors.callExpression(fnName, {
        arguments: {
          text: 0,
          context: 1,
        },
      }),
      JsExtractors.callExpression(fnPluralName, {
        arguments: {
          text: 1,
          textPlural: 2,
          context: 3,
        },
      }),
    ]).parseFilesGlob(join(this.paths.templates));
    mkdirSync(this.paths.output, { recursive: true });
    this.extractor.savePotFile(join(this.paths.output, 'messages.pot'), {
      ...this.getHeaders('fr'),
    });
    this.extractor.printStats();
    this.merge();
  }

  merge() {
    this.ninja.locales.forEach((locale) => {
      if (!this.localeExists(locale)) {
        this.extractor.savePotFile(join(this.paths.output, `${locale}.po`), this.getHeaders(locale));
        console.log(`Created ${locale}.po`);
      } else {
        this.compile(locale).pipe(
          mergeMap(() => this.mergePo(locale)),
          map(() => {
            unlinkSync(join(this.paths.output, `${locale}.mo`));
          }),
        ).subscribe({
          next: () => {
            console.log(`${locale}.po updated`);
          }, error: (err: any) => {
            if (err !== 'cannot merge') {
              Ninja.error(`Error occurred while updating ${locale}.po file.`, err);
            }
          },
        });
      }
    });
  }

  private mergePo(locale: string): Observable<void> {
    const pathToPo = join(this.paths.output, `${locale}.po`);
    const pathToPot = join(this.paths.output, `messages.pot`);
    return new Observable<void>((observer) => {
      if (!this.canMerge) {
        observer.error('cannot merge');
      } else {
        child_process.exec(`msgmerge --previous ${pathToPo} ${pathToPot} -o ${pathToPo}`, (err: ExecException | null) => {
          if (err) {
            observer.error(err);
            return;
          } else {
            observer.next();
          }
        });
      }
    });
  }

  private compile(locale: string): Observable<void> {
    const pathToPo = join(this.paths.output, `${locale}.po`);
    const pathToMo = join(this.paths.output, `${locale}.mo`);
    return new Observable<void>((observer) => {
      if (!this.canMerge) {
        observer.error('cannot merge');
      } else {
        child_process.exec(`msgfmt ${pathToPo} -o ${pathToMo}`, (err: ExecException | null) => {
          if (err) {
            observer.error(err);
          } else {
            observer.next();
          }
        });
      }
    });
  }

  private getHeaders(language: string) {
    return {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Content-Transfer-Encoding': '8bit',
      'Project-Id-Version': require('../package.json').version,
      'Plural-Forms': 'nplurals=2; plural=n == 1 ? 0 : 1;',
      Language: language,
    };
  }

  private localeExists(locale: string) {
    return existsSync(join(this.paths.output, `${locale}.po`));
  }
}
