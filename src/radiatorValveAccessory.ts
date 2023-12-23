import { CharacteristicValue, PlatformAccessory, Service } from "homebridge";
import { RadiatorValve } from "vastra-radiator-valve";
import PrefixLogger from "./logger";
import { VastraRadiatorValveHomebridgePlugin } from "./platform";

export class VastraRadiatorValvePlatformAccessory {
  private readonly log = new PrefixLogger(
    this.platform.log,
    this.getMacAddress()
  );

  private valve?: RadiatorValve;
  private thermostatService!: Service;
  private currentTemperature = 0;
  private targetTemperature = 0;
  private temperatureUpdateInterval?: NodeJS.Timeout;
  private isUpdatingTargetTemperature = false;

  constructor(
    public readonly platform: VastraRadiatorValveHomebridgePlugin,
    public readonly accessory: PlatformAccessory,
    valve?: RadiatorValve
  ) {
    this.configureInformationService();
    this.configureThermostatService();

    if (valve) {
      this.setValve(valve);
    }
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
        this.getSerialNumber()
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
        this.platform.Characteristic.CurrentHeatingCoolingState.OFF
      );

    this.thermostatService
      .getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onSet(this.setTargetHeatingCoolingState)
      .onGet(this.getTargetHeatingCoolingState);

    this.thermostatService
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature);

    this.thermostatService
      .getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onSet(this.setTargetTemperature)
      .onGet(this.getTargetTemperature);

    this.thermostatService
      .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .onSet(this.setTemperatureDisplayUnits)
      .onGet(this.getTemperatureDisplayUnits);
  }

  private async pollTemperatures() {
    try {
      this.currentTemperature = await this.valve!.getCurrentTemperature();
      this.thermostatService.updateCharacteristic(
        this.platform.Characteristic.CurrentTemperature,
        this.currentTemperature
      );

      if (!this.isUpdatingTargetTemperature) {
        this.targetTemperature = await this.valve!.getTargetTemperature();
        this.thermostatService.updateCharacteristic(
          this.platform.Characteristic.TargetTemperature,
          this.targetTemperature
        );
      }
    } catch (error) {
      this.log.error("Failed to poll temperatures");
      this.log.error(String(error));
    }
  }

  private async startPollingTask() {
    if (!this.valve) {
      return;
    }

    await this.pollTemperatures();

    this.temperatureUpdateInterval = setInterval(() => {
      this.pollTemperatures();
    }, 10000);

    this.platform.api.on("shutdown", () => {
      clearInterval(this.temperatureUpdateInterval);
    });
  }

  private getCurrentTemperature = () => {
    return Math.max(this.currentTemperature, 10);
  };

  private setTargetTemperature = async (value: CharacteristicValue) => {
    const { HapStatusError, HAPStatus } = this.platform.api.hap;
    if (!this.valve) {
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    if (this.isUpdatingTargetTemperature) {
      throw new HapStatusError(HAPStatus.RESOURCE_BUSY);
    }

    this.isUpdatingTargetTemperature = true;
    try {
      await this.valve.setTargetTemperature(value as number);
      this.targetTemperature = value as number;
      this.log.debug(`Target temperature set to ` + value);
    } catch (error) {
      this.log.error(`Failed to set target temperature: ` + String(error));
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    } finally {
      this.isUpdatingTargetTemperature = false;
    }
  };

  private getTargetTemperature = () => {
    return Math.max(this.targetTemperature, 10);
  };

  private setTargetHeatingCoolingState = () => {
    const { HapStatusError, HAPStatus } = this.platform.api.hap;
    throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  };

  private getTargetHeatingCoolingState = () => {
    return this.valve
      ? this.platform.Characteristic.TargetHeatingCoolingState.AUTO
      : this.platform.Characteristic.TargetHeatingCoolingState.OFF;
  };

  private setTemperatureDisplayUnits = () => {
    const { HapStatusError, HAPStatus } = this.platform.api.hap;
    throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  };

  private getTemperatureDisplayUnits = () => {
    return this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;
  };

  public setValve(valve: RadiatorValve) {
    this.valve = valve;
    this.thermostatService.updateCharacteristic(
      this.platform.Characteristic.CurrentHeatingCoolingState,
      this.platform.Characteristic.CurrentHeatingCoolingState.HEAT
    );
    this.startPollingTask();
  }

  private getSerialNumber() {
    return this.accessory.context.serialNumber ?? "Unknown";
  }

  private getMacAddress() {
    return this.accessory.context.address;
  }
}
