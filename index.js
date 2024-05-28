/**
 * @format
 */
import {AppRegistry, LogBox} from 'react-native';
import App from './src/App';
import Config from './src/CONFIG';
import additionalAppSetup from './src/setup';

LogBox.ignoreAllLogs(true);
AppRegistry.registerComponent(Config.APP_NAME, () => App);
additionalAppSetup();
