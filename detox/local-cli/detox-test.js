#!/usr/bin/env node

const program = require('commander');
const path = require('path');
const cp = require('child_process');
program
  .option('-o, --runner-config [config]',
    `Test runner config file, defaults to e2e/mocha.opts for mocha and e2e/config.json' for jest`)
  .option('-s, --specs [relativePath]',
    `Root of test folder`)
  .option('-l, --loglevel [value]',
    'info, debug, verbose, silly, wss')
  .option('-c, --configuration [device configuration]',
    'Select a device configuration from your defined configurations, if not supplied, and there\'s only one configuration, detox will default to it')
  .option('-r, --reuse',
    'Reuse existing installed app (do not delete and re-install) for a faster run.')
  .option('-u, --cleanup',
    'Shutdown simulator when test is over, useful for CI scripts, to make sure detox exists cleanly with no residue')
  .option('-d, --debug-synchronization [value]',
    'When an action/expectation takes a significant amount of time use this option to print device synchronization status.'
    + 'The status will be printed if the action takes more than [value]ms to complete')
  .option('-a, --artifacts-location [path]',
    'Artifacts destination path. If the destination already exists, it will be removed first')
  .option('-p, --platform [ios/android]',
    'Run platform specific tests. Runs tests with invert grep on \':platform:\', '
          + 'e.g test with substring \':ios:\' in its name will not run when passing \'--platform android\'')
  .option('--take-screenshots',
    'Save screenshots before and after each test to artifacts directory.')
  .option('--record-videos',
    'Save screen recordings of each test to artifacts directory.')
  .parse(process.argv);

const config = require(path.join(process.cwd(), 'package.json')).detox;

const testFolder = getConfigFor('specs', 'e2e');
const runner = getConfigFor('testRunner', 'mocha');
const runnerConfig = getConfigFor('runnerConfig', getDefaultRunnerConfig());

if (typeof program.debugSynchronization === "boolean") {
  program.debugSynchronization = 3000;
}

function getConfigFor(key, defaults) {
  const keyKebabCase = camelToKebabCase(key);
  return program[key] || config[key] || config[keyKebabCase] || defaults;
}

function camelToKebabCase(string) {
  return string.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

switch (runner) {
  case 'mocha':
    runMocha();
    break;
  case 'jest':
    runJest();
    break;
  default:
    throw new Error(`${runner} is not supported in detox cli tools. You can still run your tests with the runner's own cli tool`);
}

function runMocha() {
  const loglevel = program.loglevel ? `--loglevel ${program.loglevel}` : '';
  const configuration = program.configuration ? `--configuration ${program.configuration}` : '';
  const cleanup = program.cleanup ? `--cleanup` : '';
  const reuse = program.reuse ? `--reuse` : '';
  const artifactsLocation = program.artifactsLocation ? `--artifacts-location ${program.artifactsLocation}` : '';
  const configFile = runnerConfig ? `--opts ${runnerConfig}` : '';
  const platform = program.platform ? `--grep ${getPlatformSpecificString(program.platform)} --invert` : '';
  const screenshots = program.takeScreenshots ? `--take-screenshots` : '';
  const videos = program.recordVideos ? `--record-videos` : '';

  const debugSynchronization = program.debugSynchronization ? `--debug-synchronization ${program.debugSynchronization}` : '';
  const command = `node_modules/.bin/mocha ${testFolder} ${configFile} ${configuration} ${loglevel} ${cleanup} ${reuse} ${debugSynchronization} ${platform} ${artifactsLocation} ${screenshots} ${videos}`;

  console.log(command);
  cp.execSync(command, {stdio: 'inherit'});
}

function runJest() {
  const configFile = runnerConfig ? `--config=${runnerConfig}` : '';
  const platform = program.platform ? `--testNamePattern='^((?!${getPlatformSpecificString(program.platform)}).)*$'` : '';
  const command = `node_modules/.bin/jest ${testFolder} ${configFile} --runInBand ${platform}`;
  console.log(command);
  cp.execSync(command, {
    stdio: 'inherit',
    env: Object.assign({}, process.env, {
      configuration: program.configuration,
      loglevel: program.loglevel,
      cleanup: program.cleanup,
      reuse: program.reuse,
      debugSynchronization: program.debugSynchronization,
      artifactsLocation: program.artifactsLocation,
      takeScreenshot: program.takeScreenshot,
      recordVideos: program.recordVideos
    })
  });
}

function getDefaultRunnerConfig() {
  let defaultConfig;
  switch (runner) {
    case 'mocha':
      defaultConfig = 'e2e/mocha.opts';
      break;
    case 'jest':
      defaultConfig = 'e2e/config.json';
      break;
    default:
      console.log(`Missing 'runner-config' value in detox config in package.json, using '${defaultConfig}' as default for ${runner}`);
  }

  return defaultConfig;
}

function getPlatformSpecificString(platform) {
  let platformRevertString;
  if (platform === 'ios') {
    platformRevertString = ':android:';
  } else if (platform === 'android') {
    platformRevertString = ':ios:';
  }

  return platformRevertString;
}
