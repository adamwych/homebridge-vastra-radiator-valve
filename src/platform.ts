import {
  API,
  Categories,
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

  public readonly accessories: VastraRadiatorValvePlatformAccessory[] = [];

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
    this.accessories.push(
      new VastraRadiatorValvePlatformAccessory(this, accessory)
    );
  }

  startDiscovering() {
    this.radiatorValves = new RadiatorValves(new NobleBluetoothCentral(), {
      logger: new VastraLogger(false),
      raspberryFix: true,
    });
    this.radiatorValves.startScanning(async (valve) => {
      try {
        await valve.connect();
      } catch (error) {
        this.log.error(
          `Failed to open connection to ${valve.peripheral.address}.`,
          error
        );
        return;
      }

      const uuid = this.api.hap.uuid.generate(valve.peripheral.address);
      const existingAccessory = this.accessories.find(
        (accessory) => accessory.accessory.UUID === uuid
      );
      if (existingAccessory) {
        this.log.info("Restoring accessory:", valve.peripheral.address);
        existingAccessory.setValve(valve);
      } else {
        this.log.info("Adding new accessory:", valve.peripheral.address);
        const accessory = new this.api.platformAccessory(
          valve.peripheral.address,
          uuid,
          Categories.THERMOSTAT
        );
        accessory.context.serialNumber = valve.getSerialNumber();
        accessory.context.address = valve.peripheral.address;

        this.accessories.push(
          new VastraRadiatorValvePlatformAccessory(this, accessory, valve)
        );

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
      }
    });
  }
}
