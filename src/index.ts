import { InfluxDB, Point } from '@influxdata/influxdb-client';

import Config from "./config";
import TeslaApi from "./teslaApi";

async function start() {
	log("Starting...");

	// create influx client
	const influx = new InfluxDB({
		url: Config.influxUrl,
		token: Config.influxToken
	});

	const influxWriteApi = influx.getWriteApi(Config.influxOrg, Config.influxBucket, "ms");

	// create an instance of the api
	const teslaApi = new TeslaApi(Config.teslaRefreshToken);

	// get vehicles
	const allVehicles = await teslaApi.getVehicles();
	let trackedVehicles: string[];

	// if configured, only track specified vehicles
	if (Config.teslaVehicles.length > 0) {
		trackedVehicles = allVehicles.filter(v => Config.teslaVehicles?.includes(v));
	} else {
		trackedVehicles = allVehicles;
	}

	log(`Logging metrics for ${trackedVehicles.length} of ${allVehicles.length} total vehicles: ${trackedVehicles.join(", ")}`);

	// collection loop
	let retries = 0;
	const maxBackoff = 120;	// 2 minutes
	while (true) {
		const startTime = Date.now();

		// add exponential backoff delay if the last request failed
		if (retries > 0) {
			const backoffSecs = Math.min(Math.pow(2, retries), maxBackoff);
			log(`Last ${retries} attempts failed, backing off for ${backoffSecs}s...`);

			await wait(backoffSecs * 1000);
		}

		debugLog("Starting collection cycle");

		try {
			const points: Point[] = [];

			for (let i = 0; i < trackedVehicles.length; i++) {
				const vehicle = trackedVehicles[i];

				debugLog(`Getting data for ${vehicle}`);
				const data = await teslaApi.getData(vehicle);

				// if the vehicle is unavailable, skip it
				if (data === null) {
					debugLog(`Vehicle ${vehicle} unavailable`);
					continue;
				}

				// turn vehicle data into points

				const vehiclePoint = new Point("vehicle_data")
					.tag("vehicle", vehicle)
					.tag("vin", data.vin)
					.stringField("state", data.state)
					.floatField("odometer", data.vehicle_state.odometer);

				const drivePoint = new Point("drive_state")
					.tag("vehicle", vehicle)
					.tag("vin", data.vin)
					.intField("heading", data.drive_state.heading)
					.floatField("latitude", data.drive_state.latitude)
					.floatField("longitude", data.drive_state.longitude)
					.floatField("power", data.drive_state.power)

				if (data.drive_state.speed !== null) {
					drivePoint.floatField("speed", data.drive_state.speed);
				}

				if (data.drive_state.shift_state !== null) {
					drivePoint.stringField("shift_state", data.drive_state.shift_state);
				}

				const chargePoint = new Point("charge_state")
					.tag("vehicle", vehicle)
					.tag("vin", data.vin)
					.intField("battery_level", data.charge_state.battery_level)
					.floatField("battery_range", data.charge_state.battery_range)
					.floatField("est_battery_range", data.charge_state.est_battery_range)
					.stringField("charging_state", data.charge_state.charging_state)
					.intField("charge_amps", data.charge_state.charge_amps)
					.floatField("charge_rate", data.charge_state.charge_rate)
					.intField("charge_limit_soc", data.charge_state.charge_limit_soc)
					.intField("charger_voltage", data.charge_state.charger_voltage)
					.intField("charger_actual_current", data.charge_state.charger_actual_current)
					.intField("charger_power", data.charge_state.charger_power)
					.intField("minutes_to_full_charge", data.charge_state.minutes_to_full_charge)
					.floatField("time_to_full_charge", data.charge_state.time_to_full_charge);

				if (data.charge_state.charger_phases !== null) {
					chargePoint.intField("charger_phases", data.charge_state.charger_phases);
				}

				const climatePoint = new Point("climate_state")
					.tag("vehicle", vehicle)
					.tag("vin", data.vin)
					.floatField("inside_temp", data.climate_state.inside_temp)
					.floatField("outside_temp", data.climate_state.outside_temp)
					.floatField("driver_temp_setting", data.climate_state.driver_temp_setting)
					.floatField("passenger_temp_setting", data.climate_state.passenger_temp_setting)

				points.push(vehiclePoint, drivePoint, chargePoint, climatePoint);

				debugLog(`Writing ${points.length} points for ${vehicle}`);
				influxWriteApi.writePoints(points);
			}

			if (points.length > 0) {
				debugLog(`Flushing ${points.length} points`);
				await influxWriteApi.flush();
			}
		} catch (er) {
			retries++;
			log(`Failed getting data: ${er instanceof Error ? er.stack : er}`);
		}

		debugLog("Collection finished");

		retries = 0;

		// calculate time to wait
		const jitter = Math.round(-(Config.queryJitter / 2) + (Math.random() * Config.queryJitter));
		const waitTime = Math.round(Math.max((Config.queryInterval - (Date.now() - startTime) + jitter), 0));
		debugLog(`Waiting ${waitTime}ms (${jitter}ms jitter)`);
		await wait(waitTime);
	}
}

async function wait(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message: string) {
	console.log(message);
}

function debugLog(message: string) {
	if (Config.verbose) {
		console.log(message);
	}
}

start().catch(console.error);
