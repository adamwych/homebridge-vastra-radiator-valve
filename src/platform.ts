import {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from "homebridge";
import {
  NobleBluetoothCentral,
  RadiatorValves,
  Logger as VastraLogger,
} from "vastra-radiator-valve";
import { VastraRadiatorValvePlatformAccessory } from "./radiatorValveAccessory";
import { PLATFORM_NAME, PLUGIN_NAME } from "./settings";

export class VastraRadiatorValveHomebridgePlugin
  implements DynamicPlatformPlugin
{
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  private radiatorValves?: RadiatorValves;

  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    this.api.on("didFinishLaunching", () => {
      this.startDiscovering();
    });

    this.api.on("shutdown", () => {
      this.radiatorValves?.dispose();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info("Loading accessory from cache:", accessory.displayName);
    this.accessories.push(accessory);
  }

  startDiscovering() {
    const bluetooth = new NobleBluetoothCentral();

    this.radiatorValves = new RadiatorValves(bluetooth, {
      logger: new VastraLogger(false),
      raspberryFix: true,
    });
    this.radiatorValves.startScanning(async (valve) => {
      const uuid = this.api.hap.uuid.generate(valve.peripheral.address);

      try {
        await valve.connect();
      } catch (error) {
        this.log.error(
          `Failed to open connection to ${valve.peripheral.address}.`,
          error
        );
        return;
      }

      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === uuid
      );
      if (existingAccessory) {
        this.log.info("Restoring accessory:", valve.peripheral.address);
        new VastraRadiatorValvePlatformAccessory(
          this,
          existingAccessory,
          valve
        );
      } else {
        this.log.info("Adding new accessory:", valve.peripheral.address);
        const accessory = new this.api.platformAccessory(
          valve.peripheral.address,
          uuid
        );
        accessory.context.address = valve.peripheral.address;

        new VastraRadiatorValvePlatformAccessory(this, accessory, valve);

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
      }
    });
  }
}