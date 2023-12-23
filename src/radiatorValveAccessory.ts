import { Service, PlatformAccessory, CharacteristicValue } from "homebridge";
import { VastraRadiatorValveHomebridgePlugin } from "./platform";
import { RadiatorValve } from "vastra-radiator-valve";
import PrefixLogger from "./logger";

export class VastraRadiatorValvePlatformAccessory {
  private readonly log = new PrefixLogger(
    this.platform.log,
    this.getMacAddress()
  );

  private thermostatService!: Service;
  private currentTemperature = 0;
  private currentTemperatureUpdateIntervalId?: NodeJS.Timeout;
  private targetTemperature = 0;

  constructor(
    private readonly platform: VastraRadiatorValveHomebridgePlugin,
    private readonly accessory: PlatformAccessory,
    private readonly valve: RadiatorValve
  ) {
    this.configureInformationService();
    this.configureThermostatService();
    this.startPollingTask();
  }

  private configureInformationService() {
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, "Vestra")
      .setCharacteristic(
        this.platform.Characteristic.Model,
        this.getMacAddress()
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        "Default-Serial"
      );
  }

  private configureThermostatService() {
    this.thermostatService =
      this.accessory.getService(this.platform.Service.Thermostat) ||
      this.accessory.addService(this.platform.Service.Thermostat);

    this.thermostatService
      .setCharacteristic(
        this.platform.Characteristic.Name,
        this.accessory.context.address
      )
      .setCharacteristic(
        this.platform.Characteristic.CurrentHeatingCoolingState,
        this.platform.Characteristic.CurrentHeatingCoolingState.HEAT
      )
      .setCharacteristic(
        this.platform.Characteristic.TemperatureDisplayUnits,
        this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS
      );

    this.thermostatService
      .getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onSet(this.handleTargetHeatingCoolingStateSet)
      .onGet(this.handleTargetHeatingCoolingStateGet);

    this.thermostatService
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.handleCurrentTemperatureGet);

    this.thermostatService
      .getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onSet(this.handleTargetTemperatureSet)
      .onGet(this.handleTargetTemperatureGet);

    this.valve.getTargetTemperature().then((targetTemperature) => {
      this.targetTemperature = targetTemperature;
    });
  }

  private startPollingTask() {
    this.currentTemperatureUpdateIntervalId = setInterval(async () => {
      this.log.info(`Polling temperature`);

      this.currentTemperature = await this.valve.getCurrentTemperature();
      this.thermostatService.updateCharacteristic(
        this.platform.Characteristic.CurrentTemperature,
        this.currentTemperature
      );

      this.targetTemperature = await this.valve.getTargetTemperature();
      this.thermostatService.updateCharacteristic(
        this.platform.Characteristic.TargetTemperature,
        this.targetTemperature
      );
    }, 10000);

    this.platform.api.on("shutdown", () => {
      clearInterval(this.currentTemperatureUpdateIntervalId);
    });
  }

  private handleCurrentTemperatureGet = () => {
    return Math.max(this.currentTemperature, 10);
  };

  private handleTargetTemperatureSet = async (value: CharacteristicValue) => {
    try {
      await this.valve.setTargetTemperature(value as number);
      this.targetTemperature = value as number;
      this.log.debug(`Target temperature set to ` + value);
    } catch (error) {
      this.log.error(`Failed to set target temperature: ` + String(error));

      const { HapStatusError, HAPStatus } = this.platform.api.hap;
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  };

  private handleTargetTemperatureGet = () => {
    return Math.max(this.targetTemperature, 10);
  };

  private handleTargetHeatingCoolingStateSet = () => {
    const { HapStatusError, HAPStatus } = this.platform.api.hap;
    throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  };

  private handleTargetHeatingCoolingStateGet = () => {
    return this.platform.Characteristic.TargetHeatingCoolingState.AUTO;
  };

  private getMacAddress() {
    return this.accessory.context.address;
  }
}
