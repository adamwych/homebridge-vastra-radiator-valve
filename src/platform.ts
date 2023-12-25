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
  RadiatorValveScanner,
} from "vastra-radiator-valve";
import { VastraRadiatorValvePlatformAccessory } from "./radiatorValveAccessory";
import { PLATFORM_NAME, PLUGIN_NAME } from "./settings";

export class VastraRadiatorValveHomebridgePlugin
  implements DynamicPlatformPlugin
{
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  private scanner?: RadiatorValveScanner;

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
      this.scanner?.disconnectAll();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info("Loading accessory from cache:", accessory.displayName);
    this.accessories.push(
      new VastraRadiatorValvePlatformAccessory(this, accessory)
    );
  }

  startDiscovering() {
    this.scanner = new RadiatorValveScanner(new NobleBluetoothCentral(), {
      verbose: false,
      raspberryFix: true,
    });

    this.scanner.on("connected", async (valve) => {
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
        accessory.context.serialNumber = await valve.getSerialNumber();
        accessory.context.address = valve.peripheral.address;

        this.accessories.push(
          new VastraRadiatorValvePlatformAccessory(this, accessory, valve)
        );

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
      }
    });

    this.scanner.start();
  }
}
