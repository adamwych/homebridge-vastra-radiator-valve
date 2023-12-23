import { API } from "homebridge";
import { PLATFORM_NAME } from "./settings";
import { VastraRadiatorValveHomebridgePlugin } from "./platform";

export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, VastraRadiatorValveHomebridgePlugin);
};
