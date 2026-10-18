import { registerRootComponent } from "expo";
import { LogBox } from "react-native";

import App from "./src/App";

// react-native-background-timer (dependency of the Daily media manager) warns on
// every launch: https://github.com/ocetnik/react-native-background-timer/issues/366
LogBox.ignoreLogs([
  "`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method.",
  "`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method.",
]);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
